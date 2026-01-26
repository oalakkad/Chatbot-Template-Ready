import os
from openai import OpenAI
from typing import BinaryIO
import io

from knowledge_base import OPENAI_API_KEY

# Initialize OpenAI client
client = OpenAI(api_key=OPENAI_API_KEY)

async def transcribe_audio(audio_file: BinaryIO) -> str:
    """
    Transcribes an audio file using OpenAI Whisper.
    :param audio_file: A binary stream of the audio file.
    :return: The transcribed text.
    """
    try:
        # We need to provide a filename for OpenAI's API to detect the format
        # but since it's a stream, we can name it anything relevant.
        audio_file.name = "audio.wav"
        
        transcript = client.audio.transcriptions.create(
            model="whisper-1", 
            prompt="The user is likely speaking a phone number or a short verification code. Numbers like 12345678."
        )
        
        text = transcript.text
        # Post-processing: Remove spaces between digits (e.g., "5 5 5" -> "555")
        import re
        text = re.sub(r'(?<=\d)\s+(?=\d)', '', text)
        
        return text
    except Exception as e:
        print(f"[VOICE] Transcription Error: {e}")
        return ""

async def generate_speech(text: str) -> bytes:
    """
    Generates speech from text using OpenAI TTS.
    :param text: The text to convert to speech.
    :return: Binary data of the generated speech (mp3).
    """
    try:
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy", # Options: alloy, echo, fable, onyx, nova, shimmer
            input=text
        )
        return response.read()
    except Exception as e:
        print(f"[VOICE] TTS Error: {e}")
        return b""
