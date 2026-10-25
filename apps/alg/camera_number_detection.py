"""
即時人數偵測 (YOLO26 ONNX，不需要 torch / ultralytics)

持續讀攝影機，顯示「目前畫面中有幾個人」。

安裝 (Raspberry Pi 或電腦都一樣)：
    pip install onnxruntime opencv-python numpy
    (沒有螢幕、只看終端機輸出的話，可改裝 opencv-python-headless 並加 --no-show)

模型：先在電腦上把 .pt 轉成 ONNX 再複製過去 (Pi 上不用 yolo26n.pt)：
    yolo export model=yolo26n.pt format=onnx imgsz=320 end2end=True

執行：
    python camera_number_detection.py                      # 預設攝影機 0
    python camera_number_detection.py --source 1           # 換另一支鏡頭
    python camera_number_detection.py --source video.mp4   # 影片檔
    python camera_number_detection.py --source rtsp://...  # 網路攝影機串流
    python camera_number_detection.py --no-show            # 不開視窗，只在終端機印人數
    python camera_number_detection.py --no-show --save out.mp4   # 把辨識過程 (框 + 人數) 錄成影片
按 q 結束 (或 Ctrl+C)。
"""

import argparse
import time

import cv2
import numpy as np


def parse_args():
    p = argparse.ArgumentParser(description="即時人數偵測")
    p.add_argument("--source", default="0", help="攝影機編號(0, 1...)、影片路徑或 RTSP 網址")
    p.add_argument("--model", default="yolo26n.onnx", help="ONNX 模型路徑")
    p.add_argument("--conf", type=float, default=0.4, help="偵測信心門檻")
    p.add_argument("--threads", type=int, default=4, help="CPU 執行緒數 (Pi 4/5 用 4)")
    p.add_argument("--no-show", action="store_true", help="不開視窗，只在終端機印人數")
    p.add_argument("--save", default=None, help="把辨識過程錄成影片，例如 out.mp4")
    p.add_argument("--save-fps", type=float, default=5,
                   help="影片的播放 FPS，設成跟實際偵測速度差不多 (Pi 上約 3~8) 播放才不會快轉")
    return p.parse_args()


def draw_label(img, text, org, color=(0, 255, 0), scale=0.6, thickness=2):
    (w, h), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)
    x, y = org
    cv2.rectangle(img, (x, y - h - 6), (x + w + 4, y), color, -1)
    cv2.putText(img, text, (x + 2, y - 4), cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), thickness)


class PeopleCounter:
    """用 onnxruntime + OpenCV 跑 YOLO ONNX 模型數人，不需要 ultralytics / torch。

    detect(frame) 回傳畫面中每個人的框；count() 給排程用：需要時才開鏡頭拍幾幀、
    取中位數、關鏡頭，不在背景一直跑 (省 Raspberry Pi 的 CPU)。
    輸入尺寸跟著匯出時的 imgsz 走 (建議 320，Pi 上快很多)。
    """

    def __init__(self, source=0, model="yolo26n.onnx", conf=0.4, frames=5, threads=4):
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = threads
        self.session = ort.InferenceSession(model, opts, providers=["CPUExecutionProvider"])
        inp = self.session.get_inputs()[0]
        self.input_name = inp.name
        self.imgsz = inp.shape[2] if isinstance(inp.shape[2], int) else 640
        self.source, self.conf, self.frames = source, conf, frames

    def detect(self, frame) -> list[tuple[int, int, int, int]]:
        """回傳每個人的框 (x1, y1, x2, y2)，座標是原始畫面上的。"""
        # letterbox：等比縮放後補灰邊成正方形，跟 ultralytics 的前處理一致
        h, w = frame.shape[:2]
        s = self.imgsz / max(h, w)
        nh, nw = round(h * s), round(w * s)
        img = np.full((self.imgsz, self.imgsz, 3), 114, np.uint8)
        top, left = (self.imgsz - nh) // 2, (self.imgsz - nw) // 2
        img[top:top + nh, left:left + nw] = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_LINEAR)
        blob = cv2.dnn.blobFromImage(img, 1 / 255.0, swapRB=True)   # BGR->RGB, HWC->NCHW
        out = self.session.run(None, {self.input_name: blob})[0][0]

        if out.shape[-1] == 6:
            # YOLO26 (end-to-end，免 NMS)：每列 [x1, y1, x2, y2, score, class]
            boxes = out[(out[:, 4] >= self.conf) & (out[:, 5] == 0), :4]
        else:
            # 舊版輸出 (84, N) = 4 個 cxcywh + 80 類分數，要自己做 NMS
            out = out.T
            keep = out[:, 4] >= self.conf          # class 0 = person
            cand, scores = out[keep, :4], out[keep, 4]
            xywh = np.column_stack([cand[:, 0] - cand[:, 2] / 2, cand[:, 1] - cand[:, 3] / 2,
                                    cand[:, 2], cand[:, 3]])
            idx = cv2.dnn.NMSBoxes(xywh.tolist(), scores.tolist(), self.conf, 0.45) if len(cand) else []
            boxes = xywh[np.array(idx, dtype=int).reshape(-1)]
            boxes[:, 2:] += boxes[:, :2]           # xywh -> xyxy

        # 從 letterbox 座標換回原始畫面
        boxes = (boxes - [left, top, left, top]) / s
        return [tuple(int(v) for v in b) for b in boxes]

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
                if ok:
                    counts.append(len(self.detect(frame)))
        finally:
            cap.release()
        if not counts:
            raise RuntimeError("攝影機沒有讀到任何畫面")
        return sorted(counts)[len(counts) // 2]


def main():
    args = parse_args()
    source = int(args.source) if args.source.isdigit() else args.source
    counter = PeopleCounter(source, args.model, args.conf, threads=args.threads)

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise SystemExit(f"打不開攝影機 {source!r}")
    print(f"模型：{args.model} (輸入 {counter.imgsz})，來源：{source}")

    prev_t = time.time()
    fps = 0.0
    last = None
    writer = None
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            boxes = counter.detect(frame)
            current = len(boxes)

            now = time.time()
            fps = 0.9 * fps + 0.1 * (1.0 / max(now - prev_t, 1e-6))
            prev_t = now

            if current != last:                   # 人數有變才印，終端機不會洗版
                print(f"[{time.strftime('%H:%M:%S')}] 目前人數：{current}")
                last = current

            if args.save or not args.no_show:
                for x1, y1, x2, y2 in boxes:
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                draw_label(frame, f"People: {current}", (10, 35), (0, 200, 255), 0.9)
                draw_label(frame, f"FPS: {fps:.1f}", (10, 75), (200, 200, 200), 0.7)
                draw_label(frame, time.strftime("%Y-%m-%d %H:%M:%S"), (10, 115), (255, 255, 255), 0.6)

            if args.save:
                if writer is None:
                    h, w = frame.shape[:2]
                    writer = cv2.VideoWriter(args.save, cv2.VideoWriter_fourcc(*"mp4v"), args.save_fps, (w, h))
                    if not writer.isOpened():
                        raise SystemExit(f"無法建立影片檔 {args.save!r}")
                    print(f"錄影中 -> {args.save}")
                writer.write(frame)

            if not args.no_show:
                try:
                    cv2.imshow("People Counter", frame)
                except cv2.error:
                    # opencv-python-headless 或沒有螢幕 (SSH)：改成只在終端機印人數
                    print("無法開視窗，改成只印人數 (Ctrl+C 結束)")
                    args.no_show = True
                    continue
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        if writer is not None:
            writer.release()                      # 一定要 release，不然 mp4 會壞掉打不開
            print(f"影片已存到 {args.save}")
        if not args.no_show:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
