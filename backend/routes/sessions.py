from fastapi import APIRouter, HTTPException, Depends
import asyncpg
import uuid
import json
from typing import Optional
from pydantic import BaseModel

router = APIRouter()


class SessionCreate(BaseModel):
    user_id: Optional[str] = None
    mode: str = "swipe"


class DecisionCreate(BaseModel):
    card_id: str
    decision: str
    round: int = 1


async def get_db():
    from main import db_pool
    if db_pool is None:
        raise HTTPException(status_code=500, detail="Database not available")
    return db_pool


@router.post("/deck/{deck_id}")
async def create_session(deck_id: str, session: SessionCreate, db=Depends(get_db)):
    async with db.acquire() as conn:
        # Get all cards from the deck
        card_rows = await conn.fetch(
            "SELECT id FROM cards WHERE deck_id = $1 ORDER BY position ASC, created_at ASC",
            deck_id
        )
        
        card_ids = [str(row["id"]) for row in card_rows]
        
        if not card_ids:
            raise HTTPException(status_code=400, detail="Deck has no cards")
        
        # Create session
        session_id = str(uuid.uuid4())
        row = await conn.fetchrow(
            "INSERT INTO sessions (id, deck_id, user_id, remaining_cards, mode, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            session_id, deck_id, session.user_id, json.dumps(card_ids), session.mode, "active"
        )
        return dict(row)


@router.post("/{session_id}/reswipe")
async def reswipe_session(session_id: str, db=Depends(get_db)):
    """Reset session to reswipe smashed cards"""
    async with db.acquire() as conn:
        session_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = dict(session_row)
        smashed_cards = session.get("smashed_cards", [])
        
        if isinstance(smashed_cards, str):
            smashed_cards = json.loads(smashed_cards)
        elif not isinstance(smashed_cards, list):
            smashed_cards = []
        
        if not smashed_cards:
            raise HTTPException(status_code=400, detail="No smashed cards to reswipe")
        
        # Reset remaining cards to smashed cards and clear smashed
        await conn.execute(
            "UPDATE sessions SET remaining_cards = $1, smashed_cards = $2, mode = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
            json.dumps(smashed_cards), json.dumps([]), "swipe", session_id
        )
        
        updated_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        return dict(updated_row)


@router.get("/{session_id}/state")
async def get_session_state(session_id: str, db=Depends(get_db)):
    async with db.acquire() as conn:
        session_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = dict(session_row)
        
        # Get full card details for remaining cards
        remaining_ids = session.get("remaining_cards", [])
        if remaining_ids is None:
            remaining_ids = []
        if isinstance(remaining_ids, str):
            remaining_ids = json.loads(remaining_ids)
        elif not isinstance(remaining_ids, list):
            remaining_ids = []
        
        remaining_cards = []
        if remaining_ids:
            # Convert string UUIDs to UUID objects for PostgreSQL
            uuid_list = [uuid.UUID(cid) if isinstance(cid, str) else cid for cid in remaining_ids]
            card_rows = await conn.fetch(
                "SELECT * FROM cards WHERE id = ANY($1::uuid[])",
                uuid_list
            )
            for row in card_rows:
                card = {k: v for k, v in row.items()}
                if isinstance(card.get("metadata"), str):
                    try:
                        card["metadata"] = json.loads(card["metadata"])
                    except:
                        card["metadata"] = {}
                remaining_cards.append(card)
        
        session["remainingCards"] = remaining_cards
        return session


@router.post("/{session_id}/decision")
async def record_decision(session_id: str, decision: DecisionCreate, db=Depends(get_db)):
    try:
        if not decision.card_id or not decision.decision:
            raise HTTPException(status_code=400, detail="card_id and decision are required")
        
        if decision.decision not in ["pass", "smash", "chosen"]:
            raise HTTPException(status_code=400, detail="decision must be pass, smash, or chosen")
        
        async with db.acquire() as conn:
            # Get current session
            session_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
            if not session_row:
                raise HTTPException(status_code=404, detail="Session not found")
            
            session = dict(session_row)
            if session["status"] == "finished":
                raise HTTPException(status_code=400, detail="Session is already finished")
            
            remaining_cards = session.get("remaining_cards", [])
            passed_cards = session.get("passed_cards", [])
            smashed_cards = session.get("smashed_cards", [])
            
            # Parse JSON fields if they are strings
            if remaining_cards is None:
                remaining_cards = []
            elif isinstance(remaining_cards, str):
                remaining_cards = json.loads(remaining_cards)
            elif not isinstance(remaining_cards, list):
                remaining_cards = []
                
            if passed_cards is None:
                passed_cards = []
            elif isinstance(passed_cards, str):
                passed_cards = json.loads(passed_cards)
            elif not isinstance(passed_cards, list):
                passed_cards = []
                
            if smashed_cards is None:
                smashed_cards = []
            elif isinstance(smashed_cards, str):
                smashed_cards = json.loads(smashed_cards)
            elif not isinstance(smashed_cards, list):
                smashed_cards = []
            
            # In duel mode, remove card from remaining for any decision
            # In swipe mode, remove all cards from remaining
            if session["mode"] == "duel":
                remaining_cards = [cid for cid in remaining_cards if cid != decision.card_id]
                if decision.decision == "pass":
                    passed_cards.append(decision.card_id)
                elif decision.decision in ["smash", "chosen"]:
                    if decision.card_id not in smashed_cards:
                        smashed_cards.append(decision.card_id)
            else:
                # Swipe mode: remove card from remaining
                remaining_cards = [cid for cid in remaining_cards if cid != decision.card_id]
                if decision.decision == "pass":
                    passed_cards.append(decision.card_id)
                elif decision.decision in ["smash", "chosen"]:
                    smashed_cards.append(decision.card_id)
            
            # Record vote
            vote_id = str(uuid.uuid4())
            await conn.execute(
                "INSERT INTO votes (id, session_id, card_id, decision, round) VALUES ($1, $2, $3, $4, $5)",
                vote_id, session_id, decision.card_id, decision.decision, decision.round
            )
            
            # Check if session should finish or switch mode
            status = session["status"]
            
            # Check if session should finish
            if not remaining_cards and session["mode"] == "swipe":
                if not smashed_cards:
                    status = "finished"
                elif len(smashed_cards) == 1:
                    # Move winner to remaining_cards for proper winner detection
                    remaining_cards = smashed_cards
                    smashed_cards = []
                    status = "finished"
                # Don't auto-switch to duel mode, let user choose
            elif not remaining_cards and session["mode"] == "duel":
                # Duel mode finished
                status = "finished"
            
            # Update session (always update, even if status changed)
            await conn.execute(
                "UPDATE sessions SET remaining_cards = $1, passed_cards = $2, smashed_cards = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5",
                json.dumps(remaining_cards), json.dumps(passed_cards), json.dumps(smashed_cards), status, session_id
            )
            
            # Get updated session with full card details
            updated_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
            updated_session = dict(updated_row)
            
            # Get remaining cards details
            remaining_cards_list = []
            if remaining_cards:
                # Convert string UUIDs to UUID objects for PostgreSQL
                uuid_list = [uuid.UUID(cid) if isinstance(cid, str) else cid for cid in remaining_cards]
                card_rows = await conn.fetch(
                    "SELECT * FROM cards WHERE id = ANY($1::uuid[])",
                    uuid_list
                )
                for row in card_rows:
                    card = {k: v for k, v in row.items()}
                    if isinstance(card.get("metadata"), str):
                        try:
                            card["metadata"] = json.loads(card["metadata"])
                        except:
                            card["metadata"] = {}
                    remaining_cards_list.append(card)
            
            updated_session["remainingCards"] = remaining_cards_list
            
            # If status changed to finished, include winner info
            if updated_session["status"] == "finished":
                remaining = updated_session.get("remaining_cards", [])
                if remaining is None:
                    remaining = []
                elif isinstance(remaining, str):
                    remaining = json.loads(remaining)
                elif not isinstance(remaining, list):
                    remaining = []
                if len(remaining) == 1:
                    winner_row = await conn.fetchrow("SELECT * FROM cards WHERE id = $1", remaining[0])
                    if winner_row:
                        winner = {k: v for k, v in winner_row.items()}
                        if isinstance(winner.get("metadata"), str):
                            try:
                                winner["metadata"] = json.loads(winner["metadata"])
                            except:
                                winner["metadata"] = {}
                        updated_session["winner"] = winner
            
            return updated_session
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in record_decision: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{session_id}/duel")
async def get_duel_pair(session_id: str, db=Depends(get_db)):
    async with db.acquire() as conn:
        session_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = dict(session_row)
        remaining_cards = session.get("remaining_cards", [])
        if isinstance(remaining_cards, str):
            remaining_cards = json.loads(remaining_cards)
        
        if len(remaining_cards) < 2:
            raise HTTPException(status_code=400, detail="Not enough cards for duel")
        
        # Randomly select two cards
        import random
        pair_ids = random.sample(remaining_cards, 2)
        
        # Convert string UUIDs to UUID objects for PostgreSQL
        uuid_list = [uuid.UUID(cid) if isinstance(cid, str) else cid for cid in pair_ids]
        
        # Get full card details
        card_rows = await conn.fetch(
            "SELECT * FROM cards WHERE id = ANY($1::uuid[])",
            uuid_list
        )
        cards = []
        for row in card_rows:
            card = {k: v for k, v in row.items()}
            if isinstance(card.get("metadata"), str):
                try:
                    card["metadata"] = json.loads(card["metadata"])
                except:
                    card["metadata"] = {}
            cards.append(card)
        
        return {
            "card1": cards[0],
            "card2": cards[1]
        }


@router.post("/{session_id}/start-duel")
async def start_duel(session_id: str, db=Depends(get_db)):
    """Switch session to duel mode"""
    async with db.acquire() as conn:
        session_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = dict(session_row)
        smashed_cards = session.get("smashed_cards", [])
        
        if isinstance(smashed_cards, str):
            smashed_cards = json.loads(smashed_cards)
        elif not isinstance(smashed_cards, list):
            smashed_cards = []
        
        if len(smashed_cards) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 smashed cards for duel")
        
        # Switch to duel mode
        await conn.execute(
            "UPDATE sessions SET remaining_cards = $1, smashed_cards = $2, mode = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
            json.dumps(smashed_cards), json.dumps([]), "duel", session_id
        )
        
        updated_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        return dict(updated_row)


@router.post("/{session_id}/finish")
async def finish_session(session_id: str, db=Depends(get_db)):
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE sessions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
            "finished", session_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = dict(row)
        
        # Get winner card if exists
        remaining = session.get("remaining_cards", [])
        if remaining is None:
            remaining = []
        elif isinstance(remaining, str):
            remaining = json.loads(remaining)
        elif not isinstance(remaining, list):
            remaining = []
        if len(remaining) == 1:
            winner_row = await conn.fetchrow("SELECT * FROM cards WHERE id = $1", remaining[0])
            if winner_row:
                winner = {k: v for k, v in winner_row.items()}
                if isinstance(winner.get("metadata"), str):
                    try:
                        winner["metadata"] = json.loads(winner["metadata"])
                    except:
                        winner["metadata"] = {}
                session["winner"] = winner
        
        return session
