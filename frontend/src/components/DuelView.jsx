import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSessionState, getDuelPair, recordDecision } from '../api';
import './DuelView.css';

function DuelView() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [card1, setCard1] = useState(null);
  const [card2, setCard2] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [round, setRound] = useState(1);

  const loadDuelPair = useCallback(async () => {
    try {
      setLoading(true);
      
      // Проверяем состояние сессии перед загрузкой батла
      const stateResponse = await getSessionState(sessionId);
      const session = stateResponse.data;
      
      // Если сессия завершена - идем к победителю
      if (session.status === 'finished') {
        navigate(`/session/${sessionId}/winner`);
        return;
      }
      
      // Если нет достаточно карт для батла, возвращаем в окно выбора
      // НЕ проверяем на одну карту здесь, так как пользователь может вернуться из батла
      if (!session.remainingCards || session.remainingCards.length < 2) {
        navigate(`/session/${sessionId}/swipe-complete`);
        return;
      }
      
      const response = await getDuelPair(sessionId);
      setCard1(response.data.card1);
      setCard2(response.data.card2);
    } catch (error) {
      console.error('Error loading duel pair:', error);
      // если нет достаточно карт для батла - возвращаем в окно выбора
      try {
        const stateResponse = await getSessionState(sessionId);
        const session = stateResponse.data;
        if (session.status === 'finished' || (session.remainingCards && session.remainingCards.length === 1)) {
          navigate(`/session/${sessionId}/winner`);
        } else {
          // Возвращаем в окно выбора вместо главной страницы
          navigate(`/session/${sessionId}/swipe-complete`);
        }
      } catch (stateError) {
        console.error('Error getting session state:', stateError);
        navigate(`/session/${sessionId}/swipe-complete`);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, navigate]);

  useEffect(() => {
    loadDuelPair();
  }, [loadDuelPair]);

  const handleChoice = async (chosenCard, otherCard) => {
    if (processing) return;

    try {
      setProcessing(true);

      // записываем решения последовательно, чтобы избежать race condition
      // Сначала записываем решение для выбранной карты (smash)
      await recordDecision(sessionId, chosenCard.id, 'smash', round);
      // Затем записываем решение для не выбранной карты (pass)
      await recordDecision(sessionId, otherCard.id, 'pass', round);

      // обновляем состояние сессии
      const stateResponse = await getSessionState(sessionId);
      const session = stateResponse.data;

      // если сессия завершена или осталась одна карта — редирект на победителя
      if (session.status === 'finished') {
        navigate(`/session/${sessionId}/winner`);
      } else if (session.remainingCards && session.remainingCards.length === 1) {
        // Если осталась одна карта, завершаем сессию и идем к победителю
        navigate(`/session/${sessionId}/winner`);
      } else if (session.remainingCards && session.remainingCards.length < 2) {
        // Если нет достаточно карт для батла, возвращаем в окно выбора
        navigate(`/session/${sessionId}/swipe-complete`);
      } else {
        setRound(prev => prev + 1);
        await loadDuelPair();
      }
    } catch (error) {
      console.error('Error recording choice:', error);
      alert('Failed to record choice');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading battle...</div>;
  }

  if (!card1 || !card2) {
    return <div className="loading">Preparing cards...</div>;
  }

  return (
    <div className="duel-view">
      <div className="duel-header">
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h2>Choose Your Favorite</h2>
        <div className="header-right">
          <div className="round-info">Round {round}</div>
          <button 
            className="btn btn-icon trash-btn" 
            onClick={() => navigate(`/session/${sessionId}/trash`)}
            title="View trash"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="duel-container">
        <div className="duel-card" onClick={() => handleChoice(card1, card2)}>
          {card1.image_url && (
            <div className="card-image">
              <img src={card1.image_url} alt={card1.title} />
            </div>
          )}
          <div className="card-content">
            <h3>{card1.title}</h3>
            {card1.description && <p>{card1.description}</p>}
          </div>
        </div>

        <div className="vs-divider"><span>VS</span></div>

        <div className="duel-card" onClick={() => handleChoice(card2, card1)}>
          {card2.image_url && (
            <div className="card-image">
              <img src={card2.image_url} alt={card2.title} />
            </div>
          )}
          <div className="card-content">
            <h3>{card2.title}</h3>
            {card2.description && <p>{card2.description}</p>}
          </div>
        </div>
      </div>

      {processing && (
        <div className="processing-overlay">
          <div className="spinner"></div>
          <p>Processing your choice...</p>
        </div>
      )}
    </div>
  );
}

export default DuelView;
