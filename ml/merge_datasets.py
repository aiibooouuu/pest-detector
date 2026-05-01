# ml/merge_datasets.py
# Merges IP102, Pest24, CropPest12, and custom field data into one unified dataset
# Harmonizes class names and lifecycle stages across datasets

import os
import shutil
import yaml
from pathlib import Path
from collections import defaultdict

# ── Configure your source dataset roots here ─────────────────────────────────
SOURCES = [
    {
        "name": "okra_pest",          # your downloaded dataset
        "root": "./data",
        "yaml": "./dataset.yaml",
        "splits": {"train": "train", "val": "valid", "test": "test"},
    },
    # Add more when you have them:
    # {
    #     "name": "pest24",
    #     "root": "./pest24",
    #     "yaml": "./pest24/data.yaml",
    #     "splits": {"train": "train", "val": "valid"},
    # },
    # {
    #     "name": "croppest12",
    #     "root": "./croppest12",
    #     "yaml": "./croppest12/data.yaml",
    #     "splits": {"train": "train", "val": "valid"},
    # },
]

# ── Unified class taxonomy with lifecycle stages ──────────────────────────────
# Maps (source_dataset_name, original_class_name) → unified_class_id
# Extend this as you add more datasets
CLASS_MAP = {
    # okra_pest classes
    ("okra_pest", "Whitefly"):      {"id": 0, "name": "whitefly_adult"},
    ("okra_pest", "Jassid"):        {"id": 1, "name": "jassid_adult"},
    ("okra_pest", "adult_hopper"):  {"id": 2, "name": "planthpper_adult"},
    ("okra_pest", "borer"):         {"id": 3, "name": "borer_larva"},
    ("okra_pest", "pest"):          {"id": 4, "name": "unknown_pest"},

    # pest24 classes (add when you have this dataset)
    # ("pest24", "whitefly"):         {"id": 0, "name": "whitefly_adult"},
    # ("pest24", "whitefly_egg"):     {"id": 5, "name": "whitefly_egg"},
    # ("pest24", "aphid"):            {"id": 6, "name": "aphid_adult"},

    # croppest12 classes (add when you have this dataset)
    # ("croppest12", "Aphid"):        {"id": 6, "name": "aphid_adult"},
}

UNIFIED_CLASSES = {
    0: "whitefly_adult",
    1: "jassid_adult",
    2: "planthpper_adult",
    3: "borer_larva",
    4: "unknown_pest",
    5: "whitefly_egg",       # reserved for pest24
    6: "aphid_adult",        # reserved for pest24/croppest12
    7: "aphid_larva",
    8: "caterpillar_larva",
    9: "caterpillar_adult",
    10: "mite_adult",
    11: "thrips_adult",
}

LIFECYCLE_STAGE = {
    name: ("larva"  if "larva" in name or "egg" in name or "pupa" in name
           else "adult" if "adult" in name
           else "unknown")
    for name in UNIFIED_CLASSES.values()
}

OUT_ROOT = Path("./merged_data")

def remap_label_file(src_label: Path, out_label: Path, src_name: str, src_class_names: list):
    """Read a YOLO label file, remap class IDs to unified taxonomy, write output."""
    if not src_label.exists():
        return False

    lines_out = []
    with open(src_label) as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            orig_id = int(parts[0])
            if orig_id >= len(src_class_names):
                continue
            orig_name = src_class_names[orig_id]
            mapping = CLASS_MAP.get((src_name, orig_name))
            if mapping is None:
                continue   # drop unmapped classes
            new_id = mapping["id"]
            lines_out.append(f"{new_id} {' '.join(parts[1:])}\n")

    if lines_out:
        out_label.parent.mkdir(parents=True, exist_ok=True)
        with open(out_label, "w") as f:
            f.writelines(lines_out)
        return True
    return False

def merge():
    stats = defaultdict(int)

    for src in SOURCES:
        src_name = src["name"]
        src_root = Path(src["root"])

        # Load source class names from yaml
        with open(src["yaml"]) as f:
            src_yaml = yaml.safe_load(f)
        src_class_names = src_yaml.get("names", [])
        if isinstance(src_class_names, dict):
            src_class_names = [src_class_names[i] for i in sorted(src_class_names)]

        print(f"\n── Processing: {src_name} ({len(src_class_names)} classes) ──")

        for split_key, split_dir in src["splits"].items():
            img_src = src_root / split_dir / "images"
            lbl_src = src_root / split_dir / "labels"

            if not img_src.exists():
                print(f"  ⚠ Skipping {split_key}: {img_src} not found")
                continue

            img_dst = OUT_ROOT / split_key / "images"
            lbl_dst = OUT_ROOT / split_key / "labels"
            img_dst.mkdir(parents=True, exist_ok=True)
            lbl_dst.mkdir(parents=True, exist_ok=True)

            for img_path in img_src.glob("*.[jp][pn][g]"):
                lbl_path = lbl_src / (img_path.stem + ".txt")
                # Unique filename: prefix with source name
                new_stem  = f"{src_name}_{img_path.stem}"
                new_img   = img_dst / (new_stem + img_path.suffix)
                new_lbl   = lbl_dst / (new_stem + ".txt")

                ok = remap_label_file(lbl_path, new_lbl, src_name, src_class_names)
                if ok:
                    shutil.copy2(img_path, new_img)
                    stats[split_key] += 1

    # Write merged dataset.yaml
    merged_yaml = {
        "path": str(OUT_ROOT.resolve()),
        "train": "train/images",
        "val":   "val/images",
        "test":  "test/images",
        "nc":    len(UNIFIED_CLASSES),
        "names": UNIFIED_CLASSES,
        "lifecycle_stage": LIFECYCLE_STAGE,
    }
    with open("merged_dataset.yaml", "w") as f:
        yaml.dump(merged_yaml, f, default_flow_style=False, sort_keys=False)

    print("\n✅ Merge complete!")
    for split, count in stats.items():
        print(f"  {split}: {count} images")
    print(f"  Classes: {len(UNIFIED_CLASSES)}")
    print(f"  Output:  {OUT_ROOT.resolve()}")
    print(f"  YAML:    merged_dataset.yaml")

if __name__ == "__main__":
    merge()