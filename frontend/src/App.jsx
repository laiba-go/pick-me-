import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DeckList from './components/DeckList';
import DeckEditor from './components/DeckEditor';
import SwipeView from './components/SwipeView';
import SwipeCompleteView from './components/SwipeCompleteView';
import DuelView from './components/DuelView';
import WinnerView from './components/WinnerView';
import TrashView from './components/TrashView';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>PickMe</h1>
        </header>
        <main className="App-main">
          <Routes>
            <Route path="/" element={<DeckList />} />
            <Route path="/deck/new" element={<DeckEditor />} />
            <Route path="/deck/:id/edit" element={<DeckEditor />} />
            <Route path="/deck/:id/swipe" element={<SwipeView />} />
            <Route path="/session/:sessionId/swipe-complete" element={<SwipeCompleteView />} />
            <Route path="/session/:sessionId/reswipe" element={<SwipeView />} />
            <Route path="/session/:sessionId/duel" element={<DuelView />} />
            <Route path="/session/:sessionId/winner" element={<WinnerView />} />
            <Route path="/session/:sessionId/trash" element={<TrashView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

