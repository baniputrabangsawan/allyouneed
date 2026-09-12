from fastapi import APIRouter

from app.api.v1 import (
    admin_audit,
    admin_auth,
    admin_licenses,
    admin_system,
    downloads,
    health,
    jobs,
    licenses,
    tts,
    uploads,
)

router = APIRouter()
router.include_router(health.router, prefix="/health", tags=["health"])
router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
router.include_router(downloads.router, prefix="/downloads", tags=["downloads"])
router.include_router(licenses.router, prefix="/licenses", tags=["licenses"])
router.include_router(tts.router, prefix="/tts", tags=["tts"])
router.include_router(admin_licenses.router, prefix="/admin/licenses", tags=["admin-licenses"])
router.include_router(admin_auth.router, prefix="/admin/auth", tags=["admin-auth"])
router.include_router(admin_audit.router, prefix="/admin/audit", tags=["admin-audit"])
router.include_router(admin_system.router, prefix="/admin/system", tags=["admin-system"])
