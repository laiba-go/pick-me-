import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Decks
export const getDecks = (userId = null) => {
  const params = userId ? { user_id: userId } : {};
  return api.get('/decks', { params });
};

export const getDeck = (id) => api.get(`/decks/${id}`);

export const createDeck = (data) => api.post('/decks', data);

export const updateDeck = (id, data) => api.put(`/decks/${id}`, data);

export const deleteDeck = (id) => api.delete(`/decks/${id}`);

// Cards
export const getCards = (deckId) => api.get(`/cards/deck/${deckId}`);

export const getCard = (id) => api.get(`/cards/${id}`);

export const createCard = (data) => api.post('/cards', data);

export const createCardsBulk = (deckId, cards) => api.post(`/cards/deck/${deckId}/bulk`, { cards });

export const updateCard = (id, data) => api.put(`/cards/${id}`, data);

export const deleteCard = (id) => api.delete(`/cards/${id}`);

// Sessions
export const createSession = (deckId, data = {}) => api.post(`/sessions/deck/${deckId}`, data);

export const getSessionState = (sessionId) => api.get(`/sessions/${sessionId}/state`);

export const recordDecision = (sessionId, cardId, decision, round = 1) => 
  api.post(`/sessions/${sessionId}/decision`, { card_id: cardId, decision, round });

export const getDuelPair = (sessionId) => api.post(`/sessions/${sessionId}/duel`);

export const startDuel = (sessionId) => api.post(`/sessions/${sessionId}/start-duel`);

export const reswipeSession = (sessionId) => api.post(`/sessions/${sessionId}/reswipe`);

export const finishSession = (sessionId) => api.post(`/sessions/${sessionId}/finish`);

export default api;

