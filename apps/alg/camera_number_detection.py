"""
即時人數追蹤 (YOLO26 + ByteTrack)

顯示兩個數字：
  - 目前人數：這一幀畫面中有幾個人
  - 累計人數：從開始到現在出現過幾個「不同的人」(依追蹤 ID 計算)

安裝：
    pip install ultralytics lap

執行：
    python people_counter.py                      # 預設攝影機 0 (MacBook 內建鏡頭)
    python people_counter.py --source 1           # 換另一支鏡頭 (例如 iPhone 接續互通相機)
    python people_counter.py --source video.mp4   # 影片檔
    python people_counter.py --source rtsp://...  # 網路攝影機串流
裝置會自動選擇：NVIDIA GPU > Apple 晶片 GPU (mps) > CPU
按 q 結束。
"""

import argparse
import time

import cv2
from ultralytics import YOLO


def parse_args():
    p = argparse.ArgumentParser(description="即時人數追蹤")
    p.add_argument("--source", default="0", help="攝影機編號(0, 1...)、影片路徑或 RTSP 網址")
    p.add_argument("--model", default="yolo26n.pt",
                   help="模型：yolo26n (最快) / yolo26s / yolo26m (較準)")
    p.add_argument("--conf", type=float, default=0.4, help="偵測信心門檻")
    p.add_argument("--imgsz", type=int, default=640, help="推論解析度，調低可加速")
    p.add_argument("--tracker", default="bytetrack.yaml",
                   help="bytetrack.yaml (快) 或 botsort.yaml (遮擋時較穩)")
    p.add_argument("--min-frames", type=int, default=5,
                   help="同一個 ID 至少連續出現幾幀才算進累計人數，用來過濾誤判")
    p.add_argument("--device", default=None, help="cpu / 0 (NVIDIA GPU) / mps (Mac)，不填自動選")
    p.add_argument("--save", default=None, help="把結果另存成影片，例如 out.mp4")
    p.add_argument("--no-show", action="store_true", help="不開視窗 (伺服器上跑用)")
    return p.parse_args()


def draw_label(img, text, org, color=(0, 255, 0), scale=0.6, thickness=2):
    (w, h), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)
    x, y = org
    cv2.rectangle(img, (x, y - h - 6), (x + w + 4, y), color, -1)
    cv2.putText(img, text, (x + 2, y - 4), cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), thickness)


class PeopleCounter:
    """給排程用：需要時才開鏡頭拍幾幀、數人、關鏡頭，不在背景一直跑 (省 Raspberry Pi 的 CPU)。

    只要「目前人數」，所以用 predict 不用 track。取多幀的中位數，避免單幀漏抓或誤判。
    如果旁邊有 yolo26n_ncnn_model/ (NCNN 格式，在 Pi 上比 .pt 快很多) 就自動改用它。
    """

    def __init__(self, source=0, model="yolo26n.pt", conf=0.4, imgsz=640, frames=5):
        import os
        ncnn = os.path.splitext(model)[0] + "_ncnn_model"
        self.model = YOLO(ncnn if os.path.isdir(ncnn) else model)
        self.source, self.conf, self.imgsz, self.frames = source, conf, imgsz, frames

    def count(self) -> int:
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            raise RuntimeError(f"打不開攝影機 {self.source!r}")
        try:
            for _ in range(5):                    # 丟掉前幾幀，讓曝光穩定
                cap.read()
            counts = []
            for _ in range(self.frames):
                ok, frame = cap.read()
                if not ok:
                    continue
                r = self.model.predict(frame, classes=[0], conf=self.conf, imgsz=self.imgsz,
                                       device="cpu", verbose=False)[0]
                counts.append(0 if r.boxes is None else len(r.boxes))
        finally:
            cap.release()
        if not counts:
            raise RuntimeError("攝影機沒有讀到任何畫面")
        return sorted(counts)[len(counts) // 2]


def main():
    args = parse_args()
    source = int(args.source) if args.source.isdigit() else args.source

    # 沒指定 device 時：NVIDIA GPU > Apple 晶片 (MPS) > CPU
    device = args.device
    if device is None:
        import torch
        if torch.cuda.is_available():
            device = 0
        elif torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"
    print(f"使用裝置：{device}，來源：{source}")

    model = YOLO(args.model)

    frames_seen = {}   # track_id -> 出現過的幀數
    counted = set()    # 已確認計入累計人數的 ID
    writer = None
    prev_t = time.time()
    fps = 0.0

    results = model.track(
        source=source,
        stream=True,          # 逐幀產生結果，不會吃光記憶體
        classes=[0],          # COCO 類別 0 = person，只追蹤人
        conf=args.conf,
        imgsz=args.imgsz,
        tracker=args.tracker,
        persist=True,
        device=device,
        verbose=False,
    )

    for r in results:
        frame = r.orig_img.copy()
        current = 0

        if r.boxes is not None and r.boxes.id is not None:
            ids = r.boxes.id.int().tolist()
            boxes = r.boxes.xyxy.int().tolist()
            current = len(ids)
            for tid, (x1, y1, x2, y2) in zip(ids, boxes):
                frames_seen[tid] = frames_seen.get(tid, 0) + 1
                if frames_seen[tid] >= args.min_frames:
                    counted.add(tid)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                draw_label(frame, f"ID {tid}", (x1, max(y1, 20)))

        now = time.time()
        fps = 0.9 * fps + 0.1 * (1.0 / max(now - prev_t, 1e-6))
        prev_t = now

        draw_label(frame, f"Now: {current}", (10, 35), (0, 200, 255), 0.9)
        draw_label(frame, f"Total: {len(counted)}", (10, 75), (255, 200, 0), 0.9)
        draw_label(frame, f"FPS: {fps:.1f}", (10, 115), (200, 200, 200), 0.7)

        if args.save:
            if writer is None:
                h, w = frame.shape[:2]
                writer = cv2.VideoWriter(args.save, cv2.VideoWriter_fourcc(*"mp4v"), 25, (w, h))
            writer.write(frame)

        if not args.no_show:
            cv2.imshow("People Counter", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    if writer is not None:
        writer.release()
    cv2.destroyAllWindows()
    print(f"結束。累計不同人數：{len(counted)}")


if __name__ == "__main__":
    main()