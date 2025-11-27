from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import librosa
import numpy as np
import joblib
import os
from conversion import webm_to_wav
from extract_feature import ExtractFeature

app = FastAPI()

# Allow frontend requests (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load your trained model
model = joblib.load("models/xgb_emotion_model.pkl")
label_encoder = joblib.load("models/label_encoder.pkl")

@app.post("/predict_emotion")
async def predict_emotion(file: UploadFile = File(...)):
    import uuid

    # Generate unique file path
    temp_file_path = f"temp_{uuid.uuid4()}.webm"
    wav_path = None

    try:
        # Save uploaded audio
        with open(temp_file_path, "wb") as f:
            data = await file.read()
            if not data:
                raise ValueError("Uploaded file is empty.")
            f.write(data)

        print("Saved WebM file:", temp_file_path)

        # Convert to WAV
        wav_path = webm_to_wav(temp_file_path)
        print("Converted to WAV:", wav_path)

        if not os.path.exists(wav_path):
            raise FileNotFoundError("WAV conversion failed, file not found.")

        # Extract features
        features = ExtractFeature.extract_features(wav_path)
        features = features.reshape(1, -1) 
        print("Features:", features.shape)

        # Predict emotion
        pred_label = model.predict(features)
        emotion = label_encoder.inverse_transform(pred_label)[0]

        print("Predicted:", emotion)

        return {"emotion": emotion}

    except Exception as e:
        print("Backend ERROR:", str(e))
        return {"error": str(e)}

    finally:
        # Cleanup
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if wav_path and os.path.exists(wav_path):
            os.remove(wav_path)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
