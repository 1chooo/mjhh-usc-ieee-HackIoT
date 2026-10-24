# yolo

Optional YOLO training workspace. It is not part of `pnpm` or Turbo.

Images, labels, checkpoints (`*.pt`), and Ultralytics run folders stay on the machine. Do not commit them.

```sh
cd packages/yolo
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python train.py --data /path/to/data.yaml
```

A dataset file points at train and val image folders and names the classes:

```yaml
path: /absolute/path/to/dataset
train: images/train
val: images/val
names:
  0: device
```

Detections can later be published as telemetry through `device-gateway`. The message shape is `packages/shared-types/schemas/device-telemetry.json`.
