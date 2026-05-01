# 🌿 AI Pest Detection & Lifecycle Analysis System

An AI-powered pest detection system built using **YOLOv8**, enhanced with **CBAM attention** and a **lifecycle-aware classification head**, designed to detect crop pests, identify their growth stage, and provide actionable treatment recommendations.

---

## 🚀 Features

- 🔍 Real-time pest detection using YOLOv8  
- 🧠 Attention mechanism (CBAM) for better accuracy on small pests  
- 🐛 Lifecycle classification (Egg, Larva, Pupa, Adult, Unknown)  
- 🌱 Multi-dataset training (IP102, Pest24, CropPest12 + custom data)  
- 📊 Rare-class handling with weighted loss  
- 📦 Soft-NMS for dense pest detection  
- ⚡ FastAPI backend for inference  
- 🌐 React frontend for user interaction  
- 📈 Cross-dataset evaluation & benchmarking  

---

## 🧠 Model Architecture

- YOLOv8 (CNN-based object detection)
- CBAM (Channel + Spatial Attention)
- Lifecycle Classification Head (MLP)
- Soft-NMS (post-processing)

---

## 📊 Performance

| Metric            | Value   |
|------------------|--------|
| Precision        | 40.5%  |
| Recall           | 37.3%  |
| mAP@0.5          | 34.8%  |
| mAP@0.5:0.95     | 12.1%  |

> Best performance observed for **Borer Larva (mAP ~66%)**

---

## 📁 Project Structure
```
miniproject/
│
├── ml/
│ ├── merge_datasets.py
│ ├── train.py
│ └── data/
│
├── backend/
│ ├── main.py
│
├── frontend/
│ └── (React App)
│
├── .gitignore
└── README.md

```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone Repository

```bash
git clone https://github.com/aiibooouuu/pest-detector.git
cd pest-detector

cd ml

pip install ultralytics torch torchvision numpy opencv-python pyyaml

python merge_datasets.py
python train.py --mode train
python train.py --mode validate


cd backend

pip install fastapi uvicorn ultralytics opencv-python numpy torch

uvicorn main:app --reload

cd frontend

npm install
npm run dev

```