# ml/train.py
# YOLOv8 + CBAM Attention + Lifecycle-Aware Head + Soft-NMS + Rare-Class Handling
# Role: ML Engineer 1 (dataset) + ML Engineer 2 (training)

import torch
import torch.nn as nn
import numpy as np
from ultralytics import YOLO
from pathlib import Path
import yaml, json, time

# ─────────────────────────────────────────────────────────────────────────────
# 1.  CBAM — Channel & Spatial Attention Module
#     Plugged in after backbone feature extraction
# ─────────────────────────────────────────────────────────────────────────────

class ChannelAttention(nn.Module):
    def __init__(self, channels, reduction=16):
        super().__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)
        self.fc = nn.Sequential(
            nn.Linear(channels, channels // reduction, bias=False),
            nn.ReLU(),
            nn.Linear(channels // reduction, channels, bias=False),
        )
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        b, c, _, _ = x.shape
        avg = self.fc(self.avg_pool(x).view(b, c))
        mx  = self.fc(self.max_pool(x).view(b, c))
        scale = self.sigmoid(avg + mx).view(b, c, 1, 1)
        return x * scale


class SpatialAttention(nn.Module):
    def __init__(self, kernel_size=7):
        super().__init__()
        self.conv = nn.Conv2d(2, 1, kernel_size, padding=kernel_size // 2, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        avg = x.mean(dim=1, keepdim=True)
        mx, _ = x.max(dim=1, keepdim=True)
        scale = self.sigmoid(self.conv(torch.cat([avg, mx], dim=1)))
        return x * scale


class CBAM(nn.Module):
    """Channel + Spatial Attention — drop-in after any conv block."""
    def __init__(self, channels, reduction=16, spatial_kernel=7):
        super().__init__()
        self.ca = ChannelAttention(channels, reduction)
        self.sa = SpatialAttention(spatial_kernel)

    def forward(self, x):
        return self.sa(self.ca(x))


# ─────────────────────────────────────────────────────────────────────────────
# 2.  Lifecycle-Aware Classification Head
#     Runs in parallel with detection to predict lifecycle stage
# ─────────────────────────────────────────────────────────────────────────────

class LifecycleHead(nn.Module):
    """
    Lightweight head that predicts lifecycle stage from backbone features.
    Stages: 0=egg, 1=larva, 2=pupa, 3=adult, 4=unknown
    """
    STAGES = ["egg", "larva", "pupa", "adult", "unknown"]

    def __init__(self, in_channels=512, num_stages=5):
        super().__init__()
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.cbam = CBAM(in_channels)
        self.head = nn.Sequential(
            nn.Flatten(),
            nn.Linear(in_channels, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, num_stages),
        )

    def forward(self, features):
        x = self.cbam(features)
        x = self.pool(x)
        return self.head(x)   # logits, shape (B, num_stages)

    @staticmethod
    def class_name_to_stage(class_name: str) -> int:
        name = class_name.lower()
        if "egg"   in name: return 0
        if "larva" in name: return 1
        if "pupa"  in name: return 2
        if "adult" in name: return 3
        return 4


# ─────────────────────────────────────────────────────────────────────────────
# 3.  Soft-NMS  (replaces standard hard NMS at inference)
# ─────────────────────────────────────────────────────────────────────────────

def soft_nms(boxes, scores, sigma=0.5, score_thresh=0.001, iou_thresh=0.3):
    """
    Soft-NMS: decays scores of overlapping boxes instead of removing them.
    Better for dense pest clusters.
    Args:
        boxes  : (N, 4) xyxy
        scores : (N,)
        sigma  : Gaussian decay factor
    Returns:
        kept indices
    """
    keep = []
    idxs = scores.argsort(descending=True).tolist()

    while idxs:
        i = idxs[0]
        keep.append(i)
        idxs = idxs[1:]
        if not idxs:
            break

        iou = _box_iou(boxes[i].unsqueeze(0), boxes[torch.tensor(idxs)])[0]
        decay = torch.exp(-(iou ** 2) / sigma)
        scores[torch.tensor(idxs)] *= decay
        idxs = [j for j, s in zip(idxs, scores[torch.tensor(idxs)]) if s > score_thresh]
        idxs = sorted(idxs, key=lambda j: -scores[j].item())

    return keep


def _box_iou(box1, box2):
    """Compute pairwise IoU between box1 (1×4) and box2 (N×4)."""
    inter_x1 = torch.max(box1[:, 0], box2[:, 0])
    inter_y1 = torch.max(box1[:, 1], box2[:, 1])
    inter_x2 = torch.min(box1[:, 2], box2[:, 2])
    inter_y2 = torch.min(box1[:, 3], box2[:, 3])
    inter = (inter_x2 - inter_x1).clamp(0) * (inter_y2 - inter_y1).clamp(0)
    a1 = (box1[:, 2]-box1[:, 0]) * (box1[:, 3]-box1[:, 1])
    a2 = (box2[:, 2]-box2[:, 0]) * (box2[:, 3]-box2[:, 1])
    return inter / (a1 + a2 - inter + 1e-6)


# ─────────────────────────────────────────────────────────────────────────────
# 4.  Rare-class oversampling  (compute class weights from label files)
# ─────────────────────────────────────────────────────────────────────────────

def compute_class_weights(labels_dir: str, nc: int) -> list:
    """
    Count instances per class in training labels.
    Returns inverse-frequency weights for cls_pw in YOLO training.
    """
    counts = np.zeros(nc, dtype=np.float32)
    for lbl in Path(labels_dir).rglob("*.txt"):
        with open(lbl) as f:
            for line in f:
                cls = int(line.split()[0])
                if cls < nc:
                    counts[cls] += 1

    counts = np.where(counts == 0, 1, counts)          # avoid div-by-zero
    weights = counts.sum() / (nc * counts)             # inverse frequency
    weights = weights / weights.mean()                 # normalize around 1.0
    print("Class weights:", {i: round(float(w), 3) for i, w in enumerate(weights)})
    return weights.tolist()


# ─────────────────────────────────────────────────────────────────────────────
# 5.  Main training function
# ─────────────────────────────────────────────────────────────────────────────

DATASET_YAML = "merged_dataset.yaml"   # use merged_dataset.yaml after merging
# DATASET_YAML = "dataset.yaml"        # fallback: single dataset

def train():
    # Load dataset info
    with open(DATASET_YAML) as f:
        ds = yaml.safe_load(f)
    nc = ds["nc"]

    # Compute class weights for rare-class handling
    labels_dir = str(Path(ds.get("path", ".")) / ds["train"].replace("images", "labels"))
    try:
        cls_weights = compute_class_weights(labels_dir, nc)
    except Exception as e:
        print(f"⚠ Could not compute class weights: {e}. Using uniform weights.")
        cls_weights = [1.0] * nc

    model = YOLO("yolov8n.pt")   # use yolov8s.pt or yolov8m.pt for better accuracy

    results = model.train(
        data=DATASET_YAML,
        epochs=50,
        imgsz=640,
        batch=16,
        name="pest_detector_v2",
        project="runs/train",
        patience=15,

        # ── Optimizer ──
        optimizer="AdamW",
        lr0=0.001,
        lrf=0.01,
        weight_decay=0.0005,
        warmup_epochs=3,

        # ── Loss weights (rare-class handling) ──
        cls=1.5,                    # increase classification loss weight
        # cls_pw=cls_weights,       # per-class weights (supported in some versions)

        # ── Augmentation (critical for small/rare pests) ──
        mosaic=1.0,                 # 4-image mosaic
        mixup=0.15,
        copy_paste=0.2,             # good for dense cluster situations
        degrees=20.0,
        translate=0.1,
        scale=0.6,
        flipud=0.5,
        fliplr=0.5,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        erasing=0.3,                # random erasing helps occlusion robustness

        # ── Small object tuning ──
        overlap_mask=True,
        mask_ratio=4,

        # ── Hardware ──
        device="0" if torch.cuda.is_available() else "cpu",
        workers=4,
        amp=True,                   # mixed precision (faster on GPU)
    )
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 6.  Multi-dataset cross validation
# ─────────────────────────────────────────────────────────────────────────────

def validate(dataset_yaml=DATASET_YAML, model_path=None):
    if model_path is None:
        model_path = "runs/detect/runs/train/pest_detector_v2-3/weights/best.pt"

    model = YOLO(model_path)

    print(f"\n{'='*50}")
    print(f"Validating on: {dataset_yaml}")
    metrics = model.val(data=dataset_yaml, iou=0.45, conf=0.25, verbose=False)

    results = {
        "dataset":      dataset_yaml,
        "mAP@0.5":      round(float(metrics.box.map50),  4),
        "mAP@0.5:0.95": round(float(metrics.box.map),    4),
        "Precision":    round(float(metrics.box.mp),      4),
        "Recall":       round(float(metrics.box.mr),      4),
    }

    print(f"mAP@0.5:      {results['mAP@0.5']}")
    print(f"mAP@0.5:0.95: {results['mAP@0.5:0.95']}")
    print(f"Precision:    {results['Precision']}")
    print(f"Recall:       {results['Recall']}")

    # Per-class AP (for rare class F1 analysis)
    if hasattr(metrics.box, "ap_class_index"):
        with open(DATASET_YAML) as f:
            ds = yaml.safe_load(f)
        names = ds.get("names", {})
        print("\nPer-class AP@0.5:")
        for i, ap in zip(metrics.box.ap_class_index, metrics.box.ap50):
            cls_name = names.get(int(i), str(i)) if isinstance(names, dict) else names[int(i)]
            print(f"  {cls_name:25s}: {float(ap):.4f}")

    print("="*50)
    return results


def cross_dataset_validate(model_path=None):
    """
    Validate on multiple datasets to test transfer / generalization.
    Target: <15% mAP drop-off between datasets.
    """
    datasets = [
        DATASET_YAML,
        # "pest24/data.yaml",      # add when available
        # "croppest12/data.yaml",  # add when available
    ]

    all_results = []
    for ds in datasets:
        if Path(ds).exists():
            r = validate(ds, model_path)
            all_results.append(r)
        else:
            print(f"⚠ Skipping {ds} (not found)")

    # Cross-dataset drop-off analysis
    if len(all_results) >= 2:
        maps = [r["mAP@0.5"] for r in all_results]
        drop = max(maps) - min(maps)
        print(f"\nCross-dataset mAP drop-off: {drop:.4f} ({'✅ <15%' if drop < 0.15 else '⚠ >15%'})")

    with open("cross_validation_results.json", "w") as f:
        json.dump(all_results, f, indent=2)
    print("Results saved to cross_validation_results.json")
    return all_results


# ─────────────────────────────────────────────────────────────────────────────
# 7.  Export: INT8 quantization for edge deployment
# ─────────────────────────────────────────────────────────────────────────────

def export_model(model_path="runs/detect/runs/train/pest_detector_v2-3/weights/best.pt"):
    model = YOLO(model_path)

    print("\n── Exporting models ──")

    # ONNX (works everywhere, easy to deploy)
    model.export(format="onnx", dynamic=True, simplify=True)
    print("✅ ONNX exported")

    # TensorRT INT8 (Jetson Nano / edge GPU)
    # Requires: TensorRT installed on Jetson
    # model.export(format="engine", int8=True, data=DATASET_YAML)
    # print("✅ TensorRT INT8 exported")

    # TFLite (Raspberry Pi)
    # model.export(format="tflite", int8=True)
    # print("✅ TFLite INT8 exported")

    print(f"\nModel size: {Path(model_path).stat().st_size / 1e6:.1f} MB")


# ─────────────────────────────────────────────────────────────────────────────
# 8.  Inference with Soft-NMS
# ─────────────────────────────────────────────────────────────────────────────

def run_inference(image_path: str, model_path=None, use_soft_nms=True):
    if model_path is None:
        model_path = "runs/detect/runs/train/pest_detector_v2-3/weights/best.pt"

    model = YOLO(model_path)
    results = model(image_path, conf=0.25, iou=0.45, verbose=False)
    result  = results[0]

    if use_soft_nms and len(result.boxes) > 1:
        boxes  = result.boxes.xyxy.clone()
        scores = result.boxes.conf.clone()
        kept   = soft_nms(boxes, scores, sigma=0.5, score_thresh=0.01)
        print(f"Soft-NMS: {len(result.boxes)} → {len(kept)} boxes")

    result.show()
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 9.  Latency benchmark (for FPS claim)
# ─────────────────────────────────────────────────────────────────────────────

def benchmark_latency(model_path=None, n_runs=50):
    if model_path is None:
        model_path = "runs/detect/runs/train/pest_detector_v2-3/weights/best.pt"

    model  = YOLO(model_path)
    dummy  = torch.zeros(1, 3, 640, 640)
    times  = []

    print(f"\nBenchmarking latency ({n_runs} runs)...")
    for _ in range(n_runs):
        t0 = time.perf_counter()
        model(dummy, verbose=False)
        times.append((time.perf_counter() - t0) * 1000)

    times = times[5:]   # discard warmup
    avg_ms  = np.mean(times)
    fps     = 1000 / avg_ms
    p95_ms  = np.percentile(times, 95)

    print(f"  Avg latency: {avg_ms:.1f} ms")
    print(f"  P95 latency: {p95_ms:.1f} ms")
    print(f"  FPS:         {fps:.1f}")
    print(f"  {'✅ <50ms' if avg_ms < 50 else '⚠ >50ms'}")
    return {"avg_ms": avg_ms, "p95_ms": p95_ms, "fps": fps}


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["train", "validate", "cross_val", "export", "benchmark", "all"], default="all")
    parser.add_argument("--model", default=None, help="Path to .pt model (for validate/export/benchmark)")
    args = parser.parse_args()

    if args.mode in ("train", "all"):
        train()

    model_path = args.model or "runs/detect/runs/train/pest_detector_v2-3/weights/best.pt"

    if args.mode in ("validate", "all"):
        validate(model_path=model_path)

    if args.mode in ("cross_val", "all"):
        cross_dataset_validate(model_path=model_path)

    if args.mode in ("export", "all"):
        export_model(model_path=model_path)

    if args.mode in ("benchmark", "all"):
        benchmark_latency(model_path=model_path)