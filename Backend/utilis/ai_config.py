import io
import os
import wave
import logging

from dotenv import load_dotenv
from google import genai
from google.genai import types
from llama_index.core import Settings
from llama_index.llms.google_genai import GoogleGenAI
from llama_index.embeddings.google_genai import GoogleGenAIEmbedding

load_dotenv()

logger = logging.getLogger("askmynotes.rag")

# Cleanly extract key and strip quotes/whitespace
GOOGLE_API_KEY = (os.getenv("GOOGLE_API_KEY") or "").strip().strip('"').strip("'")

CHAT_MODEL = os.getenv("GOOGLE_CHAT_MODEL", "gemini-3.5-flash")
MINI_MODEL = os.getenv("GOOGLE_MINI_MODEL", "gemini-3.1-flash-lite")
STT_MODEL = os.getenv("GOOGLE_STT_MODEL", "gemini-3.5-flash")
TTS_MODEL = os.getenv("GOOGLE_TTS_MODEL", "gemini-2.5-flash-preview-tts")
EMBED_MODEL = os.getenv("GOOGLE_EMBED_MODEL", "gemini-embedding-001")

VISION_MODEL = os.getenv("GOOGLE_VISION_MODEL", "gemini-3.5-flash")

EMBED_DIM = 1536
CHUNK_SIZE = 256
CHUNK_OVERLAP = 40
TTS_SAMPLE_RATE = 24000


def pcm_to_wav_bytes(pcm: bytes, sample_rate: int = TTS_SAMPLE_RATE) -> bytes:
    """Wrap raw PCM from Gemini TTS in a WAV container so browsers can play it."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return buf.getvalue()


class AIConfig:
    def __init__(self):
        if not GOOGLE_API_KEY:
            raise RuntimeError("GOOGLE_API_KEY is not set in Backend/.env")

        # Explicitly initialize Client with api_key
        self.genai_client = genai.Client(api_key=GOOGLE_API_KEY)

        # 1. Standard LLM for Chat
        self.llm = GoogleGenAI(
            model=CHAT_MODEL,
            api_key=GOOGLE_API_KEY,
            max_tokens=16384,
            context_window=1_000_000,
        )

        self.vision_llm = None

        # 2. Small LLM for metadata/summaries/flashcards
        self.llm_mini = GoogleGenAI(
            model=MINI_MODEL,
            api_key=GOOGLE_API_KEY,
            max_tokens=16384,
            context_window=1_000_000,
        )

        # 3. Embeddings
        self.embed_model = GoogleGenAIEmbedding(
            model_name=EMBED_MODEL,
            api_key=GOOGLE_API_KEY,
            embedding_config=types.EmbedContentConfig(output_dimensionality=EMBED_DIM),
        )

        Settings.llm = self.llm
        Settings.embed_model = self.embed_model

        self.serper_api_key = os.getenv("SERPER_API_KEY")

    async def transcribe(self, audio_bytes: bytes, filename: str = "recording.wav") -> str:
        ext = os.path.splitext(filename or "")[1].lower().lstrip(".")
        mime = {
            "wav": "audio/wav", "mp3": "audio/mp3", "aac": "audio/aac",
            "ogg": "audio/ogg", "flac": "audio/flac", "aiff": "audio/aiff",
        }.get(ext, "audio/wav")

        response = await self.genai_client.aio.models.generate_content(
            model=STT_MODEL,
            contents=[
                "Transcribe this audio verbatim. Return ONLY the spoken words, "
                "with no commentary. If there is no speech, return an empty string.",
                types.Part.from_bytes(data=audio_bytes, mime_type=mime),
            ],
        )
        return (response.text or "").strip()

    async def synthesize_speech(self, text: str, voice: str = "Kore") -> bytes:
        response = await self.genai_client.aio.models.generate_content(
            model=TTS_MODEL,
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
                    )
                ),
            ),
        )
        pcm = response.candidates[0].content.parts[0].inline_data.data
        return pcm_to_wav_bytes(pcm)