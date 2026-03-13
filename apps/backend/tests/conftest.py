import sys
from pathlib import Path

# Ensure backend package roots are importable regardless of invocation directory.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
backend_root_str = str(BACKEND_ROOT)
if backend_root_str not in sys.path:
    sys.path.insert(0, backend_root_str)

# Generated gRPC modules import each other as top-level names.
PROTO_ROOT = BACKEND_ROOT / "protos"
proto_root_str = str(PROTO_ROOT)
if proto_root_str not in sys.path:
    sys.path.insert(0, proto_root_str)
