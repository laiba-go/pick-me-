import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { finishSession, getSessionState } from '../api';
import './WinnerView.css';

function WinnerView() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadWinner = useCallback(async () => {
    try {
      setLoading(true);
      // Ensure session is finished
      await finishSession(sessionId);
      
      // Get session state
      const response = await getSessionState(sessionId);
      const session = response.data;
      
      // Get winner card
      const remainingCards = session.remaining_cards || [];
      if (remainingCards.length === 1) {
        const winnerCard = session.remainingCards?.[0];
        if (winnerCard) {
          setWinner(winnerCard);
        } else {
          // Fallback: get card details
          const cardResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1'}/cards/${remainingCards[0]}`);
          const cardData = await cardResponse.json();
          setWinner(cardData);
        }
      }
    } catch (error) {
      console.error('Error loading winner:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadWinner();
  }, [loadWinner]);

  if (loading) {
    return <div className="loading">Determining winner...</div>;
  }

  if (!winner) {
    return (
      <div className="winner-view">
        <div className="winner-card">
          <h2>No winner found</h2>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="winner-view">
      <div className="winner-animation">
        <div className="confetti"></div>
        <div className="confetti"></div>
        <div className="confetti"></div>
        <div className="confetti"></div>
        <div className="confetti"></div>
      </div>

      <div className="winner-header">
        <h1>🎉 Winner! 🎉</h1>
        <p className="subtitle">You've chosen your favorite!</p>
      </div>

      <div className="winner-card">
        {winner.image_url && (
          <div className="winner-image">
            <img src={winner.image_url} alt={winner.title} />
          </div>
        )}
        <div className="winner-content">
          <h2>{winner.title}</h2>
          {winner.description && <p>{winner.description}</p>}
        </div>
      </div>

      <div className="winner-actions">
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Create New Deck
        </button>
        <button className="btn btn-secondary" onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    </div>
  );
}

export default WinnerView;

