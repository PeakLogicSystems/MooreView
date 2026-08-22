#!/usr/bin/env python3
"""Build a minimal 64->4 ONNX classifier for lift-station PdM study (host tensor path)."""
import json
import sys
from pathlib import Path

try:
    import numpy as np
    import onnx
    from onnx import TensorProto, helper, numpy_helper
except ImportError:
    print("pip install onnx numpy", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "models" / "lift-submersible-v3.onnx"
INPUT_DIM = 64
LABELS = ["healthy", "seal_leak", "clog_ragging", "impeller_worn"]

rng = np.random.default_rng(42)
W = rng.normal(0, 0.08, (4, INPUT_DIM)).astype(np.float32)
W[0, 0:6] = -0.35
W[1, 3:8] = 0.25
W[2, 8:14] = 0.35
W[3, 0:6] = 0.45
W[3, 14:18] = 0.3
B = np.array([0.4, 0.1, 0.05, -0.2], dtype=np.float32)

X = helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, INPUT_DIM])
Y = helper.make_tensor_value_info("output", TensorProto.FLOAT, [1, 4])
W_init = numpy_helper.from_array(W, name="W")
B_init = numpy_helper.from_array(B, name="B")
# W is [out, in] like torch.nn.Linear; Gemm needs transB=1 so Y = input @ W.T + B → [1, 4]
gemm = helper.make_node("Gemm", ["input", "W", "B"], ["output"], alpha=1.0, beta=1.0, transB=1)
graph = helper.make_graph([gemm], "lift_study", [X], [Y], [W_init, B_init])
model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)])
model.ir_version = 8
onnx.checker.check_model(model)
OUT.parent.mkdir(parents=True, exist_ok=True)
onnx.save(model, OUT)
meta = OUT.with_suffix(".onnx.json")
meta.write_text(json.dumps({"labels": LABELS, "inputDim": INPUT_DIM}, indent=2), encoding="utf-8")
print(f"Wrote {OUT}")
