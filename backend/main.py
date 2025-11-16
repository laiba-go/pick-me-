from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
import asyncpg
import redis.asyncio as redis
from typing import Optional

from routes import decks, cards, sessions

load_dotenv()

# Database connection pool
db_pool: Optional[asyncpg.Pool] = None
redis_client: Optional[redis.Redis] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global db_pool, redis_client
    
    # Create database pool
    db_pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        user=os.getenv("DB_USER", "pickme"),
        password=os.getenv("DB_PASSWORD", "pickme_password"),
        database=os.getenv("DB_NAME", "pickme_db"),
        min_size=1,
        max_size=10,
    )
    
    # Create Redis client
    try:
        redis_client = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", "6379")),
            decode_responses=True,
            socket_connect_timeout=5,
        )
        await redis_client.ping()
        print("Redis connected")
    except Exception as e:
        print(f"Redis connection failed (continuing without cache): {e}")
        redis_client = None
    
    yield
    
    # Shutdown
    if db_pool:
        await db_pool.close()
    if redis_client:
        await redis_client.close()


app = FastAPI(
    title="PickMe API",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency to get database pool
async def get_db():
    if db_pool is None:
        raise HTTPException(status_code=500, detail="Database not available")
    return db_pool


# Dependency to get Redis client
async def get_redis():
    return redis_client


# Health check
@app.get("/health")
async def health_check(db=Depends(get_db)):
    try:
        async with db.acquire() as conn:
            await conn.fetchval("SELECT 1")
        
        redis_status = "disconnected"
        if redis_client:
            try:
                await redis_client.ping()
                redis_status = "connected"
            except:
                pass
        
        return {
            "status": "ok",
            "db": "connected",
            "redis": redis_status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Include routers
app.include_router(decks.router, prefix="/api/v1/decks", tags=["decks"])
app.include_router(cards.router, prefix="/api/v1/cards", tags=["cards"])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["sessions"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "3001")),
        reload=True
    )

