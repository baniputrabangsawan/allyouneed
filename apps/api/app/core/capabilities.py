from app.core.enums import LicensePlan

IMAGE_FACE_BLUR = "image.face_blur"
IMAGE_BACKGROUND_REMOVAL = "image.ai.background_removal"
IMAGE_UPSCALE = "image.ai.upscale"
DOCUMENT_OCR_ADVANCED = "document.ocr.advanced"
AUDIO_SPEECH_TO_TEXT = "audio.speech_to_text"
AUDIO_TEXT_TO_SPEECH = "audio.text_to_speech"
AUDIO_NOISE_REDUCTION = "audio.noise_reduction"
VIDEO_ADD_SUBTITLE = "video.add_subtitle"
VIDEO_PROCESSING = "video.processing"
PDF_LARGE_PROCESSING = "pdf.large_processing"
BATCH_LARGE = "batch.large"

PRO_CAPABILITIES: tuple[str, ...] = (
    IMAGE_FACE_BLUR,
    IMAGE_BACKGROUND_REMOVAL,
    IMAGE_UPSCALE,
    DOCUMENT_OCR_ADVANCED,
    AUDIO_SPEECH_TO_TEXT,
    AUDIO_TEXT_TO_SPEECH,
    AUDIO_NOISE_REDUCTION,
    VIDEO_ADD_SUBTITLE,
    VIDEO_PROCESSING,
    PDF_LARGE_PROCESSING,
    BATCH_LARGE,
)

TOOL_CAPABILITIES: dict[str, str] = {
    "blur-face": IMAGE_FACE_BLUR,
    "remove-background": IMAGE_BACKGROUND_REMOVAL,
    "upscale-image": IMAGE_UPSCALE,
    "ocr-pdf": DOCUMENT_OCR_ADVANCED,
    "speech-to-text": AUDIO_SPEECH_TO_TEXT,
    "text-to-speech": AUDIO_TEXT_TO_SPEECH,
    "noise-reduction": AUDIO_NOISE_REDUCTION,
    "add-subtitle": VIDEO_ADD_SUBTITLE,
}

PLAN_CAPABILITIES: dict[LicensePlan, tuple[str, ...]] = {
    LicensePlan.PRO_1_MONTH: PRO_CAPABILITIES,
    LicensePlan.PRO_6_MONTHS: PRO_CAPABILITIES,
    LicensePlan.PRO_12_MONTHS: PRO_CAPABILITIES,
}


def capabilities_for_plan(plan: LicensePlan | str) -> list[str]:
    resolved = LicensePlan(plan) if not isinstance(plan, LicensePlan) else plan
    return list(PLAN_CAPABILITIES[resolved])


def capability_for_tool(tool_id: str) -> str | None:
    return TOOL_CAPABILITIES.get(tool_id)
