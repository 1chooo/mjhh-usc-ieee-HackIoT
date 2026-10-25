"""Train a YOLO model for MJHH.

Datasets, checkpoints, and run outputs stay on disk. See README.md.
"""

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a YOLO model for MJHH")
    parser.add_argument("--data", type=Path, required=True, help="Path to a YOLO data.yaml")
    parser.add_argument("--model", default="yolo11n.pt", help="Base checkpoint name")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    args = parser.parse_args()

    if not args.data.is_file():
        raise SystemExit(f"dataset file not found: {args.data}")

    try:
        from ultralytics import YOLO
    except ImportError as error:
        raise SystemExit(
            "ultralytics is not installed. From packages/yolo run: pip install -r requirements.txt"
        ) from error

    model = YOLO(args.model)
    model.train(data=str(args.data), epochs=args.epochs, imgsz=args.imgsz)


if __name__ == "__main__":
    main()
