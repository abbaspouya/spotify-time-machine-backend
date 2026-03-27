from fastapi import APIRouter

router = APIRouter(tags=["System"])


@router.get("/ping", summary="Health check")
def ping():
    return {"status": "ok"}
