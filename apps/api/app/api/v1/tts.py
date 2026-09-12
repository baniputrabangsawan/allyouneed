from fastapi import APIRouter

from app.providers.tts import available_tts_voices
from app.schemas.common import DataResponse
from app.schemas.tts import TtsCapabilitiesView, TtsVoiceView

router = APIRouter()


@router.get("/capabilities", response_model=DataResponse[TtsCapabilitiesView])
async def tts_capabilities() -> DataResponse[TtsCapabilitiesView]:
    voices = available_tts_voices()
    return DataResponse(
        data=TtsCapabilitiesView(
            voices=[
                TtsVoiceView.model_validate({**voice.__dict__, "styles": list(voice.styles)})
                for voice in voices
            ],
            languages=sorted({voice.language for voice in voices if voice.available}),
        )
    )
