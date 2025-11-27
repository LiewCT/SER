# conversion.py
from pydub import AudioSegment

def webm_to_wav(input_path: str, output_path: str = None) -> str:
    """
    Convert a .webm audio file to .wav.
    
    Args:
        input_path: Path to the input .webm file
        output_path: Optional path for the output .wav file.
                     If None, replaces .webm with .wav in input_path.
                     
    Returns:
        Path to the output .wav file
    """
    if output_path is None:
        if input_path.lower().endswith(".webm"):
            output_path = input_path[:-5] + ".wav"
        else:
            output_path = input_path + ".wav"

    audio = AudioSegment.from_file(input_path, format="webm")
    audio.export(output_path, format="wav")
    return output_path
