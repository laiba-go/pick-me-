const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { user_id } = req.query;
    
    let query = 'SELECT * FROM decks WHERE privacy = $1';
    const params = ['public'];
    
    if (user_id) {
      query = 'SELECT * FROM decks WHERE user_id = $1 OR privacy = $2 ORDER BY created_at DESC';
      params[0] = user_id;
      params[1] = 'public';
    }
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { id } = req.params;
    
    const result = await db.query('SELECT * FROM decks WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { title, description, privacy = 'private', user_id = null } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const result = await db.query(
      'INSERT INTO decks (id, user_id, title, description, privacy) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [uuidv4(), user_id, title, description, privacy]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { db } = req.app.locals;
    const { id } = req.params;
    const { title, description, privacy } = req.body;
    
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
    if (privacy !== undefined) {
      updates.push(`privacy = $${paramCount++}`);
      values.push(privacy);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `UPDATE decks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
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
    
    const result = await db.query('DELETE FROM decks WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }
    
    res.json({ message: 'Deck deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

