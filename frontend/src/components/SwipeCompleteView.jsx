import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSessionState, startDuel, reswipeSession } from '../api';
import './SwipeCompleteView.css';

function SwipeCompleteView() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [smashedCards, setSmashedCards] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSessionState = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getSessionState(sessionId);
      const session = response.data;
      const smashed = session.smashed_cards || [];
      
      setSmashedCards(Array.isArray(smashed) ? smashed : []);
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
      await startDuel(sessionId);
      navigate(`/session/${sessionId}/duel`);
    } catch (error) {
      console.error('Error starting duel:', error);
      alert('Failed to start duel mode');
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

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const smashedCount = smashedCards.length;

  return (
    <div className="swipe-complete-view">
      <div className="complete-header">
        <h1>🎉 First Round Complete!</h1>
        <p className="subtitle">You've selected {smashedCount} card{smashedCount !== 1 ? 's' : ''}</p>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SwipeCompleteView;

