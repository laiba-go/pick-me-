import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSessionState, getDuelPair, recordDecision, finishSession } from '../api';
import './DuelView.css';

function DuelView() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  const [card1, setCard1] = useState(null);
  const [card2, setCard2] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [round, setRound] = useState(2);

  const checkSessionStatus = useCallback(async () => {
    try {
      const response = await getSessionState(sessionId);
      const session = response.data;
      
      if (session.status === 'finished' || (session.remaining_cards && session.remaining_cards.length <= 1)) {
        navigate(`/session/${sessionId}/winner`);
      } else {
        alert('Not enough cards for duel. Please try again.');
        navigate('/');
      }
    } catch (error) {
      console.error('Error checking session:', error);
      navigate('/');
    }
  }, [sessionId, navigate]);

  const loadDuelPair = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getDuelPair(sessionId);
      setCard1(response.data.card1);
      setCard2(response.data.card2);
    } catch (error) {
      console.error('Error loading duel pair:', error);
      // Check if session is finished
      checkSessionStatus();
    } finally {
      setLoading(false);
    }
  }, [sessionId, checkSessionStatus]);

  useEffect(() => {
    loadDuelPair();
  }, [loadDuelPair]);

  const handleChoice = async (chosenCard, otherCard) => {
    if (processing) return;

    try {
      setProcessing(true);
      
      // Record decision for chosen card (smash) and other (pass)
      await Promise.all([
        recordDecision(sessionId, chosenCard.id, 'smash', round),
        recordDecision(sessionId, otherCard.id, 'pass', round)
      ]);

      // Check if we have a winner
      const stateResponse = await getSessionState(sessionId);
      const session = stateResponse.data;
      const remaining = session.remaining_cards || [];

      if (remaining.length <= 1) {
        // Finish session
        await finishSession(sessionId);
        navigate(`/session/${sessionId}/winner`);
      } else {
        // Load next pair
        setRound(round + 1);
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
        <div className="round-info">Round {round}</div>
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
          <div className="card-overlay">
            <span className="choice-label">Click to Choose</span>
          </div>
        </div>

        <div className="vs-divider">
          <span>VS</span>
        </div>

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
          <div className="card-overlay">
            <span className="choice-label">Click to Choose</span>
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

