"""Diagnostic: send the EXACT payload the production UI sends on first
message (OpenUI prompt + User prefix + question) and see if the server
replies. Then send just the question (no prompt) and compare.
"""
import asyncio
import websockets

WS_URL = "ws://178.128.213.162:8765/?client_id=OptiTrade&token=capstone"

OPENUI_PROMPT = (
    "You are OptiTrade's AI assistant. Provide concise, accurate answers "
    "using any pinned widget context the user supplies. End with: "
    "Educational only, not investment advice."
)


async def probe(label: str, payload: str):
    import time, json
    print(f"=== {label} ===", flush=True)
    print(f"payload (first 80 chars): {payload[:80]!r}", flush=True)
    t0 = time.monotonic()
    async with websockets.connect(WS_URL, open_timeout=20) as ws:
        # drain the ready frame
        ready = json.loads(await ws.recv())
        print(f"ready: chat_id={ready.get('chat_id')[:8]}... elapsed={(time.monotonic()-t0)*1000:.0f}ms", flush=True)
        send_t = time.monotonic()
        await ws.send(payload)
        # Read up to 10 frames, stop on turn_end.
        for i in range(15):
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=15)
            except asyncio.TimeoutError:
                print(f"  RECV TIMEOUT after {(time.monotonic()-send_t)*1000:.0f}ms", flush=True)
                return
            data = json.loads(raw)
            elapsed_ms = (time.monotonic() - send_t) * 1000
            ev = data.get("event")
            text_len = len(data.get("text") or "")
            print(f"  +{elapsed_ms:7.0f}ms  {ev:<20}  text={text_len:>4}c  latency={data.get('latency_ms','-')}", flush=True)
            if ev == "turn_end":
                return


async def main():
    await probe(
        "TEST 1: bare prompt payload (production UI first message)",
        f"{OPENUI_PROMPT}\n\nUser: What's AAPL's RSI right now?",
    )
    print()
    await probe(
        "TEST 2: bare question, no prompt",
        "What's AAPL's RSI right now?",
    )
    print()
    await probe(
        "TEST 3: long prompt + bracketed chat_id prefix (my probe format)",
        f"{OPENUI_PROMPT}\n\n[probe-abc12345] User: What's AAPL's RSI right now?",
    )


if __name__ == "__main__":
    asyncio.run(main())