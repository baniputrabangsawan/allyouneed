from enum import StrEnum


class JobStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class ExecutionMode(StrEnum):
    LOCAL_ONLY = "local-only"
    SYNC = "sync"
    ASYNC = "async"
    DISABLED = "disabled"


class JobStage(StrEnum):
    VALIDATING = "validating"
    DOWNLOADING = "downloading"
    DECODING = "decoding"
    PROCESSING = "processing"
    ENCODING = "encoding"
    UPLOADING = "uploading"
    FINALIZING = "finalizing"


class QueueName(StrEnum):
    IMAGE = "image"
    PDF = "pdf"
    AUDIO = "audio"
    VIDEO = "video"
    OCR = "ocr"
    STT = "stt"
    TTS = "tts"
    AI_IMAGE = "ai-image"


class LicensePlan(StrEnum):
    PRO_1_MONTH = "pro_1_month"
    PRO_6_MONTHS = "pro_6_months"
    PRO_12_MONTHS = "pro_12_months"


class LicenseStatus(StrEnum):
    ACTIVE = "active"
    EXPIRED = "expired"
    SUSPENDED = "suspended"
    REVOKED = "revoked"


class LicenseEventType(StrEnum):
    ISSUED = "issued"
    ACTIVATED = "activated"
    DEACTIVATED = "deactivated"
    RENEWED = "renewed"
    SUSPENDED = "suspended"
    RESUMED = "resumed"
    REVOKED = "revoked"
    EXPIRED = "expired"
    ACTIVATION_RESET = "activation_reset"
