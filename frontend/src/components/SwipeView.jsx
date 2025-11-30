import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createSession, getSessionState, recordDecision } from '../api';
import './SwipeView.css';

function SwipeView() {
  const { id: deckId, sessionId: urlSessionId } = useParams();
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState(null);
  const [currentCard, setCurrentCard] = useState(null);
  const [remainingCards, setRemainingCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Swipe gesture state
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const cardRef = useRef(null);

  const loadSessionState = useCallback(async (sid) => {
    try {
      const response = await getSessionState(sid);
      const session = response.data;
      const cards = session.remainingCards || [];

      setRemainingCards(cards);
      
      if (cards.length > 0) {
        setCurrentCard(cards[0]);
      } else {
        // No more cards, navigate to choice screen
        navigate(`/session/${sid}/swipe-complete`);
      }
    } catch (error) {
      console.error('Error loading session state:', error);
    }
  }, [navigate]);

  const initializeSession = useCallback(async () => {
    try {
      setLoading(true);
      if (urlSessionId) {
        // Use existing session for reswipe
        setSessionId(urlSessionId);
        await loadSessionState(urlSessionId);
      } else if (deckId) {
        // createSession автоматически вернет существующую активную сессию, если она есть
        // или создаст новую, если активной нет
        const sessionResponse = await createSession(deckId, { mode: 'swipe' });
        const sessionIdToUse = sessionResponse.data.id;
        const sessionMode = sessionResponse.data.mode;
        
        // Если сессия в режиме duel, перенаправляем в окно выбора
        if (sessionMode === 'duel') {
          navigate(`/session/${sessionIdToUse}/swipe-complete`);
          return;
        }
        
        setSessionId(sessionIdToUse);
        await loadSessionState(sessionIdToUse);
      }
    } catch (error) {
      console.error('Error initializing session:', error);
      alert('Failed to start session');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [deckId, urlSessionId, navigate, loadSessionState]);

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  const handleDecision = useCallback(async (decision) => {
    if (!currentCard || processing) return;

    try {
      setProcessing(true);
      const response = await recordDecision(sessionId, currentCard.id, decision, 1);
      
      // Update state from response
      const session = response.data;
      const cards = session.remainingCards || [];

      setRemainingCards(cards);

      if (cards.length > 0) {
        setCurrentCard(cards[0]);
      } else {
        // Navigate to choice screen
        navigate(`/session/${sessionId}/swipe-complete`);
      }
    } catch (error) {
      console.error('Error recording decision:', error);
      alert('Failed to record decision');
    } finally {
      setProcessing(false);
      setSwipeOffset({ x: 0, y: 0 });
    }
  }, [currentCard, processing, sessionId, navigate]);

  // Swipe gesture handlers
  const handleTouchStart = (e) => {
    if (processing) return;
    const touch = e.touches[0];
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || processing) return;
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - startPosRef.current.x;
    const deltaY = touch.clientY - startPosRef.current.y;
    setSwipeOffset({ x: deltaX, y: deltaY });
  };

  const handleTouchEnd = () => {
    if (!isDragging || processing) return;
    setIsDragging(false);
    
    const threshold = 100;
    if (Math.abs(swipeOffset.x) > threshold) {
      if (swipeOffset.x > 0) {
        handleDecision('smash');
      } else {
        handleDecision('pass');
      }
    } else {
      setSwipeOffset({ x: 0, y: 0 });
    }
  };

  // Mouse handlers for desktop
  const handleMouseDown = (e) => {
    if (processing) return;
    e.preventDefault();
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || processing) return;
    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;
    setSwipeOffset({ x: deltaX, y: deltaY });
  }, [isDragging, processing]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || processing) return;
    setIsDragging(false);
    
    const threshold = 100;
    if (Math.abs(swipeOffset.x) > threshold) {
      if (swipeOffset.x > 0) {
        handleDecision('smash');
      } else {
        handleDecision('pass');
      }
    } else {
      setSwipeOffset({ x: 0, y: 0 });
    }
  }, [isDragging, processing, swipeOffset.x, handleDecision]);

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Calculate rotation and opacity based on swipe
  const rotation = swipeOffset.x * 0.1;
  const opacity = 1 - Math.abs(swipeOffset.x) / 300;

  if (loading) {
    return <div className="loading">Starting session...</div>;
  }

  if (!currentCard) {
    return <div className="loading">Loading card...</div>;
  }

  return (
    <div className="swipe-view">
      <div className="swipe-header">
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h2>Swipe to Choose</h2>
        <div className="header-right">
          <div className="progress">
            {remainingCards.length} cards remaining
          </div>
          {sessionId && (
            <button 
              className="btn btn-icon trash-btn" 
              onClick={() => navigate(`/session/${sessionId}/trash`)}
              title="View trash"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      <div className="card-container">
        <div
          ref={cardRef}
          className="swipe-card"
          style={{
            transform: `translateX(${swipeOffset.x}px) translateY(${swipeOffset.y}px) rotate(${rotation}deg)`,
            opacity: Math.max(0.3, opacity),
            transition: isDragging ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          {swipeOffset.x > 50 && (
            <div className="swipe-indicator swipe-like">❤️ LIKE</div>
          )}
          {swipeOffset.x < -50 && (
            <div className="swipe-indicator swipe-pass">❌ PASS</div>
          )}
          {currentCard.image_url && (
            <div className="card-image">
              <img src={currentCard.image_url} alt={currentCard.title} />
            </div>
          )}
          <div className="card-content">
            <h3>{currentCard.title}</h3>
            {currentCard.description && <p>{currentCard.description}</p>}
          </div>
        </div>
      </div>

      <div className="swipe-actions">
        <button
          className="btn btn-pass"
          onClick={() => handleDecision('pass')}
          disabled={processing}
        >
          ❌ Pass
        </button>
        <button
          className="btn btn-smash"
          onClick={() => handleDecision('smash')}
          disabled={processing}
        >
          ❤️ Smash
        </button>
      </div>
    </div>
  );
}

export default SwipeView;
