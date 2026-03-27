from fastapi import APIRouter

from .routes_auth import router as auth_router
from .routes_discovery import router as discovery_router
from .routes_playlists import router as playlists_router
from .routes_snapshots import router as snapshots_router
from .routes_system import router as system_router

router = APIRouter()

router.include_router(system_router)
router.include_router(auth_router)
router.include_router(playlists_router)
router.include_router(discovery_router)
router.include_router(snapshots_router)
