require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const redis = require('redis');

const deckRoutes = require('./routes/decks');
const cardRoutes = require('./routes/cards');
const sessionRoutes = require('./routes/sessions');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'pickme',
  password: process.env.DB_PASSWORD || 'pickme_password',
  database: process.env.DB_NAME || 'pickme_db',
});

// Redis connection
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    family: 4, // Force IPv4
  },
});

redisClient.on('error', (err) => {
  console.log('Redis Client Error:', err.message);
  // Redis is optional for MVP, so we continue without it
});

// Connect to Redis (non-blocking)
redisClient.connect().catch((err) => {
  console.log('Redis connection failed (continuing without cache):', err.message);
});

// Make db and redis available to routes
app.locals.db = pool;
app.locals.redis = redisClient;

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    let redisStatus = 'disconnected';
    try {
      await redisClient.ping();
      redisStatus = 'connected';
    } catch (redisError) {
      // Redis is optional, so we don't fail the health check
      redisStatus = 'disconnected';
    }
    res.json({ status: 'ok', db: 'connected', redis: redisStatus });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// API Routes
app.use('/api/v1/decks', deckRoutes);
app.use('/api/v1/cards', cardRoutes);
app.use('/api/v1/sessions', sessionRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  await redisClient.quit();
  process.exit(0);
});

