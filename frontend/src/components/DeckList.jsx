import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDecks, deleteDeck } from '../api';
import './DeckList.css';

function DeckList() {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDecks();
  }, []);

  const loadDecks = async () => {
    try {
      setLoading(true);
      const response = await getDecks();
      setDecks(response.data);
    } catch (error) {
      console.error('Error loading decks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this deck?')) {
      try {
        await deleteDeck(id);
        loadDecks();
      } catch (error) {
        console.error('Error deleting deck:', error);
        alert('Failed to delete deck');
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading decks...</div>;
  }

  return (
    <div className="deck-list">
      <div className="deck-list-header">
        <h2>My Decks</h2>
        <button className="btn btn-primary" onClick={() => navigate('/deck/new')}>
          + Create New Deck
        </button>
      </div>

      {decks.length === 0 ? (
        <div className="empty-state">
          <p>No decks yet. Create your first deck to get started!</p>
        </div>
      ) : (
        <div className="decks-grid">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="deck-card"
              onClick={() => navigate(`/deck/${deck.id}/swipe`)}
            >
              <div className="deck-card-header">
                <h3>{deck.title}</h3>
                <div className="deck-actions">
                  <button
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/deck/${deck.id}/edit`);
                    }}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon"
                    onClick={(e) => handleDelete(deck.id, e)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              {deck.description && <p className="deck-description">{deck.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DeckList;

