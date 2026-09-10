from pydantic import Field

from app.schemas.common import ApiModel


class PresignUploadRequest(ApiModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=100)
    size: int = Field(gt=0)
    tool_id: str = Field(min_length=1, max_length=100)


class PresignedUpload(ApiModel):
    upload_url: str
    file_key: str
    expires_in: int
    headers: dict[str, str] = Field(default_factory=dict)


class CompleteUploadRequest(ApiModel):
    file_key: str = Field(min_length=1, max_length=512)


class UploadedFile(ApiModel):
    file_key: str
