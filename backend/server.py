from fastapi import FastAPI, UploadFile, File, Request, Form
from fastapi.responses import HTMLResponse, FileResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment
import os, uuid, json, joblib

from process import AudioFeatureExtractor   # your feature class

# -------- FIXED FILE PATHS --------
MODEL_PATH = "models/xgb_emotion_model_updated.pkl"
LE_PATH    = "models/label_encoder_updated.pkl"

# -------- LOAD MODEL & ENCODER --------
with open(MODEL_PATH, "rb") as f:
    model = joblib.load(f)

with open(LE_PATH, "rb") as f:
    label_encoder = joblib.load(f)


# -------- Convert WEBM → WAV --------
def convert_webm_to_wav(webm_path: str) -> str:
    wav_path = webm_path.replace(".webm", ".wav")
    audio = AudioSegment.from_file(webm_path, format="webm")
    audio = audio.set_frame_rate(16000).set_channels(1)
    audio.export(wav_path, format="wav")
    return wav_path


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------- Folders --------
BASE_DIR = "received"
FOLDERS = {
    "audio": os.path.join(BASE_DIR, "audio"),
    "video": os.path.join(BASE_DIR, "video"),
    "json": os.path.join(BASE_DIR, "json"),
}
for path in FOLDERS.values():
    os.makedirs(path, exist_ok=True)


@app.post("/predict")
async def universal_receiver(
    request: Request,
    video: UploadFile = File(None),
    audio: UploadFile = File(None),
    json_data: str = Form(None)
):

    result = {
        "status": "ok",
        "emotion": None,
        "probabilities": None,
        "debug": {}
    }

    # -------- Save JSON --------
    if json_data:
        result["debug"]["json_data"] = json_data

    # -------- Save Video --------
    if video:
        contents = await video.read()
        filename = f"{uuid.uuid4()}.webm"
        video_path = os.path.join(FOLDERS["video"], filename)
        with open(video_path, "wb") as f:
            f.write(contents)
        result["debug"]["video_saved"] = video_path

    # -------- Save Audio --------
    audio_path = None
    if audio:
        contents = await audio.read()
        filename = f"{uuid.uuid4()}.webm"
        audio_path = os.path.join(FOLDERS["audio"], filename)
        with open(audio_path, "wb") as f:
            f.write(contents)
        result["debug"]["audio_saved"] = audio_path


    # -------- Run SER Model --------
    if audio_path:
        try:
            wav_path = convert_webm_to_wav(audio_path)

            ser_probs = AudioFeatureExtractor.predict_emotion_probabilities(
                wav_path, model, label_encoder
            )

            if ser_probs:
                result["emotion"] = list(ser_probs.keys())[0]
                result["probabilities"] = ser_probs
            else:
                result["error"] = "Feature extraction failed"

        except Exception as e:
            result["error"] = f"SER model failed: {e}"

    return result

# --------------------------------------------------------
# CLEAR ALL DATA
# --------------------------------------------------------
@app.post("/clear")
def clear_all_data():
    removed_files = []

    for category, folder in FOLDERS.items():
        for f in os.listdir(folder):
            path = os.path.join(folder, f)
            os.remove(path)
            removed_files.append(f)

    print("\n🧹 CLEARED ALL DATA")
    print("Removed files:", removed_files)
    print("=====================\n")

    # Redirect back to homepage
    return RedirectResponse(url="/", status_code=303)


# --------------------------------------------------------
# HOMEPAGE LIST FILES + CLEAR BUTTON
# --------------------------------------------------------
@app.get("/", response_class=HTMLResponse)
def list_all():
    html = """
    <h1>📁 Received Files</h1>

    <form action="/clear" method="post" 
          onsubmit="return confirm('Are you sure you want to delete ALL stored files?');">
        <button type="submit" 
            style="padding: 8px 16px; background:red; color:white;
                   border:none; border-radius:6px; cursor:pointer;">
            Clear All Data
        </button>
    </form>
    <br>
    """

    for category, folder in FOLDERS.items():
        html += f"<h2>{category.upper()}</h2><ul>"
        files = os.listdir(folder)

        if not files:
            html += "<li>— empty —</li>"

        for f in files:
            size = os.path.getsize(os.path.join(folder, f))
            html += f'<li><a href="/file/{category}/{f}">{f}</a> — {size} bytes</li>'
        html += "</ul>"

    return html


# --------------------------------------------------------
# FILE DOWNLOAD
# --------------------------------------------------------
@app.get("/file/{category}/{filename}")
def download(category: str, filename: str):
    folder = FOLDERS.get(category)
    if not folder:
        return {"error": "Invalid category"}

    path = os.path.join(folder, filename)
    if not os.path.exists(path):
        return {"error": "File not found"}

    return FileResponse(path)
