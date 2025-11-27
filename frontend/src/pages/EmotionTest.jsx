import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function EmotionTest() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const [predictedEmotion, setPredictedEmotion] = useState(null); // NEW

  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Emotion Test";
  }, []);

  async function resetPermissions() {
    try {
      await navigator.mediaDevices.getUserMedia({ video: false, audio: false });
    } catch {}
  }

  useEffect(() => {
    async function startMedia() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        streamRef.current = mediaStream;
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      } catch (err) {
        console.error(err);
        setError("Camera or microphone access denied.");
      }
    }

    startMedia();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  const toggleCam = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  };

  const toggleMic = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  };

  const goHome = async () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    await resetPermissions();
    navigate("/");
  };

  const startRecording = async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(audioStream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([audioBlob], "recorded_audio.webm", { type: "audio/webm" });
        await uploadAudio(file);

        audioStream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("MediaRecorder failed:", err);
      alert("Cannot start recording. Make sure your microphone is accessible.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const uploadAudio = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/predict_emotion", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (data.emotion) {
        setPredictedEmotion(data.emotion); // SET STATE
      } else if (data.error) {
        setPredictedEmotion(null);
        alert("Backend error: " + data.error);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload audio.");
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h1>Speech Emotion Recognition</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={!micOn}
        style={{ width: "480px", height: "360px", backgroundColor: "#000", borderRadius: "8px" }}
      />

      <div style={{ marginTop: "1rem" }}>
        <button onClick={toggleCam}>{camOn ? "Turn Camera Off" : "Turn Camera On"}</button>
        <button onClick={toggleMic} style={{ marginLeft: "1rem" }}>{micOn ? "Mute Mic" : "Unmute Mic"}</button>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <button onClick={startRecording} disabled={recording}>Start Recording</button>
        <button onClick={stopRecording} disabled={!recording} style={{ marginLeft: "1rem" }}>Stop Recording</button>
      </div>

      {predictedEmotion && (
        <div style={{ marginTop: "2rem", fontSize: "1.5rem", color: "green" }}>
          Predicted Emotion: {predictedEmotion}
        </div>
      )}

      <div style={{ marginTop: "2rem" }}>
        <button onClick={goHome}>Back to Home</button>
      </div>
    </div>
  );
}
