import librosa
import numpy as np

class ExtractFeature():
    def __init__(self):
        pass
    # ---------- Feature Extraction ----------
    def extract_features(file_path):
        try:
            audio, sr = librosa.load(file_path, sr=None)
            mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=40)
            chroma = librosa.feature.chroma_stft(y=audio, sr=sr)
            zcr = librosa.feature.zero_crossing_rate(y=audio)
            rms = librosa.feature.rms(y=audio)
            contrast = librosa.feature.spectral_contrast(y=audio, sr=sr)

            # Combine all features
            features = np.hstack([
                np.mean(mfcc.T, axis=0),
                np.mean(chroma.T, axis=0),
                np.mean(zcr.T, axis=0),
                np.mean(rms.T, axis=0),
                np.mean(contrast.T, axis=0)
            ])
            return features
        except Exception as e:
            print(f"Error in {file_path}: {e}")
            return None
