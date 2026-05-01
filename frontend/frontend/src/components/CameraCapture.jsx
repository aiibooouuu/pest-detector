import { useEffect, useRef, useState } from "react";

export default function CameraCapture({ onCapture, dark }) {
  const videoRef  = useRef();
  const canvasRef = useRef();
  const streamRef = useRef();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => setReady(true);
    } catch {
      setError("Camera access denied. Please allow camera permissions and try again.");
    }
  };

  const stopCamera = () => streamRef.current?.getTracks().forEach(t => t.stop());

  const capture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    stopCamera();
    canvas.toBlob(blob => {
      onCapture(new File([blob], "capture.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  };

  const cornerColor = dark ? "#52b788" : "#52b788";

  if (error) return (
    <div style={{ background: dark ? "#162419" : "#1b4332", borderRadius: 16, padding: "40px 24px", textAlign: "center", marginBottom: 16 }}>
      <div style={{ fontSize: 32, color: "#74c69d", marginBottom: 12 }}>⊘</div>
      <div style={{ fontSize: 14, color: "#95d5b2", lineHeight: 1.5 }}>{error}</div>
    </div>
  );

  return (
    <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", background: "#0a0a0a", marginBottom: 16 }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", display: "block", maxHeight: "60vh", objectFit: "cover" }} />
      <canvas ref={canvasRef} hidden />

      {/* Viewfinder corners */}
      {[
        { top: 20, left: 20,  borderTop: `2px solid ${cornerColor}`, borderLeft:  `2px solid ${cornerColor}` },
        { top: 20, right: 20, borderTop: `2px solid ${cornerColor}`, borderRight: `2px solid ${cornerColor}` },
        { bottom: 88, left: 20,  borderBottom: `2px solid ${cornerColor}`, borderLeft:  `2px solid ${cornerColor}` },
        { bottom: 88, right: 20, borderBottom: `2px solid ${cornerColor}`, borderRight: `2px solid ${cornerColor}` },
      ].map((s, i) => (
        <div key={i} style={{ position: "absolute", width: 20, height: 20, borderRadius: 2, ...s }} />
      ))}

      <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)" }}>
        {ready ? (
          <button
            onClick={capture}
            style={{ width: 68, height: 68, borderRadius: "50%", border: "3px solid #fff", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <span style={{ width: 52, height: 52, borderRadius: "50%", background: "#fff", display: "block" }} />
          </button>
        ) : (
          <div style={{ color: "#74c69d", fontSize: 14, fontWeight: 500 }}>Starting camera...</div>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
        Point at the pest and tap to capture
      </div>
    </div>
  );
}