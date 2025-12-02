import streamlit as st
import librosa
import numpy as np
import joblib
import os
import uuid
from conversion import convert_to_wav
from process import AudioFeatureExtractor
import matplotlib.pyplot as plt

# -------------------------------
# Load ML Model
# -------------------------------
model = joblib.load("backend/models/xgb_emotion_model_updated.pkl")
label_encoder = joblib.load("backend/models/label_encoder_updated.pkl")

st.title("🎤 Speech Emotion Recognition (SER)")
st.write("Upload an audio file to predict its emotion.")

# -------------------------------
# File Upload Section
# -------------------------------
uploaded_file = st.file_uploader(
    "Upload audio file", 
    type=["webm", "wav", "mp3", "m4a", "ogg", "flac", "aac", "wma"]
)

if uploaded_file:

    unique_id = uuid.uuid4()
    original_ext = uploaded_file.name.split(".")[-1].lower()
    
    temp_input_path = f"temp_{unique_id}.{original_ext}"
    wav_path = None

    with open(temp_input_path, "wb") as f:
        f.write(uploaded_file.read())

    st.success(f"File uploaded: {uploaded_file.name}")

    try:
        # -------------------------------
        # 1. Convert to WAV (unified)
        # -------------------------------
        wav_path = convert_to_wav(temp_input_path)

        st.info(f"Converted to WAV: {wav_path}")

        if not os.path.exists(wav_path):
            st.error("Conversion failed: WAV file missing.")
            st.stop()

        # -------------------------------
        # 2. Extract features
        # -------------------------------
        emotion_probs = AudioFeatureExtractor.predict_emotion_probabilities(wav_path,model,label_encoder)

        st.subheader("🎧 Predicted Emotion")
        if emotion_probs is not None:
            labels = [e.capitalize() for e in emotion_probs.keys()]
            values = [p*100 for p in emotion_probs.values()]

            fig, ax = plt.subplots()
            ax.bar(labels, values, color='skyblue')
            ax.set_ylabel("Probability (%)")
            ax.set_ylim(0, 100)

            for i, v in enumerate(values):
                ax.text(i, v + 1, f"{v:.1f}%", ha='center')

            st.subheader("🎨 Emotion Probabilities (Bar Chart)")
            st.pyplot(fig)
        else:
            st.error("Could not extract features from the audio.")

    except Exception as e:
        st.error(f"Error: {str(e)}")

    finally:
        # Cleanup
        if os.path.exists(temp_input_path):
            os.remove(temp_input_path)
        if wav_path and os.path.exists(wav_path):
            os.remove(wav_path)

st.write("---")
st.caption("Frontend domain allowed: https://ser-rust.vercel.app/")
