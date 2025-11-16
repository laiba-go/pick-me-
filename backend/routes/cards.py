from fastapi import APIRouter, HTTPException, Depends
import asyncpg
import uuid
import json
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter()


class CardCreate(BaseModel):
    deck_id: str
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    metadata: dict = {}
    position: Optional[int] = None


class CardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    metadata: Optional[dict] = None
    position: Optional[int] = None


class CardBulkCreate(BaseModel):
    cards: List[CardCreate]


async def get_db():
    from main import db_pool
    if db_pool is None:
        raise HTTPException(status_code=500, detail="Database not available")
    return db_pool


@router.get("/deck/{deck_id}")
async def get_cards(deck_id: str, db=Depends(get_db)):
    async with db.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM cards WHERE deck_id = $1 ORDER BY position ASC, created_at ASC",
            deck_id
        )
        result = []
        for row in rows:
            card = {k: v for k, v in row.items()}
            # Parse metadata if it's a string
            if isinstance(card.get("metadata"), str):
                try:
                    card["metadata"] = json.loads(card["metadata"])
                except:
                    card["metadata"] = {}
            result.append(card)
        return result


@router.get("/{card_id}")
async def get_card(card_id: str, db=Depends(get_db)):
    async with db.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM cards WHERE id = $1", card_id)
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")
        card = {k: v for k, v in row.items()}
        # Parse metadata if it's a string
        if isinstance(card.get("metadata"), str):
            try:
                card["metadata"] = json.loads(card["metadata"])
            except:
                card["metadata"] = {}
        return card


@router.post("/")
async def create_card(card: CardCreate, db=Depends(get_db)):
    if not card.deck_id or not card.title:
        raise HTTPException(status_code=400, detail="deck_id and title are required")
    
    card_id = str(uuid.uuid4())
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO cards (id, deck_id, title, description, image_url, metadata, position) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
            card_id, card.deck_id, card.title, card.description, card.image_url, json.dumps(card.metadata), card.position
        )
        result = {k: v for k, v in row.items()}
        if isinstance(result.get("metadata"), str):
            try:
                result["metadata"] = json.loads(result["metadata"])
            except:
                result["metadata"] = {}
        return result


@router.post("/deck/{deck_id}/bulk")
async def create_cards_bulk(deck_id: str, bulk: CardBulkCreate, db=Depends(get_db)):
    if not isinstance(bulk.cards, list):
        raise HTTPException(status_code=400, detail="cards must be an array")
    
    inserted_cards = []
    async with db.acquire() as conn:
        for card in bulk.cards:
            if not card.title:
                continue
            
            card_id = str(uuid.uuid4())
            row = await conn.fetchrow(
                "INSERT INTO cards (id, deck_id, title, description, image_url, metadata, position) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
                card_id, deck_id, card.title, card.description, card.image_url, json.dumps(card.metadata), card.position
            )
            result = {k: v for k, v in row.items()}
            if isinstance(result.get("metadata"), str):
                try:
                    result["metadata"] = json.loads(result["metadata"])
                except:
                    result["metadata"] = {}
            inserted_cards.append(result)
    
    return inserted_cards


@router.put("/{card_id}")
async def update_card(card_id: str, card: CardUpdate, db=Depends(get_db)):
    async with db.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM cards WHERE id = $1", card_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Card not found")
        
        updates = []
        values = []
        param_count = 1
        
        if card.title is not None:
            updates.append(f"title = ${param_count}")
            values.append(card.title)
            param_count += 1
        if card.description is not None:
            updates.append(f"description = ${param_count}")
            values.append(card.description)
            param_count += 1
        if card.image_url is not None:
            updates.append(f"image_url = ${param_count}")
            values.append(card.image_url)
            param_count += 1
        if card.metadata is not None:
            updates.append(f"metadata = ${param_count}")
            values.append(json.dumps(card.metadata))
            param_count += 1
        if card.position is not None:
            updates.append(f"position = ${param_count}")
            values.append(card.position)
            param_count += 1
        
        if not updates:
            return dict(existing)
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        values.append(card_id)
        
        query = f"UPDATE cards SET {', '.join(updates)} WHERE id = ${param_count} RETURNING *"
        row = await conn.fetchrow(query, *values)
        result = {k: v for k, v in row.items()}
        if isinstance(result.get("metadata"), str):
            try:
                result["metadata"] = json.loads(result["metadata"])
            except:
                result["metadata"] = {}
        return result


@router.delete("/{card_id}")
async def delete_card(card_id: str, db=Depends(get_db)):
    async with db.acquire() as conn:
        row = await conn.fetchrow("DELETE FROM cards WHERE id = $1 RETURNING *", card_id)
        if not row:
            raise HTTPException(status_code=404, detail="Card not found")
        return {"message": "Card deleted successfully"}

