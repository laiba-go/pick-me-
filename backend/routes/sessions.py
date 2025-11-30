from fastapi import APIRouter, HTTPException, Depends
import asyncpg
import uuid
import json
from typing import Optional, List
from pydantic import BaseModel
import random

router = APIRouter()


class SessionCreate(BaseModel):
    user_id: Optional[str] = None
    mode: str = "swipe"


class DecisionCreate(BaseModel):
    card_id: str
    decision: str
    round: int = 1


# keep local get_db to avoid circular import (main imports routes)
async def get_db():
    from main import db_pool
    if db_pool is None:
        raise HTTPException(status_code=500, detail="Database not available")
    return db_pool


# ---- helpers ----
def parse_json_field(field):
    if field is None:
        return []
    if isinstance(field, list):
        return field
    if isinstance(field, str):
        try:
            return json.loads(field)
        except:
            return []
    return []


def to_uuid_list(str_list: List[str]) -> List[uuid.UUID]:
    out = []
    for cid in str_list:
        if isinstance(cid, uuid.UUID):
            out.append(cid)
        elif isinstance(cid, str):
            try:
                out.append(uuid.UUID(cid))
            except Exception:
                # skip invalid uuid strings
                continue
    return out


# ---- routes ----

@router.get("/deck/{deck_id}/active")
async def get_active_session(deck_id: str, db=Depends(get_db)):
    """
    Получает активную (не завершенную) сессию для указанной колоды
    """
    async with db.acquire() as conn:
        session_row = await conn.fetchrow(
            "SELECT * FROM sessions WHERE deck_id = $1 AND status != 'finished' ORDER BY created_at DESC LIMIT 1",
            deck_id
        )
        if session_row:
            return dict(session_row)
        # Возвращаем 404 если активной сессии нет
        raise HTTPException(status_code=404, detail="No active session found")


@router.post("/deck/{deck_id}")
async def create_session(deck_id: str, session: SessionCreate, db=Depends(get_db)):
    async with db.acquire() as conn:
        # Получаем все карточки из колоды
        card_rows = await conn.fetch(
            "SELECT id FROM cards WHERE deck_id = $1 ORDER BY position ASC, created_at ASC",
            deck_id
        )
        all_deck_card_ids = [str(row["id"]) for row in card_rows]
        if not all_deck_card_ids:
            raise HTTPException(status_code=400, detail="Deck has no cards")
        
        # Проверяем, есть ли уже активная сессия для этой колоды
        existing_session = await conn.fetchrow(
            "SELECT * FROM sessions WHERE deck_id = $1 AND status != 'finished' ORDER BY created_at DESC LIMIT 1",
            deck_id
        )
        
        if existing_session:
            # Обновляем существующую сессию, добавляя новые карточки
            existing = dict(existing_session)
            remaining = parse_json_field(existing.get("remaining_cards"))
            smashed = parse_json_field(existing.get("smashed_cards"))
            passed = parse_json_field(existing.get("passed_cards", []))
            mode = existing.get("mode", "swipe")
            
            # Находим все карточки, которые уже есть в сессии
            existing_card_ids = set(remaining + smashed + passed)
            
            # Находим новые карточки, которых нет в сессии
            new_card_ids = [cid for cid in all_deck_card_ids if cid not in existing_card_ids]
            
            # Добавляем новые карточки в remaining_cards
            if new_card_ids:
                if mode == "swipe":
                    # В режиме swipe добавляем новые карточки в remaining
                    remaining = remaining + new_card_ids
                else:
                    # В режиме duel добавляем новые карточки в remaining для будущих батлов
                    remaining = remaining + new_card_ids
                
                # Обновляем сессию с новыми карточками
                await conn.execute(
                    "UPDATE sessions SET remaining_cards = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
                    json.dumps(remaining), existing["id"]
                )
                
                # Получаем обновленную сессию
                updated_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", existing["id"])
                return dict(updated_row)
            
            # Возвращаем существующую сессию без изменений, если новых карточек нет
            return existing
        
        # Создаем новую сессию только если активной нет
        session_id = str(uuid.uuid4())
        row = await conn.fetchrow(
            "INSERT INTO sessions (id, deck_id, user_id, remaining_cards, smashed_cards, passed_cards, mode, status) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
            session_id, deck_id, session.user_id, json.dumps(all_deck_card_ids), json.dumps([]), json.dumps([]), "swipe", "active"
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
        smashed_cards = parse_json_field(session.get("smashed_cards"))
        # Сохраняем существующие passed_cards (мусорку), чтобы карточки не терялись
        passed_cards = parse_json_field(session.get("passed_cards", []))

        if not smashed_cards:
            raise HTTPException(status_code=400, detail="No smashed cards to reswipe")

        await conn.execute(
            "UPDATE sessions SET remaining_cards = $1, smashed_cards = $2, passed_cards = $3, mode = $4, status = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6",
            json.dumps(smashed_cards), json.dumps([]), json.dumps(passed_cards), "swipe", "active", session_id
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
        remaining_ids = parse_json_field(session.get("remaining_cards"))

        # Формируем объекты оставшихся карточек
        remaining_cards = []
        if remaining_ids:
            uuid_list = to_uuid_list(remaining_ids)
            if uuid_list:
                card_rows = await conn.fetch(
                    "SELECT * FROM cards WHERE id = ANY($1::uuid[])",
                    uuid_list
                )
                for row in card_rows:
                    card = dict(row)
                    if isinstance(card.get("metadata"), str):
                        try:
                            card["metadata"] = json.loads(card["metadata"])
                        except:
                            card["metadata"] = {}
                    remaining_cards.append(card)

        # Формируем объекты карточек из passed_cards (мусорка)
        passed_ids = parse_json_field(session.get("passed_cards"))
        passed_cards = []
        if passed_ids:
            uuid_list = to_uuid_list(passed_ids)
            if uuid_list:
                card_rows = await conn.fetch(
                    "SELECT * FROM cards WHERE id = ANY($1::uuid[])",
                    uuid_list
                )
                for row in card_rows:
                    card = dict(row)
                    if isinstance(card.get("metadata"), str):
                        try:
                            card["metadata"] = json.loads(card["metadata"])
                        except:
                            card["metadata"] = {}
                    passed_cards.append(card)

        # Отдаём фронту в camelCase
        session["remainingCards"] = remaining_cards
        session["smashedCards"] = parse_json_field(session.get("smashed_cards"))
        session["passedCards"] = passed_cards  # Теперь это массив объектов, а не ID
        
        # Если осталась одна карта и сессия завершена, определяем победителя
        if session.get("status") == "finished":
            # Проверяем, есть ли уже winner в базе (может быть установлен в record_decision)
            # Если нет, но осталась одна карта - определяем победителя
            if len(remaining_ids) == 1 and not session.get("winner"):
                uuid_list = to_uuid_list(remaining_ids)
                if uuid_list:
                    winner_row = await conn.fetchrow("SELECT * FROM cards WHERE id = $1", uuid_list[0])
                    if winner_row:
                        winner = dict(winner_row)
                        if isinstance(winner.get("metadata"), str):
                            try:
                                winner["metadata"] = json.loads(winner["metadata"])
                            except:
                                winner["metadata"] = {}
                        session["winner"] = winner

        return session

@router.post("/{session_id}/decision")
async def record_decision(session_id: str, decision: DecisionCreate, db=Depends(get_db)):

    if decision.decision not in ["pass", "smash", "chosen"]:
        raise HTTPException(status_code=400, detail="Invalid decision type")

    async with db.acquire() as conn:
        session_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")

        session = dict(session_row)

        if session["status"] == "finished":
            raise HTTPException(status_code=400, detail="Session already finished")

        remaining = parse_json_field(session["remaining_cards"])
        smashed = parse_json_field(session["smashed_cards"])
        passed = parse_json_field(session["passed_cards"])
        mode = session["mode"]

        # ВАЖНО: Исключаем все passed карты из remaining для дополнительной защиты
        # (на случай, если они каким-то образом попали обратно)
        remaining = [cid for cid in remaining if cid not in passed]

        # В режиме батла: убираем карту из оставшихся только если она "pass"
        # В режиме свайпа: убираем карту из оставшихся всегда
        if mode == "duel":
            # В батле: выбранная карта (smash) остается, не выбранная (pass) удаляется
            if decision.decision == "pass":
                remaining = [cid for cid in remaining if cid != decision.card_id]
                if decision.card_id not in passed:
                    passed.append(decision.card_id)
            else:
                # Карта выбрана (smash) - остается в remaining, добавляем в smashed для истории
                if decision.card_id not in smashed:
                    smashed.append(decision.card_id)
        else:
            # Режим свайпа: убираем карту из оставшихся всегда
            remaining = [cid for cid in remaining if cid != decision.card_id]
            # Добавляем карту в выбранные или пропущенные
            if decision.decision == "pass":
                passed.append(decision.card_id)
            else:
                if decision.card_id not in smashed:
                    smashed.append(decision.card_id)

        # Сохраняем голос
        vote_id = str(uuid.uuid4())
        await conn.execute(
            """
            INSERT INTO votes (id, session_id, card_id, decision, round)
            VALUES ($1,$2,$3,$4,$5)
            """,
            vote_id, session_id, decision.card_id, decision.decision, decision.round
        )

        status = session["status"]

        # Определяем статус после последнего свайпа
        if not remaining and mode == "swipe":
            status = "finished" if len(smashed) < 2 else "active"
        
        # В режиме батла: если осталась одна карта, она становится победителем
        if mode == "duel" and len(remaining) == 1:
            status = "finished"

        # Обновляем сессию в базе
        await conn.execute(
            """
            UPDATE sessions
            SET remaining_cards = $1,
                smashed_cards = $2,
                passed_cards = $3,
                status = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            """,
            json.dumps(remaining),
            json.dumps(smashed),
            json.dumps(passed),
            status,
            session_id
        )

        # Получаем актуальные данные
        updated = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        updated = dict(updated)

        # Формируем объекты оставшихся карточек
        remaining_cards_list = []
        if remaining:
            uuid_ids = to_uuid_list(remaining)
            if uuid_ids:
                card_rows = await conn.fetch(
                    "SELECT * FROM cards WHERE id = ANY($1::uuid[])",
                    uuid_ids
                )
                for c in card_rows:
                    card = dict(c)
                    if isinstance(card.get("metadata"), str):
                        try:
                            card["metadata"] = json.loads(card["metadata"])
                        except:
                            card["metadata"] = {}
                    remaining_cards_list.append(card)
        updated["remainingCards"] = remaining_cards_list

        # Формируем объекты карточек из passed_cards (мусорка)
        passed_cards_list = []
        if passed:
            uuid_ids = to_uuid_list(passed)
            if uuid_ids:
                card_rows = await conn.fetch(
                    "SELECT * FROM cards WHERE id = ANY($1::uuid[])",
                    uuid_ids
                )
                for c in card_rows:
                    card = dict(c)
                    if isinstance(card.get("metadata"), str):
                        try:
                            card["metadata"] = json.loads(card["metadata"])
                        except:
                            card["metadata"] = {}
                    passed_cards_list.append(card)
        
        # Формируем списки для фронта
        updated["smashedCards"] = smashed
        updated["passedCards"] = passed_cards_list  # Теперь это массив объектов, а не ID

        # Автоматический победитель, если выбрана только 1 карта (swipe mode)
        if updated["status"] == "finished" and len(smashed) == 1 and mode == "swipe":
            winner_row = await conn.fetchrow(
                "SELECT * FROM cards WHERE id = $1", smashed[0]
            )
            if winner_row:
                winner = dict(winner_row)
                if isinstance(winner.get("metadata"), str):
                    try:
                        winner["metadata"] = json.loads(winner["metadata"])
                    except:
                        winner["metadata"] = {}
                updated["winner"] = winner
        
        # Автоматический победитель в режиме батла, если осталась одна карта
        if updated["status"] == "finished" and len(remaining) == 1 and mode == "duel":
            winner_row = await conn.fetchrow(
                "SELECT * FROM cards WHERE id = $1", remaining[0]
            )
            if winner_row:
                winner = dict(winner_row)
                if isinstance(winner.get("metadata"), str):
                    try:
                        winner["metadata"] = json.loads(winner["metadata"])
                    except:
                        winner["metadata"] = {}
                updated["winner"] = winner

        return updated




@router.post("/{session_id}/duel")
async def get_duel_pair(session_id: str, db=Depends(get_db)):
    async with db.acquire() as conn:
        session_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")

        session = dict(session_row)
        remaining = parse_json_field(session["remaining_cards"])
        passed = parse_json_field(session.get("passed_cards", []))

        # Исключаем карты, которые уже были исключены (passed) - для дополнительной безопасности
        remaining = [cid for cid in remaining if cid not in passed]

        if len(remaining) < 2:
            raise HTTPException(status_code=400, detail="Not enough cards for duel")

        # случайная пара из remaining (только активные карты, не исключенные)
        pair_ids = random.sample(remaining, 2)
        uuid_ids = to_uuid_list(pair_ids)

        card_rows = await conn.fetch(
            "SELECT * FROM cards WHERE id = ANY($1::uuid[])",
            uuid_ids
        )

        cards = []
        for c in card_rows:
            card = dict(c)
            if isinstance(card.get("metadata"), str):
                try:
                    card["metadata"] = json.loads(card["metadata"])
                except:
                    card["metadata"] = {}
            cards.append(card)

        return {"card1": cards[0], "card2": cards[1]}




@router.post("/{session_id}/start-duel")
async def start_duel(session_id: str, db=Depends(get_db)):
    """
    Switch session to duel mode: move smashed_cards -> remaining_cards, clear smashed.
    Если сессия уже в режиме duel, просто возвращает её без изменений.
    """
    async with db.acquire() as conn:
        session_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")

        session = dict(session_row)
        mode = session.get("mode", "swipe")
        
        # Если сессия уже в режиме duel, просто возвращаем её
        if mode == "duel":
            remaining = parse_json_field(session.get("remaining_cards"))
            if len(remaining) < 2:
                raise HTTPException(status_code=400, detail="Not enough cards for duel")
            return session
        
        # Переключаем из режима swipe в duel
        smashed = parse_json_field(session.get("smashed_cards"))
        # Сохраняем существующие passed_cards (мусорку), чтобы карточки не терялись
        passed = parse_json_field(session.get("passed_cards", []))

        if len(smashed) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 smashed cards for duel")

        await conn.execute(
            "UPDATE sessions SET remaining_cards = $1, smashed_cards = $2, passed_cards = $3, mode = $4, status = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6",
            json.dumps(smashed), json.dumps([]), json.dumps(passed), "duel", "active", session_id
        )

        updated_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        return dict(updated_row)


@router.post("/{session_id}/return-to-swipe")
async def return_to_swipe(session_id: str, db=Depends(get_db)):
    """
    Переключает сессию из режима duel обратно в режим swipe.
    Объединяет remaining_cards обратно в smashed_cards для свайпа.
    """
    async with db.acquire() as conn:
        session_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")

        session = dict(session_row)
        remaining = parse_json_field(session.get("remaining_cards"))
        # Сохраняем существующие passed_cards (мусорку), чтобы карточки не терялись
        passed = parse_json_field(session.get("passed_cards", []))

        # В режиме duel remaining_cards содержат карты для батла
        # При возврате к свайпу перемещаем их обратно в smashed_cards
        # и делаем их remaining для свайпа
        smashed_for_swipe = remaining.copy()

        await conn.execute(
            "UPDATE sessions SET remaining_cards = $1, smashed_cards = $2, passed_cards = $3, mode = $4, status = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6",
            json.dumps(smashed_for_swipe), json.dumps(smashed_for_swipe), json.dumps(passed), "swipe", "active", session_id
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
        remaining = parse_json_field(session.get("remaining_cards"))
        if len(remaining) == 1:
            winner_row = await conn.fetchrow("SELECT * FROM cards WHERE id = $1", remaining[0])
            if winner_row:
                winner = dict(winner_row)
                if isinstance(winner.get("metadata"), str):
                    try:
                        winner["metadata"] = json.loads(winner["metadata"])
                    except:
                        winner["metadata"] = {}
                session["winner"] = winner
        return session


class RestoreCardRequest(BaseModel):
    card_id: str


@router.post("/{session_id}/restore")
async def restore_card_from_trash(session_id: str, request: RestoreCardRequest, db=Depends(get_db)):
    """
    Восстанавливает карточку из мусорки (passed_cards) обратно в remaining_cards
    """
    async with db.acquire() as conn:
        session_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        if not session_row:
            raise HTTPException(status_code=404, detail="Session not found")

        session = dict(session_row)

        if session["status"] == "finished":
            raise HTTPException(status_code=400, detail="Cannot restore cards from finished session")

        remaining = parse_json_field(session["remaining_cards"])
        passed = parse_json_field(session["passed_cards"])

        # Проверяем, что карта действительно в мусорке
        if request.card_id not in passed:
            raise HTTPException(status_code=400, detail="Card is not in trash")

        # Удаляем карту из passed
        passed = [cid for cid in passed if cid != request.card_id]

        # Добавляем карту обратно в remaining
        if request.card_id not in remaining:
            remaining.append(request.card_id)

        # Обновляем сессию
        await conn.execute(
            """
            UPDATE sessions
            SET remaining_cards = $1,
                passed_cards = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            """,
            json.dumps(remaining),
            json.dumps(passed),
            session_id
        )

        # Получаем обновленную сессию
        updated_row = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
        updated = dict(updated_row)

        # Формируем ответ
        updated["remainingCards"] = remaining
        updated["passedCards"] = passed

        return updated

