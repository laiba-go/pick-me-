# PickMe - Setup Guide

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development, optional)

## Quick Start

1. **Clone the repository** (if not already done)
   ```bash
   cd pick-me-
   ```

2. **Start all services with Docker Compose**
   ```bash
   docker-compose up --build
   ```

   This will start:
   - PostgreSQL database on port 5432
   - Redis cache on port 6379
   - Backend API on port 3001
   - Frontend React app on port 3000

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health check: http://localhost:3001/health

## Development

### Backend Development

The backend is located in the `backend/` directory and uses:
- Python 3.11 + FastAPI + Uvicorn
- PostgreSQL for data storage
- Redis for caching

To run backend locally (without Docker):
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 3001 --reload
```

Make sure PostgreSQL and Redis are running, and set up `.env` file based on `env.example`.

### Frontend Development

The frontend is located in the `frontend/` directory and uses:
- React 18
- React Router for navigation
- Axios for API calls

To run frontend locally (without Docker):
```bash
cd frontend
npm install
npm start
```

## Database

The database schema is automatically initialized when the PostgreSQL container starts for the first time. The init script is located at `backend/db/init.sql`.

### Database Schema

- **users**: User accounts (optional for guest mode)
- **decks**: Collections of cards
- **cards**: Individual items to choose from
- **sessions**: Active selection sessions
- **votes**: Individual decisions/choices

## API Endpoints

### Decks
- `GET /api/v1/decks` - List all decks
- `POST /api/v1/decks` - Create a new deck
- `GET /api/v1/decks/:id` - Get deck details
- `PUT /api/v1/decks/:id` - Update deck
- `DELETE /api/v1/decks/:id` - Delete deck

### Cards
- `GET /api/v1/cards/deck/:deckId` - Get all cards in a deck
- `POST /api/v1/cards` - Create a card
- `POST /api/v1/cards/deck/:deckId/bulk` - Create multiple cards
- `PUT /api/v1/cards/:id` - Update card
- `DELETE /api/v1/cards/:id` - Delete card

### Sessions
- `POST /api/v1/sessions/deck/:deckId` - Create a new session
- `GET /api/v1/sessions/:id/state` - Get session state
- `POST /api/v1/sessions/:id/decision` - Record a decision (pass/smash)
- `POST /api/v1/sessions/:id/duel` - Get a pair for duel
- `POST /api/v1/sessions/:id/finish` - Finish session

## Usage Flow

1. **Create a Deck**: Go to the home page and click "Create New Deck"
2. **Add Cards**: Add cards to your deck with titles, descriptions, and optional images
3. **Start Swiping**: Click "Start Choosing" to begin the swipe phase
4. **Swipe Phase**: Swipe left (Pass) or right (Smash) on each card
5. **Duel Phase**: After swiping, remaining cards enter battle mode (1v1)
6. **Winner**: The final card is declared the winner!

## Stopping the Application

Press `Ctrl+C` in the terminal, or run:
```bash
docker-compose down
```

To remove all data (including database):
```bash
docker-compose down -v
```

## Troubleshooting

### Port already in use
If ports 3000, 3001, 5432, or 6379 are already in use, you can modify the port mappings in `docker-compose.yml`.

### Database connection errors
Make sure the database container is healthy before starting the backend. The health checks should handle this automatically.

### Frontend can't connect to backend
Check that `REACT_APP_API_URL` in `docker-compose.yml` matches your backend URL. In development, the proxy in `package.json` should handle this.

## Production Deployment

For production:
1. Update environment variables in `docker-compose.yml`
2. Use strong passwords for database
3. Set `NODE_ENV=production`
4. Build optimized frontend: `cd frontend && npm run build`
5. Consider using a reverse proxy (nginx) for production
6. Set up proper SSL/TLS certificates

