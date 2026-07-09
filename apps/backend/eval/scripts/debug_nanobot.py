"""Tiny debug script: open Nanobot WS, send a single payload, print EVERY
frame we receive (raw bytes included). Used to discover the actual wire
protocol when the documented protocol doesn't match.
"""
import asyncio
import json
import sys
import websockets

WS_URL = "ws://178.128.213.162:8765/?client_id=OptiTrade&token=capstone"


async def main():
    async with websockets.connect(WS_URL, open_timeout=20) as ws:
        print(f"[debug] connected to {WS_URL}", flush=True)
        # Try a minimal first message — just plain text, no envelope.
        await ws.send("Hello.")
        print("[debug] sent: Hello.", flush=True)
        try:
            for i in range(20):
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=8.0)
                except asyncio.TimeoutError:
                    print(f"[debug] recv timeout on iter {i+1}, stopping", flush=True)
                    break
                print(f"[debug] frame {i+1}: {raw!r}", flush=True)
                # Try to parse and pretty-print if JSON
                if isinstance(raw, (str, bytes)):
                    text = raw if isinstance(raw, str) else raw.decode("utf-8", "replace")
                    try:
                        obj = json.loads(text)
                        print(f"[debug]   parsed JSON: {json.dumps(obj)[:300]}", flush=True)
                    except json.JSONDecodeError:
                        pass
        except websockets.ConnectionClosed as exc:
            print(f"[debug] closed by server: code={exc.code} reason={exc.reason!r}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())