const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Create a new session
router.post('/deck/:deckId', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { deckId } = req.params;
    const { user_id = null, mode = 'swipe' } = req.body;
    
    // Get all cards from the deck
    const cardsResult = await db.query(
      'SELECT id FROM cards WHERE deck_id = $1 ORDER BY position ASC, created_at ASC',
      [deckId]
    );
    
    const cardIds = cardsResult.rows.map(row => row.id);
    
    if (cardIds.length === 0) {
      return res.status(400).json({ error: 'Deck has no cards' });
    }
    
    // Create session
    const sessionId = uuidv4();
    const result = await db.query(
      'INSERT INTO sessions (id, deck_id, user_id, remaining_cards, mode, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [sessionId, deckId, user_id, JSON.stringify(cardIds), mode, 'active']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get session state
router.get('/:id/state', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { id } = req.params;
    
    const result = await db.query('SELECT * FROM sessions WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = result.rows[0];
    
    // Get full card details for remaining cards
    const remainingIds = session.remaining_cards || [];
    const smashedIds = session.smashed_cards || [];
    const passedIds = session.passed_cards || [];
    
    let remainingCards = [];
    if (remainingIds.length > 0) {
      const cardsResult = await db.query(
        `SELECT * FROM cards WHERE id = ANY($1::uuid[])`,
        [remainingIds]
      );
      remainingCards = cardsResult.rows;
    }
    
    res.json({
      ...session,
      remainingCards
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record a decision (swipe: pass or smash)
router.post('/:id/decision', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { id } = req.params;
    const { card_id, decision, round = 1 } = req.body;
    
    if (!card_id || !decision) {
      return res.status(400).json({ error: 'card_id and decision are required' });
    }
    
    if (!['pass', 'smash', 'chosen'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be pass, smash, or chosen' });
    }
    
    // Get current session
    const sessionResult = await db.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessionResult.rows[0];
    if (session.status === 'finished') {
      return res.status(400).json({ error: 'Session is already finished' });
    }
    
    let remainingCards = session.remaining_cards || [];
    let passedCards = session.passed_cards || [];
    let smashedCards = session.smashed_cards || [];
    
    // In duel mode, only remove cards that are passed
    // In swipe mode, remove all cards from remaining
    if (session.mode === 'duel') {
      if (decision === 'pass') {
        // Remove passed card from remaining
        remainingCards = remainingCards.filter(cid => cid !== card_id);
        passedCards.push(card_id);
      } else if (decision === 'smash' || decision === 'chosen') {
        // Keep smashed card in remaining, but also add to smashed list for tracking
        if (!smashedCards.includes(card_id)) {
          smashedCards.push(card_id);
        }
      }
    } else {
      // Swipe mode: remove card from remaining
      remainingCards = remainingCards.filter(cid => cid !== card_id);
      
      // Add to appropriate list
      if (decision === 'pass') {
        passedCards.push(card_id);
      } else if (decision === 'smash' || decision === 'chosen') {
        smashedCards.push(card_id);
      }
    }
    
    // Record vote
    await db.query(
      'INSERT INTO votes (id, session_id, card_id, decision, round) VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), id, card_id, decision, round]
    );
    
    // Check if session should finish or switch mode
    let status = session.status;
    let mode = session.mode;
    
    if (remainingCards.length === 0 && session.mode === 'swipe') {
      // If swipe mode and no remaining cards, move to duel mode or finish
      if (smashedCards.length === 0) {
        status = 'finished';
      } else if (smashedCards.length === 1) {
        status = 'finished';
      } else {
        // Switch to duel mode - use smashed cards as remaining
        mode = 'duel';
        await db.query(
          'UPDATE sessions SET remaining_cards = $1, passed_cards = $2, smashed_cards = $3, mode = $4, status = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
          [JSON.stringify(smashedCards), JSON.stringify(passedCards), JSON.stringify([]), mode, status, id]
        );
      }
    } else if (remainingCards.length === 0 && session.mode === 'duel') {
      // Duel mode finished
      status = 'finished';
      await db.query(
        'UPDATE sessions SET remaining_cards = $1, passed_cards = $2, smashed_cards = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
        [JSON.stringify(remainingCards), JSON.stringify(passedCards), JSON.stringify(smashedCards), status, id]
      );
    } else {
      // Update session normally
      await db.query(
        'UPDATE sessions SET remaining_cards = $1, passed_cards = $2, smashed_cards = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [JSON.stringify(remainingCards), JSON.stringify(passedCards), JSON.stringify(smashedCards), id]
      );
    }
    
    // Get updated session
    const updatedResult = await db.query('SELECT * FROM sessions WHERE id = $1', [id]);
    const updatedSession = updatedResult.rows[0];
    
    // If status changed to finished, include winner info
    if (updatedSession.status === 'finished') {
      const remaining = updatedSession.remaining_cards || [];
      if (remaining.length === 1) {
        const winnerResult = await db.query('SELECT * FROM cards WHERE id = $1', [remaining[0]]);
        updatedSession.winner = winnerResult.rows[0] || null;
      }
    }
    
    res.json(updatedSession);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get duel pair (two cards for battle)
router.post('/:id/duel', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { id } = req.params;
    
    const sessionResult = await db.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessionResult.rows[0];
    const remainingCards = session.remaining_cards || [];
    
    if (remainingCards.length < 2) {
      return res.status(400).json({ error: 'Not enough cards for duel' });
    }
    
    // Randomly select two cards
    const shuffled = [...remainingCards].sort(() => Math.random() - 0.5);
    const pairIds = shuffled.slice(0, 2);
    
    // Get full card details
    const cardsResult = await db.query(
      `SELECT * FROM cards WHERE id = ANY($1::uuid[])`,
      [pairIds]
    );
    
    res.json({
      card1: cardsResult.rows[0],
      card2: cardsResult.rows[1]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Finish session
router.post('/:id/finish', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { id } = req.params;
    
    const result = await db.query(
      'UPDATE sessions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['finished', id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = result.rows[0];
    
    // Get winner card if exists
    let winner = null;
    const remainingCards = session.remaining_cards || [];
    if (remainingCards.length === 1) {
      const winnerResult = await db.query('SELECT * FROM cards WHERE id = $1', [remainingCards[0]]);
      winner = winnerResult.rows[0] || null;
    }
    
    res.json({
      ...session,
      winner
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

