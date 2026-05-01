# backend/main.py
# FastAPI backend with: lifecycle classification, soft-NMS, farmer alerts, scan history

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO
import numpy as np
import cv2
import base64
import torch
import time
from pathlib import Path
from collections import deque
import uvicorn

app = FastAPI(title="PestScan API v2", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model + scan history ──────────────────────────────────────────────────────
MODEL_PATH = "best.pt"
model = None
scan_history = deque(maxlen=10)   # last 10 scans in memory

# ── Unified class metadata ────────────────────────────────────────────────────
CLASS_META = {
    # okra_pest classes
    "Whitefly":      {"display": "Whitefly",     "stage": "Adult",   "risk": "High"},
    "Jassid":        {"display": "Jassid",        "stage": "Adult",   "risk": "Medium"},
    "adult_hopper":  {"display": "Plant Hopper",  "stage": "Adult",   "risk": "High"},
    "borer":         {"display": "Stem Borer",    "stage": "Larva",   "risk": "Very High"},
    "pest":          {"display": "General Pest",  "stage": "Unknown", "risk": "Medium"},
    # merged dataset unified names
    "whitefly_adult":     {"display": "Whitefly",     "stage": "Adult",   "risk": "High"},
    "whitefly_egg":       {"display": "Whitefly",     "stage": "Egg",     "risk": "Medium"},
    "jassid_adult":       {"display": "Jassid",       "stage": "Adult",   "risk": "Medium"},
    "planthpper_adult":   {"display": "Plant Hopper", "stage": "Adult",   "risk": "High"},
    "borer_larva":        {"display": "Stem Borer",   "stage": "Larva",   "risk": "Very High"},
    "aphid_adult":        {"display": "Aphid",        "stage": "Adult",   "risk": "High"},
    "aphid_larva":        {"display": "Aphid",        "stage": "Larva",   "risk": "Medium"},
    "caterpillar_larva":  {"display": "Caterpillar",  "stage": "Larva",   "risk": "Very High"},
    "caterpillar_adult":  {"display": "Caterpillar",  "stage": "Adult",   "risk": "High"},
    "mite_adult":         {"display": "Spider Mite",  "stage": "Adult",   "risk": "High"},
    "thrips_adult":       {"display": "Thrips",       "stage": "Adult",   "risk": "Medium"},
    "unknown_pest":       {"display": "Unknown Pest", "stage": "Unknown", "risk": "Medium"},
}

PEST_ADVICE = {
    "High":      "⚠️ Act within 48 hours. Apply recommended treatment immediately.",
    "Very High": "🚨 Critical infestation. Apply treatment today and isolate affected area.",
    "Medium":    "📋 Monitor daily. Prepare treatment if spread continues.",
    "Low":       "✅ Low risk. Continue regular monitoring.",
}

TREATMENT = {
    "Whitefly":     "Neem oil spray (5ml/L) or yellow sticky traps. Apply early morning.",
    "Jassid":       "Imidacloprid 0.5ml/L spray. Remove heavily affected leaves.",
    "Plant Hopper": "Thiamethoxam 0.3g/L. Maintain field hygiene, drain excess water.",
    "Stem Borer":   "Chlorpyrifos 2ml/L spray into stem holes. Remove bored stems.",
    "Aphid":        "Dimethoate 2ml/L or strong water spray to dislodge colonies.",
    "Caterpillar":  "Bt (Bacillus thuringiensis) spray or manual removal for early stage.",
    "Spider Mite":  "Acaricide spray or neem oil. Increase humidity around plants.",
    "Thrips":       "Spinosad 0.5ml/L spray. Use blue sticky traps for monitoring.",
    "General Pest": "Identify specific pest for targeted treatment. Consult agronomist.",
    "Unknown Pest": "Consult local agronomist for identification before applying treatment.",
}


# ── Soft-NMS ──────────────────────────────────────────────────────────────────

def soft_nms_filter(boxes_xyxy, scores, sigma=0.5, score_thresh=0.01):
    """Returns filtered indices after Soft-NMS."""
    if len(boxes_xyxy) <= 1:
        return list(range(len(boxes_xyxy)))

    boxes  = boxes_xyxy.clone().float()
    scores = scores.clone().float()
    idxs   = list(range(len(scores)))
    keep   = []

    while idxs:
        best = max(idxs, key=lambda i: scores[i].item())
        keep.append(best)
        idxs.remove(best)
        if not idxs:
            break
        for j in idxs[:]:
            ix1 = max(boxes[best,0], boxes[j,0])
            iy1 = max(boxes[best,1], boxes[j,1])
            ix2 = min(boxes[best,2], boxes[j,2])
            iy2 = min(boxes[best,3], boxes[j,3])
            inter = max(0, ix2-ix1) * max(0, iy2-iy1)
            a1 = (boxes[best,2]-boxes[best,0]) * (boxes[best,3]-boxes[best,1])
            a2 = (boxes[j,2]-boxes[j,0]) * (boxes[j,3]-boxes[j,1])
            iou = inter / (a1 + a2 - inter + 1e-6)
            decay = float(torch.exp(-iou**2 / sigma))
            scores[j] *= decay
            if scores[j] < score_thresh:
                idxs.remove(j)

    return keep


def lifecycle_from_class(class_name: str) -> str:
    """Infer lifecycle stage from class name if not in CLASS_META."""
    name = class_name.lower()
    if "egg"   in name: return "Egg"
    if "larva" in name: return "Larva"
    if "pupa"  in name: return "Pupa"
    if "adult" in name: return "Adult"
    return "Unknown"


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def load_model():
    global model
    try:
        model = YOLO(MODEL_PATH)
        print(f"✅ Model loaded: {MODEL_PATH}")
    except Exception as e:
        print(f"⚠️  Custom model not found ({e}), using YOLOv8n")
        model = YOLO("yolov8n.pt")


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "PestScan API v2 running", "model": MODEL_PATH}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "scans_in_history": len(scan_history),
    }

@app.get("/history")
def get_history():
    """Return last 10 scan summaries."""
    return {"history": list(scan_history)}

@app.delete("/history")
def clear_history():
    scan_history.clear()
    return {"status": "History cleared"}


@app.post("/detect")
async def detect_pests(file: UploadFile = File(...)):
    """
    Main detection endpoint.
    Returns detections with: pest name, lifecycle stage, risk, treatment advice,
    annotated image (base64), and farmer alert message.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read + decode image
    contents = await file.read()
    nparr    = np.frombuffer(contents, np.uint8)
    img_bgr  = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    h, w = img_bgr.shape[:2]
    t_start = time.perf_counter()

    # ── Run YOLOv8 inference ──
    results = model(img_bgr, conf=0.20, iou=0.45, verbose=False)   # lower conf for tiny pests
    result  = results[0]

    # ── Apply Soft-NMS ──
    kept_indices = list(range(len(result.boxes)))
    if len(result.boxes) > 1:
        kept_indices = soft_nms_filter(
            result.boxes.xyxy,
            result.boxes.conf,
            sigma=0.5,
            score_thresh=0.01,
        )

    inference_ms = (time.perf_counter() - t_start) * 1000

    # ── Build detection list ──
    detections = []
    highest_risk_order = 0
    risk_order = {"Very High": 4, "High": 3, "Medium": 2, "Low": 1}

    for idx in kept_indices:
        box      = result.boxes[idx]
        cls_id   = int(box.cls[0])
        cls_name = model.names[cls_id]
        conf     = float(box.conf[0])
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

        # Detect tiny pests (< 20px in either dimension)
        bw, bh   = x2 - x1, y2 - y1
        is_tiny  = (bw < 20 or bh < 20)

        meta     = CLASS_META.get(cls_name, {
            "display": cls_name,
            "stage":   lifecycle_from_class(cls_name),
            "risk":    "Medium",
        })
        display  = meta["display"]
        stage    = meta["stage"]
        risk     = meta["risk"]
        treatment = TREATMENT.get(display, TREATMENT["Unknown Pest"])

        # Boost confidence display for tiny pests (they're harder to detect)
        conf_display = round(conf * 100, 1)

        detections.append({
            "label":      cls_name,
            "pest_name":  display,
            "stage":      stage,
            "risk":       risk,
            "confidence": conf_display,
            "bbox":       [x1, y1, x2, y2],
            "bbox_size":  [bw, bh],
            "is_tiny":    is_tiny,
            "treatment":  treatment,
        })

        r = risk_order.get(risk, 0)
        if r > highest_risk_order:
            highest_risk_order = r

    # ── Farmer alert message ──
    if detections:
        highest_risk = {4: "Very High", 3: "High", 2: "Medium", 1: "Low"}.get(highest_risk_order, "Medium")
        alert = PEST_ADVICE.get(highest_risk, PEST_ADVICE["Medium"])
        pest_names = list({d["pest_name"] for d in detections})
        alert_msg = f"Found {len(detections)} pest(s): {', '.join(pest_names)}. {alert}"
    else:
        alert_msg = "✅ No pests detected. Crop appears healthy."

    # ── Draw annotated image ──
    annotated = result.plot()
    _, buffer  = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64_image  = base64.b64encode(buffer).decode("utf-8")

    # ── Save to history ──
    scan_entry = {
        "timestamp":    time.strftime("%Y-%m-%d %H:%M:%S"),
        "filename":     file.filename,
        "count":        len(detections),
        "pests":        [d["pest_name"] for d in detections],
        "highest_risk": {4:"Very High",3:"High",2:"Medium",1:"Low"}.get(highest_risk_order,"None"),
        "inference_ms": round(inference_ms, 1),
    }
    scan_history.appendleft(scan_entry)

    return JSONResponse({
        "detections":      detections,
        "annotated_image": b64_image,
        "count":           len(detections),
        "alert":           alert_msg,
        "inference_ms":    round(inference_ms, 1),
        "image_size":      [w, h],
        "soft_nms_applied": len(result.boxes) != len(kept_indices),
    })


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)