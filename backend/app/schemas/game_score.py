from datetime import datetime
from pydantic import BaseModel


class GameScoreCreate(BaseModel):
    game_type: str
    score: int
    distance: int = 0
    survival_time: int = 0
    difficulty_level: int = 1


class GameScoreResponse(BaseModel):
    id: int
    user_id: int
    game_type: str
    score: int
    distance: int
    survival_time: int
    difficulty_level: int
    synced: bool
    played_at: datetime

    class Config:
        from_attributes = True


class GameScoreLeaderboardEntry(BaseModel):
    rank: int
    user_name: str
    score: int
    game_type: str
    difficulty_level: int
    played_at: datetime


class GameScoreLeaderboard(BaseModel):
    game_type: str
    entries: list[GameScoreLeaderboardEntry]
    user_best_score: int | None = None
    user_rank: int | None = None


class LeaderboardEntry(BaseModel):
    rank: int
    user_name: str
    score: int
    distance: int
    survival_time: int
    played_at: datetime


class LeaderboardResponse(BaseModel):
    game_type: str
    entries: list[LeaderboardEntry]


# Backward-compatible aliases for older route imports.
GameScoreLeaderboardEntryAlias = GameScoreLeaderboardEntry
GameScoreLeaderboardAlias = GameScoreLeaderboard
