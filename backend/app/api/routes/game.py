from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc, func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.game_score import GameScore
from app.models.user import User
from app.schemas.game_score import (
    GameScoreCreate,
    GameScoreResponse,
    GameScoreLeaderboard,
    GameScoreLeaderboardEntry,
)

router = APIRouter(prefix="/game", tags=["Game"])


@router.post("/scores", response_model=GameScoreResponse, status_code=201)
def submit_score(
    data: GameScoreCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a game score"""
    score = GameScore(
        user_id=current_user.id,
        score=data.score,
        game_type=data.game_type,
        difficulty_level=data.difficulty_level,
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return score


@router.get("/scores/leaderboard", response_model=GameScoreLeaderboard)
def get_leaderboard(
    game_type: str = Query("chicken_crossing"),
    limit: int = Query(10, ge=1, le=50),
    period_days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get game leaderboard"""
    cutoff_date = datetime.utcnow() - timedelta(days=period_days)

    # Get top scores in the period
    top_scores = db.execute(
        select(GameScore, User.name)
        .join(User)
        .where(
            GameScore.game_type == game_type,
            GameScore.played_at >= cutoff_date,
        )
        .order_by(desc(GameScore.score))
        .limit(limit)
    ).all()

    # Get user's best score
    user_best = db.execute(
        select(func.max(GameScore.score))
        .where(
            GameScore.user_id == current_user.id,
            GameScore.game_type == game_type,
            GameScore.played_at >= cutoff_date,
        )
    ).scalar()

    # Calculate user's rank
    user_rank = None
    if user_best:
        rank = db.execute(
            select(func.count(func.distinct(GameScore.user_id)))
            .where(
                GameScore.game_type == game_type,
                GameScore.score > user_best,
                GameScore.played_at >= cutoff_date,
            )
        ).scalar()
        user_rank = (rank or 0) + 1

    entries = [
        GameScoreLeaderboardEntry(
            user_name=row[1],
            score=row[0].score,
            game_type=row[0].game_type,
            difficulty_level=row[0].difficulty_level,
            played_at=row[0].played_at,
            rank=idx + 1,
        )
        for idx, row in enumerate(top_scores)
    ]

    return GameScoreLeaderboard(
        game_type=game_type,
        entries=entries,
        user_best_score=user_best,
        user_rank=user_rank,
    )


@router.get("/scores/user", response_model=dict)
def get_user_scores(
    game_type: str = Query("chicken_crossing"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get user's game scores"""
    scores = db.execute(
        select(GameScore)
        .where(
            GameScore.user_id == current_user.id,
            GameScore.game_type == game_type,
        )
        .order_by(desc(GameScore.score))
    ).scalars().all()

    best_score = db.execute(
        select(func.max(GameScore.score)).where(
            GameScore.user_id == current_user.id,
            GameScore.game_type == game_type,
        )
    ).scalar()

    return {
        "game_type": game_type,
        "best_score": best_score or 0,
        "total_plays": len(scores),
        "scores": [
            {
                "score": s.score,
                "difficulty_level": s.difficulty_level,
                "played_at": s.played_at,
            }
            for s in scores[:10]
        ],
    }
