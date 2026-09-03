from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, and_
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.game_score import GameScore
from app.models.user import User
from app.schemas.game_score import (
    GameScoreCreate,
    GameScoreResponse,
    LeaderboardResponse,
    LeaderboardEntry,
)

router = APIRouter(prefix="/games", tags=["Games"])


@router.post("/scores", response_model=GameScoreResponse, status_code=201)
def submit_score(
    data: GameScoreCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a game score"""
    if data.score < 0:
        raise HTTPException(status_code=400, detail="Score cannot be negative")

    lowest_score = db.execute(
        select(GameScore.score)
        .where(GameScore.game_type == data.game_type)
        .order_by(GameScore.score.asc(), GameScore.played_at.asc(), GameScore.id.asc())
        .offset(49)
        .limit(1)
    ).scalar_one_or_none()
    if lowest_score is not None and data.score <= lowest_score:
        raise HTTPException(status_code=409, detail="Score is not high enough for the top 50")

    score = GameScore(
        user_id=current_user.id,
        game_type=data.game_type,
        score=data.score,
        distance=data.distance,
        survival_time=data.survival_time,
        difficulty_level=data.difficulty_level,
        synced=True,
    )
    db.add(score)
    db.flush()
    retained_scores = db.execute(
        select(GameScore)
        .where(GameScore.game_type == data.game_type)
        .order_by(GameScore.score.asc(), GameScore.played_at.asc(), GameScore.id.asc())
    ).scalars().all()
    for obsolete_score in retained_scores[:-50]:
        db.delete(obsolete_score)
    db.commit()
    db.refresh(score)

    return GameScoreResponse(
        id=score.id,
        user_id=score.user_id,
        game_type=score.game_type,
        score=score.score,
        distance=score.distance,
        survival_time=score.survival_time,
        difficulty_level=score.difficulty_level,
        synced=score.synced,
        played_at=score.played_at,
    )


@router.get("/scores", response_model=list[GameScoreResponse])
def get_user_scores(
    game_type: str = Query(None),
    limit: int = Query(50, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get user's game scores"""
    query = select(GameScore).where(GameScore.user_id == current_user.id)

    if game_type:
        query = query.where(GameScore.game_type == game_type)

    scores = db.execute(
        query.order_by(desc(GameScore.played_at)).limit(limit)
    ).scalars().all()

    return [
        GameScoreResponse(
            id=s.id,
            user_id=s.user_id,
            game_type=s.game_type,
            score=s.score,
            distance=s.distance,
            survival_time=s.survival_time,
            difficulty_level=s.difficulty_level,
            synced=s.synced,
            played_at=s.played_at,
        )
        for s in scores
    ]


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(
    game_type: str = Query("chicken_crossing"),
    period_days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Get global leaderboard for a game"""
    cutoff_date = datetime.utcnow() - timedelta(days=period_days)

    scores = db.execute(
        select(GameScore)
        .where(
            and_(
                GameScore.game_type == game_type,
                GameScore.played_at >= cutoff_date,
            )
        )
        .order_by(desc(GameScore.score), desc(GameScore.played_at))
        .limit(limit)
    ).scalars().all()

    entries = [
        LeaderboardEntry(
            rank=idx + 1,
            user_name=s.user.name,
            score=s.score,
            distance=s.distance,
            survival_time=s.survival_time,
            played_at=s.played_at,
        )
        for idx, s in enumerate(scores)
    ]

    return LeaderboardResponse(
        game_type=game_type,
        entries=entries,
    )


@router.get("/personal-best")
def get_personal_best(
    game_type: str = Query("chicken_crossing"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get user's personal best score"""
    score = db.execute(
        select(GameScore)
        .where(
            and_(
                GameScore.user_id == current_user.id,
                GameScore.game_type == game_type,
            )
        )
        .order_by(desc(GameScore.score))
        .limit(1)
    ).scalars().first()

    if not score:
        return {"personal_best": 0, "game_type": game_type}

    return {
        "personal_best": score.score,
        "game_type": game_type,
        "distance": score.distance,
        "survival_time": score.survival_time,
        "played_at": score.played_at.isoformat(),
    }
