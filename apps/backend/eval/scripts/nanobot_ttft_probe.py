"""Live Nanobot TTFT (Time To First Token) probe.

Connects to the production Nanobot WebSocket at
``ws://178.128.213.162:8765/?client_id=OptiTrade&token=capstone`` and
measures wall-clock latency from `ws.send(payload)` to the first frame
that carries non-empty `text` content.

The TTFT metric tracks what the user sees in the dashboard:
  - TTFT-reasoning: time to the first ``reasoning_delta`` (the "Thinking…"
    block begins streaming). The user sees the spinner → "thinking" box.
  - TTFT-answer:    time to the first ``delta`` (the answer text begins
    streaming into the chat). The user sees the first answer character.
  - server-reported ``latency_ms`` in ``turn_end``: the model's own
    authoritative end-to-end number.

Protocol (matches `apps/frontend/lib/use-nanobot.ts:556-570`):
  - Send: plain text payload. First message may include the OpenUI
    system prompt; subsequent ones are bare user text.
  - Receive: JSON frames:
        ready            → chat_id assigned
        goal_status      → running / idle
        reasoning_delta  → text (chain-of-thought streaming)
        reasoning_end    → thinking complete
        delta            → text (answer streaming)
        stream_end       → per-stream done
        turn_end         → chat done; carries `latency_ms`
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import websockets

WS_URL = "ws://178.128.213.162:8765/?client_id=OptiTrade&token=capstone"

# Same first-message system prompt prefix the production UI uses
# (apps/frontend/lib/use-nanobot.ts:562-565).
OPENUI_SYSTEM_PROMPT = (
    "You are OptiTrade's AI assistant. Provide concise, accurate answers "
    "using any pinned widget context the user supplies. End with: "
    "Educational only, not investment advice."
)

# 10 short probe questions spanning the four widget surfaces that the live
# dashboard would actually ask. Each probe is a discrete WebSocket session
# so we measure cold-start latency per probe (no cross-probe caching).
PROBE_QUESTIONS = [
    "What's the latest news affecting AAPL?",
    "Is NVDA's RSI overbought right now?",
    "What's the unrealized PnL of my AAPL position?",
    "Describe the chart pattern detected on TSLA.",
    "What is my portfolio's biggest sector exposure?",
    "Has the Fed signaled anything for next month?",
    "Show me a summary stat for NVDA's last close.",
    "What's the breakout level on MSFT's Ascending Triangle?",
    "How concentrated is my portfolio in Technology?",
    "What's the sentiment of today's news for JPM?",
]


@dataclass
class TTFTRecord:
    probe_index: int
    question: str
    ready_ms: float
    send_ms: float
    ttft_reasoning_ms: float          # time to first reasoning_delta with text
    first_reasoning_event: str | None
    ttft_answer_ms: float              # time to first answer delta with text
    first_answer_event: str | None
    server_latency_ms: float          # from turn_end.latency_ms
    total_session_ms: float
    turn_end_seen: bool
    error: str | None = None


async def _measure_one(probe_index: int, question: str, *, timeout: float) -> TTFTRecord:
    """Open a connection, send the question, record TTFT + total session."""
    record = TTFTRecord(
        probe_index=probe_index,
        question=question,
        ready_ms=0.0,
        send_ms=0.0,
        ttft_reasoning_ms=0.0,
        first_reasoning_event=None,
        ttft_answer_ms=0.0,
        first_answer_event=None,
        server_latency_ms=0.0,
        total_session_ms=0.0,
        turn_end_seen=False,
    )
    session_t0 = time.monotonic()
    chat_id = f"probe-{uuid.uuid4().hex[:8]}"
    try:
        async with websockets.connect(WS_URL, open_timeout=timeout) as ws:
            # First frame is "ready" carrying chat_id.
            first_frame = json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout))
            record.ready_ms = (time.monotonic() - session_t0) * 1000
            if first_frame.get("event") != "ready":
                record.error = f"first frame not ready: {first_frame}"
                return record
            record.first_reasoning_event = first_frame.get("event")

            # Send the user question (with system prompt prefix for the
            # first-time connection — same shape as the production UI).
            send_t0 = time.monotonic()
            payload = (
                f"{OPENUI_SYSTEM_PROMPT}\n\n[{chat_id}] User: {question}"
            )
            await ws.send(payload)
            record.send_ms = (time.monotonic() - send_t0) * 1000
            stream_t0 = time.monotonic()

            # Read frames until turn_end or timeout. Capture the first frame
            # that carries text per-channel.
            while True:
                remaining = timeout - (time.monotonic() - session_t0)
                if remaining <= 0:
                    record.error = f"timeout after {timeout}s"
                    return record
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
                except asyncio.TimeoutError:
                    record.error = f"recv timeout after {timeout}s"
                    return record
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                event = data.get("event")
                text = data.get("text") or ""
                if event == "turn_end":
                    record.server_latency_ms = float(data.get("latency_ms") or 0.0)
                    record.turn_end_seen = True
                    record.total_session_ms = (time.monotonic() - session_t0) * 1000
                    return record
                if not text:
                    continue
                # First text-bearing frame by event type — record the first
                # frame that *carries text*, including the very first one.
                if event in ("reasoning_delta", "message") and record.ttft_reasoning_ms == 0.0:
                    if event == "reasoning_delta":
                        record.ttft_reasoning_ms = (time.monotonic() - stream_t0) * 1000
                        record.first_reasoning_event = event
                    elif event == "message" and record.ttft_reasoning_ms == 0.0:
                        # Some servers use `message` for the first non-reasoning
                        # token-bearing frame. Treat as the answer TTFT if not
                        # yet recorded.
                        record.ttft_reasoning_ms = (time.monotonic() - stream_t0) * 1000
                        record.first_reasoning_event = event
                elif event == "delta" and record.ttft_answer_ms == 0.0:
                    record.ttft_answer_ms = (time.monotonic() - stream_t0) * 1000
                    record.first_answer_event = event
    except Exception as exc:
        record.error = f"{type(exc).__name__}: {exc}"
    finally:
        record.total_session_ms = (time.monotonic() - session_t0) * 1000
    return record


async def _run_all(n: int, timeout: float) -> list[TTFTRecord]:
    out: list[TTFTRecord] = []
    for i in range(n):
        rec = await _measure_one(i + 1, PROBE_QUESTIONS[i], timeout=timeout)
        out.append(rec)
        if rec.error:
            print(f"  [{i+1:>2}/{n}] ERROR: {rec.error}", flush=True)
        else:
            print(
                f"  [{i+1:>2}/{n}] ready={rec.ready_ms:4.0f}ms  send={rec.send_ms:4.0f}ms  "
                f"TTFT-reasoning={rec.ttft_reasoning_ms:6.0f}ms  "
                f"TTFT-answer={rec.ttft_answer_ms:6.0f}ms  "
                f"server_latency={rec.server_latency_ms:6.0f}ms  "
                f"total={rec.total_session_ms:6.0f}ms",
                flush=True,
            )
    return out


def _render_markdown(records: list[TTFTRecord], *, db_path: Path) -> str:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    successful = [r for r in records if r.error is None]
    if not successful:
        return (
            f"# Nanobot TTFT probe — {today}\n\n"
            f"- url: `{WS_URL}`\n"
            f"- probes attempted: {len(records)}\n"
            f"- probes successful: 0\n\n"
            f"## Status: all probes failed\n\n"
            f"Droplet unreachable or protocol changed. Inspect "
            f"`apps/backend/eval/results/nanobot-ttft-*.json`.\n"
        )

    def _stats(vals: list[float]) -> str:
        if not vals:
            return "n/a"
        return (
            f"min {min(vals):.0f} · median {statistics.median(vals):.0f} · "
            f"mean {statistics.mean(vals):.0f} · "
            f"p95 {sorted(vals)[max(0, int(len(vals)*0.95) - 1)]:.0f} · "
            f"max {max(vals):.0f} (n={len(vals)})"
        )

    reasoning = [r.ttft_reasoning_ms for r in successful]
    answer = [r.ttft_answer_ms for r in successful if r.ttft_answer_ms > 0]
    server = [r.server_latency_ms for r in successful if r.server_latency_ms > 0]

    lines = [
        f"# Nanobot TTFT probe — {today}",
        "",
        f"- url: `{WS_URL}`",
        f"- probes attempted: {len(records)} · successful: {len(successful)}",
        f"- per-probe timeout: {_p_timeout}",  # placeholder, filled below
        "",
        "## Latency summary (ms)",
        "",
        "| metric | result |",
        "| --- | --- |",
        f"| TTFT to first reasoning_delta (chain-of-thought begins) | {_stats(reasoning)} |",
        f"| TTFT to first answer delta (user-facing text begins) | {_stats(answer)} |",
        f"| server-reported `turn_end.latency_ms` (model's authoritative E2E) | {_stats(server)} |",
        "",
        "## Per-probe detail",
        "",
        "| # | question (truncated) | ready | send | TTFT-reasoning | TTFT-answer | server_latency | total |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for r in successful:
        lines.append(
            f"| {r.probe_index} | {r.question[:40]} | {r.ready_ms:.0f} | {r.send_ms:.0f} "
            f"| {r.ttft_reasoning_ms:.0f} | {r.ttft_answer_ms:.0f} "
            f"| {r.server_latency_ms:.0f} | {r.total_session_ms:.0f} |"
        )
    failures = [r for r in records if r.error]
    if failures:
        lines += ["", "## Failed probes", ""]
        for r in failures:
            lines.append(f"- probe {r.probe_index} ({r.question[:60]}): {r.error}")
    return "\n".join(lines) + "\n"


# Global so `_render_markdown` can pick up the configured timeout.
_p_timeout = 30.0


def main() -> int:
    global _p_timeout
    parser = argparse.ArgumentParser()
    parser.add_argument("--probes", type=int, default=10,
                        help="number of probe questions to send (max 10)")
    parser.add_argument("--timeout", type=float, default=45.0,
                        help="per-probe timeout in seconds")
    parser.add_argument("--out-dir", type=Path,
                        default=Path(__file__).resolve().parents[1] / "results")
    args = parser.parse_args()
    _p_timeout = args.timeout

    n = min(args.probes, len(PROBE_QUESTIONS))
    print(f"Running {n} probes against {WS_URL}")
    records = asyncio.run(_run_all(n, timeout=args.timeout))

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    md_path = Path(__file__).resolve().parents[4] / "docs" / f"nanobot-ttft-{today}.md"
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text(_render_markdown(records, db_path=md_path))
    json_path = args.out_dir / f"nanobot-ttft-{today.replace('-', '')}.json"
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps([asdict(r) for r in records], indent=2))
    print()
    print(_render_markdown(records, db_path=md_path))
    print(f"Wrote {md_path}")
    print(f"Wrote {json_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())