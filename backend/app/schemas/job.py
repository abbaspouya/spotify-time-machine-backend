from pydantic import BaseModel


class GroupSongsJobRequest(BaseModel):
    period: str = "monthly"
    start_year: int | None = None
    end_year: int | None = None
    order: str = "asc"
