# 🌿 AI Pest Detection & Lifecycle Analysis System

An AI-powered pest detection system using **YOLOv8** with **CBAM attention** and **lifecycle-aware classification** to detect crop pests, identify growth stages, and provide treatment recommendations.

---

## 🚀 Features

- 🔍 Real-time pest detection using YOLOv8  
- 🧠 Attention mechanism (CBAM) for better accuracy on small pests  
- 🐛 Lifecycle classification (Egg, Larva, Pupa, Adult)  
- 🌱 Multi-dataset training (IP102, Pest24, CropPest12 + custom data)  
- 📊 Rare-class handling with weighted loss  
- 📦 Soft-NMS for dense pest detection  
- ⚡ FastAPI backend for inference  
- 🌐 React frontend with dark/light mode  
- 📈 Scan history & treatment recommendations  

---

## 🧠 Model Architecture

- **Backbone:** YOLOv8 (CNN-based object detection)
- **Attention:** CBAM (Channel + Spatial Attention)
- **Classification:** Lifecycle Classification Head (MLP)
- **Post-Processing:** Soft-NMS

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| Precision | 40.5% |
| Recall | 37.3% |
| mAP@0.5 | 34.8% |
| mAP@0.5:0.95 | 12.1% |
| **Best Class** | Borer Larva (mAP ~66%) |

---

## 📁 Project Structure

```
miniproject/
├── ml/
│   ├── merge_datasets.py
│   ├── train.py
│   └── data/
├── backend/
│   └── main.py
├── frontend/
│   └── frontend/ (React App)
├── .gitignore
└── README.md
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone Repository

```bash
git clone https://github.com/aiibooouuu/pest-detector.git
cd pest-detector
```

### 2️⃣ Setup ML Pipeline

```bash
cd ml
pip install ultralytics torch torchvision numpy opencv-python pyyaml

python merge_datasets.py
python train.py --mode train
python train.py --mode validate
```

### 3️⃣ Start Backend

```bash
cd ../backend
pip install fastapi uvicorn ultralytics opencv-python numpy torch

uvicorn main:app --reload
```

Backend runs on: `http://localhost:8000`

### 4️⃣ Start Frontend

```bash
cd ../frontend/frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

---

## 🔄 Workflow

```
Image → YOLOv8 → CBAM → Lifecycle Head → Soft-NMS
      → Risk Analysis → Treatment Recommendation → UI Output
```

---

## 📡 API Endpoints

### Health Check
```
GET http://localhost:8000/health
```

### Detect Pests
```
POST http://localhost:8000/detect
Content-Type: multipart/form-data
Body: { file: <image> }
```

**Response:**
```json
{
  "detections": [
    {
      "label": "Whitefly",
      "pest_name": "Whitefly",
      "lifecycle": "Adult",
      "risk": "High",
      "confidence": 94.2,
      "affected_crops": ["Cotton", "Tomato"],
      "damage_type": "Sap sucker - Yellowing, wilting"
    }
  ],
  "annotated_image": "base64_encoded_image",
  "count": 1,
  "analysis_summary": {
    "total_detections": 1,
    "average_confidence": 94.2,
    "highest_risk_pest": "Whitefly"
  }
}
```

---

## 🌍 Applications

- 🚜 Smart Agriculture
- 🏡 Smallholder Farming
- 📱 Agricultural Extension
- 🏢 Crop Consultancy
- 🎓 Research & Training

---

## 📦 Supported Pests

| Pest | Risk Level | Lifecycle Stages |
|------|-----------|------------------|
| Jassid | Medium | Adult, Nymph |
| Whitefly | High | Adult, Nymph |
| Plant Hopper | Very High | Adult, Nymph |
| Stem Borer | Very High | Larva, Pupa |
| Aphid | Medium | Adult, Nymph |
| Caterpillar | High | Larva, Pupa |
| Spider Mite | Medium | Adult, Larva |
| Thrips | Medium | Adult |
| Beetle | Medium | Adult, Larva |

---

## 💻 Tech Stack

- **ML:** Python, PyTorch, Ultralytics YOLOv8
- **Backend:** FastAPI, Uvicorn
- **Frontend:** React, Vite, React Icons
- **Image Processing:** OpenCV
- **GPU:** CUDA 11.8+

---

## ⚠️ Limitations

- Performance drops for rare classes with low training data
- Requires GPU for efficient training
- Accuracy depends on dataset quality and image lighting

---

## 🔮 Future Improvements

- [ ] Add 10+ more pest classes
- [ ] Video stream support
- [ ] Mobile app (React Native)
- [ ] Offline mode with local model
- [ ] Edge deployment (Raspberry Pi / Jetson Nano)
- [ ] Real-time video detection
- [ ] Multi-language support
- [ ] SMS/WhatsApp alerts

---

## 🚀 Quick Start

**Option 1: Docker**
```bash
docker build -t pest-detector .
docker run -p 8000:8000 -p 5173:5173 pest-detector
```

**Option 2: Local Development**
```bash
# Terminal 1
cd backend && uvicorn main:app --reload

# Terminal 2
cd frontend/frontend && npm run dev
```

---



---

## 📄 License

MIT License - See LICENSE file for details

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am "Add feature"`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

---
