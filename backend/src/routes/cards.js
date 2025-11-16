const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

router.get('/deck/:deckId', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { deckId } = req.params;
    
    const result = await db.query(
      'SELECT * FROM cards WHERE deck_id = $1 ORDER BY position ASC, created_at ASC',
      [deckId]
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { id } = req.params;
    
    const result = await db.query('SELECT * FROM cards WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { deck_id, title, description, image_url, metadata = {}, position } = req.body;
    
    if (!deck_id || !title) {
      return res.status(400).json({ error: 'deck_id and title are required' });
    }
    
    const result = await db.query(
      'INSERT INTO cards (id, deck_id, title, description, image_url, metadata, position) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [uuidv4(), deck_id, title, description, image_url, JSON.stringify(metadata), position]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/deck/:deckId/bulk', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { deckId } = req.params;
    const { cards } = req.body;
    
    if (!Array.isArray(cards)) {
      return res.status(400).json({ error: 'cards must be an array' });
    }
    
    const insertedCards = [];
    
    for (const card of cards) {
      const { title, description, image_url, metadata = {}, position } = card;
      if (!title) continue;
      
      const result = await db.query(
        'INSERT INTO cards (id, deck_id, title, description, image_url, metadata, position) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [uuidv4(), deckId, title, description, image_url, JSON.stringify(metadata), position]
      );
      insertedCards.push(result.rows[0]);
    }
    
    res.status(201).json(insertedCards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { id } = req.params;
    const { title, description, image_url, metadata, position } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramCount++}`);
      values.push(image_url);
    }
    if (metadata !== undefined) {
      updates.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(metadata));
    }
    if (position !== undefined) {
      updates.push(`position = $${paramCount++}`);
      values.push(position);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `UPDATE cards SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM cards WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

