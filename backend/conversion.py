from pydub import AudioSegment
import os

SUPPORTED_FORMATS = {
    "webm", "mp3", "m4a", "aac", "ogg", 
    "wav", "flac", "wma"
}

def convert_to_wav(input_path: str, output_path: str = None) -> str:
    """
    Convert any supported audio file to WAV format.
    """
    ext = os.path.splitext(input_path)[1].lower().replace(".", "")

    if ext not in SUPPORTED_FORMATS:
        raise ValueError(f"Unsupported audio format: {ext}")

    # Generate output path
    if output_path is None:
        output_path = os.path.splitext(input_path)[0] + ".wav"

    # Already WAV
    if ext == "wav":
        return input_path

    # Convert
    audio = AudioSegment.from_file(input_path, format=ext)
    audio.export(output_path, format="wav")

    return output_path
