import streamlit as st
import librosa
import numpy as np
import joblib
import os
import uuid
from conversion import webm_to_wav
from extract_feature import ExtractFeature

# -------------------------------
# Load ML Model
# -------------------------------
model = joblib.load("backend/models/xgb_emotion_model.pkl")
label_encoder = joblib.load("backend/models/label_encoder.pkl")

st.title("🎤 Speech Emotion Recognition (SER)")
st.write("Upload a WebM audio file to predict the emotion.")

# -------------------------------
# File Upload Section
# -------------------------------
uploaded_file = st.file_uploader("Upload .webm file", type=["webm"])

if uploaded_file:

    # Generate temporary unique file path
    temp_file_path = f"temp_{uuid.uuid4()}.webm"
    wav_path = None

    with open(temp_file_path, "wb") as f:
        f.write(uploaded_file.read())

    st.success("WebM file uploaded successfully.")

    try:
        # Convert to WAV
        wav_path = webm_to_wav(temp_file_path)
        st.info(f"Converted to WAV: {wav_path}")

        # Check conversion
        if not os.path.exists(wav_path):
            st.error("Conversion failed: WAV file missing.")
            st.stop()

        # Extract features
        features = ExtractFeature.extract_features(wav_path)
        features = features.reshape(1, -1)

        # Predict
        pred_label = model.predict(features)
        emotion = label_encoder.inverse_transform(pred_label)[0]

        st.subheader("🎧 Predicted Emotion")
        st.success(emotion)

    except Exception as e:
        st.error(f"Error: {str(e)}")

    finally:
        # Cleanup temp files
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if wav_path and os.path.exists(wav_path):
            os.remove(wav_path)

st.write("---")
st.caption("Frontend domain allowed: https://ser-rust.vercel.app/")
