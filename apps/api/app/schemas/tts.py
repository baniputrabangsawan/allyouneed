from app.schemas.common import ApiModel


class TtsVoiceView(ApiModel):
    id: str
    name: str
    language: str
    provider: str
    model: str
    available: bool


class TtsCapabilitiesView(ApiModel):
    voices: list[TtsVoiceView]
    languages: list[str]
