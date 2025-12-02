import { useEffect, useRef, useState } from "react";

export default function InterviewClassroom() {
  // ==== Refs ====
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognizerRef = useRef(null);

  const liveChunkRef = useRef("");

  // ==== MediaRecorder ====
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // ==== Countdown + Timer ====
  const [countdown, setCountdown] = useState(null);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  // ==== Questions ====
  const questions = [
    "Introduce yourself.",
    "Why are you suitable for this role?",
    "Tell me about a challenge you solved.",
  ];

  // ==== States ====
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [recording, setRecording] = useState(false);

  // per-question logs
  const [questionLogs, setQuestionLogs] = useState(() => {
    const init = {};
    questions.forEach((q, i) => {
      init[i] = {
        question: q,
        messages: [],
        emotions: null, // will store {Happy: 0.8, Neutral: 0.12, ...}
      };
    });
    return init;
  });

  const [qIndex, setQIndex] = useState(0);
  const [selectedPage, setSelectedPage] = useState(0);
  const [finished, setFinished] = useState(false);

  // ================================
  // Setup Camera
  // ================================
  useEffect(() => {
    async function initCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error(err);
        alert("Camera or microphone access denied.");
      }
    }
    initCam();

    return () => {
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleCam = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  };

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  };

  // ================================
  // Helper: Push STT chunk
  // ================================
  const pushChunk = (text) => {
    const cleaned = text.trim();
    if (!cleaned) return;

    setQuestionLogs((prev) => {
      const updated = { ...prev };
      const msgs = updated[qIndex].messages;

      if (msgs.length > 0 && msgs[msgs.length - 1].text === cleaned)
        return prev;

      msgs.push({ from: "You", text: cleaned });
      return updated;
    });

    liveChunkRef.current = "";
  };

  // ================================
  // Countdown before recording
  // ================================
  const startRecording = () => {
    let c = 3;
    setCountdown(c);

    const interval = setInterval(() => {
      c -= 1;
      setCountdown(c);

      if (c < 0) {
        clearInterval(interval);
        setCountdown(null);
        beginActualRecording();
      }
    }, 1000);
  };

  // ================================
  // BEGIN RECORDING
  // ================================
  const beginActualRecording = () => {
    // VIDEO+audio
    recordedChunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => recordedChunksRef.current.push(e.data);
    mr.start();

    // AUDIO-only
    const audioStream = new MediaStream(streamRef.current.getAudioTracks());
    const ar = new MediaRecorder(audioStream);
    audioRecorderRef.current = ar;
    audioChunksRef.current = [];
    ar.ondataavailable = (e) => audioChunksRef.current.push(e.data);
    ar.start();

    // SPEECH
    if (!SpeechRecognition) {
      alert("Speech Recognition not supported.");
      return;
    }
    const recognizer = new SpeechRecognition();
    recognizerRef.current = recognizer;
    recognizer.lang = "en-US";
    recognizer.continuous = true;
    recognizer.interimResults = true;

    liveChunkRef.current = "";
    let silenceTimer = null;

    recognizer.onresult = (event) => {
      const text = event.results[event.resultIndex][0].transcript;
      liveChunkRef.current = text;

      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => pushChunk(text), 1200);
    };

    recognizer.start();
    setRecording(true);

    // Timer
    setTimer(0);
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
  };

  // ================================
  // STOP RECORDING
  // ================================
  const stopRecording = async () => {
    // Stop STT
    if (recognizerRef.current) recognizerRef.current.stop();
    setRecording(false);

    clearInterval(timerRef.current);

    // === STOP VIDEO
    const mr = mediaRecorderRef.current;
    let videoBlob = null;
    if (mr && mr.state !== "inactive") {
      await new Promise((resolve) => {
        mr.onstop = () => {
          videoBlob = new Blob(recordedChunksRef.current, {
            type: "video/webm",
          });
          resolve();
        };
        mr.stop();
      });
    }

    // === STOP AUDIO-ONLY
    const ar = audioRecorderRef.current;
    let audioBlob = null;
    if (ar && ar.state !== "inactive") {
      await new Promise((resolve) => {
        ar.onstop = () => {
          audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          resolve();
        };
        ar.stop();
      });
    }

    // Final STT push
    const last = liveChunkRef.current.trim();
    if (last) pushChunk(last);
    liveChunkRef.current = "";

    // Build final text
    const fullAnswer = questionLogs[qIndex].messages
      .filter((m) => m.from === "You")
      .map((m) => m.text)
      .join(" ");

    // === SEND to backend ===
    const fd = new FormData();
    fd.append("video", videoBlob, `video_q${qIndex + 1}.webm`);
    fd.append("audio", audioBlob, `audio_q${qIndex + 1}.webm`);
    fd.append("json_data", JSON.stringify({
      questionIndex: qIndex,
      question: questions[qIndex],
      answerText: fullAnswer
    }));

    const res = await fetch("http://localhost:8000/predict", {
      method: "POST",
      body: fd,
    });

    const result = await res.json();
    console.log("Emotion result:", result);

    // === SAVE EMOTION RESULT ===
    setQuestionLogs((prev) => {
      const updated = { ...prev };
      updated[qIndex].emotions = result.probabilities;  // store whole dict
      return updated;
    });

    // SYSTEM message
    setQuestionLogs((prev) => {
      const updated = { ...prev };
      const msgs = updated[qIndex].messages;
      const msg = `Q${qIndex + 1} finished`;
      if (!msgs.length || msgs[msgs.length - 1].text !== msg) {
        msgs.push({ from: "System", text: msg , color: "#e8f0fe" });
      }
      return updated;
    });

    // Next question
    if (qIndex < questions.length - 1) {
      setQIndex(qIndex + 1);
      setSelectedPage(qIndex + 1);
    } else {
      setFinished(true);
    }
  };

  // ================================
  // PAGE RENDER
  // ================================
  function renderPage(index) {
    const page = questionLogs[index];
    if (!page) return null;

    const emotions = page.emotions;
    const colors = {
      angry: "#ff7675",       // red
      disgust: "#6c5ce7",     // purple
      fearful: "#a29bfe",     // light purple
      happy: "#55efc4",       // green
      neutral: "#74b9ff",     // blue
      sad: "#ffeaa7",         // yellow
      surprised: "#fd79a8",   // pink
    };


    return (
      <div>
        <div
          style={{
            padding: "10px",
            marginBottom: "15px",
            background: "#fff3c4",
            borderRadius: "6px",
            border: "1px solid #ddd",
          }}
        >
          <strong>Question: </strong>
          {page.question}
        </div>

        {/* Messages */}
        {page.messages.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: "10px",
              padding: "10px",
              background: m.from === "You" ? "#d9fdd3" : "#fff",
              borderRadius: "6px",
              border: "1px solid #ddd",
            }}
          >
            <strong>{m.from}: </strong>
            {m.text}
          </div>
        ))}

        {/* === Emotion Summary (Single Bar) === */}
        {emotions && (
          <div
            style={{
              padding: "10px",
              background: "#f3f6fb",
              borderRadius: "6px",
              border: "1px solid #ddd",
            }}
          >
            <h4 style={{ margin: "10px" }}>Emotion Summary</h4>

            {/* ONE horizontal bar */}
            <div
              style={{
                width: "100%",
                height: "22px",
                background: "#eee",
                borderRadius: "8px",
                display: "flex",
                overflow: "hidden",
              }}
            >
              {Object.entries(emotions).map(([emo, prob]) => {
                const pct = Math.round(prob * 100);
                if (pct <= 0) return null;

                return (
                  <div
                    key={emo}
                    style={{
                      width: `${pct}%`,
                      background: colors[emo] || "#ccc",
                      height: "100%",
                      transition: "width .3s",
                    }}
                    title={`${emo}: ${pct}%`}
                  ></div>
                );
              })}
            </div>

            {/* Labels */}
            <div style={{ marginTop: "12px" }}>
              {Object.entries(emotions).map(([emo, prob]) => (
                <div
                  key={emo}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "4px",
                  }}
                >
                  <div
                    style={{
                      width: "14px",
                      height: "14px",
                      background: colors[emo] || "#ccc",
                      borderRadius: "4px",
                      marginRight: "6px",
                    }}
                  ></div>
                  <span>
                    {emo} — {Math.round(prob * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================================
  // MAIN UI
  // ================================
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* LEFT */}
      <div
        style={{
          width: "65%",
          padding: "20px",
          borderRight: "1px solid #ddd",
          background: "#f7f9fc",
        }}
      >
        <h2>Interview Camera</h2>

        <div style={{ width: "100%", height: "75%", position: "relative" }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={!micOn}
            style={{
              width: "100%",
              height: "100%",
              background: "#000",
              borderRadius: "12px",
              objectFit: "cover",
            }}
          />

          {countdown !== null && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: "80px",
                fontWeight: "bold",
                padding: "20px 40px",
                color: "white",
                borderRadius: "20px",
                background: "rgba(0,0,0,0.4)",
              }}
            >
              {countdown === 0 ? "Start!" : countdown}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent: "center",
            gap: "25px",
          }}
        >
          <button onClick={toggleCam}>{camOn ? "Camera Off" : "Camera On"}</button>
          <button onClick={toggleMic}>{micOn ? "Mic Mute" : "Mic Unmute"}</button>
        </div>
      </div>

      {/* RIGHT */}
      <div
        style={{
          width: "35%",
          padding: "20px",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2>Interview Pages</h2>

        {/* Tabs */}
        <div style={{ marginBottom: "12px" }}>
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setSelectedPage(i)}
              style={{
                marginRight: "10px",
                padding: "6px 12px",
                background: selectedPage === i ? "#1a73e8" : "#ccc",
                color: selectedPage === i ? "#fff" : "#000",
                borderRadius: "6px",
                border: "none",
              }}
            >
              Q{i + 1}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          style={{
            flexGrow: 1,
            overflowY: "auto",
            background: "#f3f3f3",
            padding: "10px",
            borderRadius: "6px",
          }}
        >
          {renderPage(selectedPage)}
        </div>

        {/* Buttons */}
        <div
          style={{
            marginTop: "20px",
            display: "flex",
            gap: "20px",
            alignItems: "center",
          }}
        >
          <button
            onClick={startRecording}
            disabled={recording || finished}
            style={{ padding: "10px 25px" }}
          >
            Start
          </button>

          <button
            onClick={stopRecording}
            disabled={!recording}
            style={{ padding: "10px 25px" }}
          >
            End
          </button>

          {recording && (
            <div style={{ fontSize: "18px", fontWeight: "bold", color: "red" }}>
              ⏱ {Math.floor(timer / 60)}:
              {String(timer % 60).padStart(2, "0")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
