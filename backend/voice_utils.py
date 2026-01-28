from knowledge_base import OPENAI_API_KEY, async_openai_client as client
from typing import BinaryIO
import io

async def transcribe_audio(audio_file: BinaryIO, filename: str = "audio.wav") -> str:
    """
    Transcribes an audio file using OpenAI Whisper.
    :param audio_file: A binary stream of the audio file.
    :param filename: The filename to help detect format (extension matters).
    :return: The transcribed text.
    """
    try:
        # We need to provide a filename for OpenAI's API to detect the format
        # but since it's a stream, we can name it anything relevant.
        audio_file.name = filename
        
        transcript = await client.audio.transcriptions.create(
            file=audio_file,
            model="whisper-1",
            prompt="AL-TIJARIA Help Desk. Kuwaiti Arabic and English mix."
        )
        
        return transcript.text
    except Exception as e:
        print(f"[VOICE] Transcription Error: {e}")
        return ""

async def generate_speech(text: str) -> bytes:
    """
    Generates speech from text using OpenAI TTS.
    :param text: The text to convert to speech.
    :return: Binary data of the generated speech (mp3).
    """
    if not text.strip():
        return b""
        
    try:
        response = await client.audio.speech.create(
            model="tts-1",
            voice="nova",  # Nova is faster and clearer
            input=text,
            speed=1.3  # God-Tier Speed
        )
        return await response.aread() # Must use aread() for AsyncOpenAI
    except Exception as e:
        print(f"[VOICE] TTS Error: {e}")
        return b""
