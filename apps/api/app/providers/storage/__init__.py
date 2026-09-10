from app.providers.storage.base import StorageProvider
from app.providers.storage.local import LocalStorageProvider

__all__ = ["LocalStorageProvider", "StorageProvider", "get_storage"]


def get_storage() -> StorageProvider:
    from app.services.upload_service import get_upload_service

    return get_upload_service().storage
