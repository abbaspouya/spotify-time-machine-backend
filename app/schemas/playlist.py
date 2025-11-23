from pydantic import BaseModel
from typing import Optional


class CreatePlaylistRequest(BaseModel):
    period: str = "monthly"            # "monthly", "quarterly", "semi", "yearly"
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    group_key: str
    playlist_name: Optional[str] = None
    playlist_description: Optional[str] = None
    order: str = "asc"                 # "asc" or "desc"



class CreateLanguagePlaylistRequest(BaseModel):
    language_code: str        # e.g. "en", "it", "fa"
    playlist_name: str | None = None
    min_songs: int = 5        # only create if enough songs
