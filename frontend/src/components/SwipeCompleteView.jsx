import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSessionState, startDuel, reswipeSession, returnToSwipe } from '../api';
import './SwipeCompleteView.css';

function SwipeCompleteView() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [smashedCards, setSmashedCards] = useState([]);
  const [sessionMode, setSessionMode] = useState('swipe');
  const [loading, setLoading] = useState(true);

  const loadSessionState = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getSessionState(sessionId);
      const session = response.data;
      
      setSessionMode(session.mode || 'swipe');
      
      // Если сессия в режиме duel, используем remainingCards для отображения
      // так как в батле smashed карты уже перешли в remaining
      if (session.mode === 'duel') {
        const remaining = session.remainingCards || [];
        setSmashedCards(Array.isArray(remaining) ? remaining : []);
      } else {
        const smashed = session.smashedCards || [];
        setSmashedCards(Array.isArray(smashed) ? smashed : []);
      }
    } catch (error) {
      console.error('Error loading session state:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSessionState();
  }, [loadSessionState]);

  const handleContinueToDuel = async () => {
    try {
      // Если уже в режиме duel, просто переходим к батлу
      if (sessionMode === 'duel') {
        navigate(`/session/${sessionId}/duel`);
      } else {
        // Переключаем в режим duel
        await startDuel(sessionId);
        navigate(`/session/${sessionId}/duel`);
      }
    } catch (error) {
      console.error('Error starting duel:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to start duel mode';
      alert(errorMessage);
    }
  };

  const handleReswipeSmashed = async () => {
    try {
      await reswipeSession(sessionId);
      navigate(`/session/${sessionId}/reswipe`);
    } catch (error) {
      console.error('Error resetting swipe:', error);
      alert('Failed to reset swipe');
    }
  };

  const handleReturnToSwipe = async () => {
    try {
      await returnToSwipe(sessionId);
      navigate(`/session/${sessionId}/reswipe`);
    } catch (error) {
      console.error('Error returning to swipe:', error);
      alert('Failed to return to swipe mode');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const smashedCount = smashedCards.length;

  return (
    <div className="swipe-complete-view">
      <div className="complete-header">
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          ← Go Home
        </button>
        <h1>{sessionMode === 'duel' ? 'Battle Mode' : 'You have seen all cards'}</h1>
        <p className="subtitle">
          {sessionMode === 'duel' 
            ? `${smashedCount} card${smashedCount !== 1 ? 's' : ''} remaining for battle`
            : `You've selected ${smashedCount} card${smashedCount !== 1 ? 's' : ''}`
          }
        </p>
      </div>

      <div className="complete-content">
        {smashedCount === 0 ? (
          <div className="no-selection">
            <p>You didn't select any cards. Would you like to try again?</p>
            <button className="btn btn-primary" onClick={() => navigate(-1)}>
              Go Back
            </button>
          </div>
        ) : smashedCount === 1 ? (
          <div className="winner-found">
            <h2>🎊 You have a winner!</h2>
            <button
              className="btn btn-success btn-large"
              onClick={() => navigate(`/session/${sessionId}/winner`)}
            >
              See Winner →
            </button>
          </div>
        ) : (
          <div className="choice-options">
            <h2>What would you like to do next?</h2>
            <div className="options-grid">
              {sessionMode === 'duel' ? (
                <>
                  <div className="option-card" onClick={handleContinueToDuel}>
                    <div className="option-icon">⚔️</div>
                    <h3>Continue Battle</h3>
                    <p>Continue comparing {smashedCount} cards in 1v1 battles</p>
                    <button className="btn btn-primary">Continue Battles</button>
                  </div>
                  <div className="option-card" onClick={handleReturnToSwipe}>
                    <div className="option-icon">🔄</div>
                    <h3>Return to Swipe</h3>
                    <p>Go back to swiping through {smashedCount} cards</p>
                    <button className="btn btn-secondary">Return to Swipe</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="option-card" onClick={handleContinueToDuel}>
                    <div className="option-icon">⚔️</div>
                    <h3>Battle Mode</h3>
                    <p>Compare cards head-to-head in 1v1 battles</p>
                    <button className="btn btn-primary">Start Battles</button>
                  </div>
                  <div className="option-card" onClick={handleReswipeSmashed}>
                    <div className="option-icon">🔄</div>
                    <h3>Reswipe Selected</h3>
                    <p>Go through your {smashedCount} selected cards again</p>
                    <button className="btn btn-secondary">Reswipe</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SwipeCompleteView;

