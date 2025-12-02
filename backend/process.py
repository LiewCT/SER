import librosa
import numpy as np

class AudioFeatureExtractor:
    """
    Class for extracting audio features and predicting emotion probabilities.
    """

    def __init__(self):
        pass

    @staticmethod
    def extract_features(file_path: str) -> np.ndarray | None:
        """
        Extracts audio features from a file including MFCC, Chroma, ZCR, RMS, and Spectral Contrast.

        Args:
            file_path (str): Path to the audio file.

        Returns:
            np.ndarray: Combined feature vector.
            None: If extraction fails.
        """
        try:
            audio, sr = librosa.load(file_path, sr=None)

            mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=40)
            chroma = librosa.feature.chroma_stft(y=audio, sr=sr)
            zcr = librosa.feature.zero_crossing_rate(y=audio)
            rms = librosa.feature.rms(y=audio)
            contrast = librosa.feature.spectral_contrast(y=audio, sr=sr)

            # Combine all features (mean across time frames)
            features = np.hstack([
                np.mean(mfcc.T, axis=0),
                np.mean(chroma.T, axis=0),
                np.mean(zcr.T, axis=0),
                np.mean(rms.T, axis=0),
                np.mean(contrast.T, axis=0)
            ])

            return features

        except Exception as e:
            print(f"[Feature Extraction Error] {file_path}: {e}")
            return None

    @staticmethod
    def predict_emotion_probabilities(file_path: str, model, label_encoder) -> dict | None:
        """
        Predict emotion probabilities from an audio file using a trained model.

        Args:
            file_path (str): Path to the audio file.
            model: Trained scikit-learn model with predict_proba method.
            label_encoder: LabelEncoder object for decoding class labels.

        Returns:
            dict: Mapping of emotion label to probability (sorted descending).
            None: If feature extraction fails.
        """
        features = AudioFeatureExtractor.extract_features(file_path)
        if features is None:
            return None

        features = features.reshape(1, -1)
        probabilities = model.predict_proba(features)[0]

        result = {
            emotion: float(round(prob, 6))
            for emotion, prob in zip(label_encoder.classes_, probabilities)
        }

        # Sort by probability descending
        result = dict(sorted(result.items(), key=lambda x: x[1], reverse=True))
        return result
