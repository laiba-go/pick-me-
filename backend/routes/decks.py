from fastapi import APIRouter, HTTPException, Depends
import asyncpg
import uuid
from typing import Optional
from pydantic import BaseModel

router = APIRouter()


class DeckCreate(BaseModel):
    title: str
    description: Optional[str] = None
    privacy: str = "private"
    user_id: Optional[str] = None


class DeckUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    privacy: Optional[str] = None


async def get_db():
    from main import db_pool
    if db_pool is None:
        raise HTTPException(status_code=500, detail="Database not available")
    return db_pool


@router.get("/")
async def get_decks(user_id: Optional[str] = None, db=Depends(get_db)):
    async with db.acquire() as conn:
        if user_id:
            rows = await conn.fetch(
                "SELECT * FROM decks WHERE user_id = $1 OR privacy = $2 ORDER BY created_at DESC",
                user_id, "public"
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM decks WHERE privacy = $1 ORDER BY created_at DESC",
                "public"
            )
        result = []
        for row in rows:
            result.append({k: v for k, v in row.items()})
        return result


@router.get("/{deck_id}")
async def get_deck(deck_id: str, db=Depends(get_db)):
    async with db.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM decks WHERE id = $1", deck_id)
        if not row:
            raise HTTPException(status_code=404, detail="Deck not found")
        return dict(row)


@router.post("/")
async def create_deck(deck: DeckCreate, db=Depends(get_db)):
    if not deck.title:
        raise HTTPException(status_code=400, detail="Title is required")
    
    deck_id = str(uuid.uuid4())
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO decks (id, user_id, title, description, privacy) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            deck_id, deck.user_id, deck.title, deck.description, deck.privacy
        )
        return dict(row)


@router.put("/{deck_id}")
async def update_deck(deck_id: str, deck: DeckUpdate, db=Depends(get_db)):
    async with db.acquire() as conn:
        # Get existing deck
        existing = await conn.fetchrow("SELECT * FROM decks WHERE id = $1", deck_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Deck not found")
        
        # Build update query
        updates = []
        values = []
        param_count = 1
        
        if deck.title is not None:
            updates.append(f"title = ${param_count}")
            values.append(deck.title)
            param_count += 1
        if deck.description is not None:
            updates.append(f"description = ${param_count}")
            values.append(deck.description)
            param_count += 1
        if deck.privacy is not None:
            updates.append(f"privacy = ${param_count}")
            values.append(deck.privacy)
            param_count += 1
        
        if not updates:
            return dict(existing)
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        values.append(deck_id)
        
        query = f"UPDATE decks SET {', '.join(updates)} WHERE id = ${param_count} RETURNING *"
        row = await conn.fetchrow(query, *values)
        return dict(row)


@router.delete("/{deck_id}")
async def delete_deck(deck_id: str, db=Depends(get_db)):
    async with db.acquire() as conn:
        row = await conn.fetchrow("DELETE FROM decks WHERE id = $1 RETURNING *", deck_id)
        if not row:
            raise HTTPException(status_code=404, detail="Deck not found")
        return {"message": "Deck deleted successfully"}

