import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDeck, createDeck, updateDeck, getCards, createCard, updateCard, deleteCard } from '../api';
import './DeckEditor.css';

function DeckEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [deck, setDeck] = useState({ title: '', description: '' });
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const loadDeck = useCallback(async () => {
    try {
      setLoading(true);
      const [deckRes, cardsRes] = await Promise.all([
        getDeck(id),
        getCards(id)
      ]);
      setDeck(deckRes.data);
      setCards(cardsRes.data);
    } catch (error) {
      console.error('Error loading deck:', error);
      alert('Failed to load deck');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isEdit) {
      loadDeck();
    }
  }, [isEdit, loadDeck]);

  const handleDeckChange = (field, value) => {
    setDeck({ ...deck, [field]: value });
  };

  const handleSaveDeck = async () => {
    if (!deck.title.trim()) {
      alert('Please enter a deck title');
      return;
    }

    try {
      setSaving(true);
      if (isEdit) {
        await updateDeck(id, deck);
      } else {
        const response = await createDeck(deck);
        navigate(`/deck/${response.data.id}/edit`);
        return;
      }
      alert('Deck saved successfully!');
    } catch (error) {
      console.error('Error saving deck:', error);
      alert('Failed to save deck');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCard = () => {
    setCards([...cards, { id: `temp-${Date.now()}`, title: '', description: '', image_url: '', isNew: true }]);
  };

  const handleCardChange = (index, field, value) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], [field]: value };
    setCards(newCards);
  };

  const handleSaveCard = async (card, index) => {
    if (!card.title.trim()) {
      alert('Please enter a card title');
      return;
    }

    try {
      const deckId = isEdit ? id : deck.id;
      if (!deckId) {
        alert('Please save the deck first');
        return;
      }

      if (card.isNew) {
        const response = await createCard({ ...card, deck_id: deckId });
        const newCards = [...cards];
        newCards[index] = response.data;
        setCards(newCards);
      } else {
        const response = await updateCard(card.id, card);
        const newCards = [...cards];
        newCards[index] = response.data;
        setCards(newCards);
      }
    } catch (error) {
      console.error('Error saving card:', error);
      alert('Failed to save card');
    }
  };

  const handleDeleteCard = async (cardId, index) => {
    if (window.confirm('Are you sure you want to delete this card?')) {
      try {
        if (!cardId.startsWith('temp-')) {
          await deleteCard(cardId);
        }
        const newCards = cards.filter((_, i) => i !== index);
        setCards(newCards);
      } catch (error) {
        console.error('Error deleting card:', error);
        alert('Failed to delete card');
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="deck-editor">
      <div className="editor-header">
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h2>{isEdit ? 'Edit Deck' : 'Create New Deck'}</h2>
      </div>

      <div className="editor-section">
        <h3>Deck Information</h3>
        <div className="form-group">
          <label>Title *</label>
          <input
            type="text"
            value={deck.title}
            onChange={(e) => handleDeckChange('title', e.target.value)}
            placeholder="Enter deck title"
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            value={deck.description || ''}
            onChange={(e) => handleDeckChange('description', e.target.value)}
            placeholder="Enter deck description"
            rows="3"
          />
        </div>
        <button className="btn btn-primary" onClick={handleSaveDeck} disabled={saving}>
          {saving ? 'Saving...' : 'Save Deck'}
        </button>
      </div>

      <div className="editor-section">
        <div className="section-header">
          <h3>Cards</h3>
          <button className="btn btn-primary" onClick={handleAddCard}>
            + Add Card
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="empty-state">
            <p>No cards yet. Add your first card!</p>
          </div>
        ) : (
          <div className="cards-list">
            {cards.map((card, index) => (
              <div key={card.id || index} className="card-editor">
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={card.title || ''}
                    onChange={(e) => handleCardChange(index, 'title', e.target.value)}
                    placeholder="Enter card title"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={card.description || ''}
                    onChange={(e) => handleCardChange(index, 'description', e.target.value)}
                    placeholder="Enter card description"
                    rows="2"
                  />
                </div>
                <div className="form-group">
                  <label>Image URL</label>
                  <input
                    type="url"
                    value={card.image_url || ''}
                    onChange={(e) => handleCardChange(index, 'image_url', e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div className="card-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleSaveCard(card, index)}
                  >
                    Save Card
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteCard(card.id, index)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isEdit && cards.length > 0 && (
        <div className="editor-actions">
          <button
            className="btn btn-success btn-large"
            onClick={() => navigate(`/deck/${id}/swipe`)}
          >
            Start Choosing →
          </button>
        </div>
      )}
    </div>
  );
}

export default DeckEditor;

