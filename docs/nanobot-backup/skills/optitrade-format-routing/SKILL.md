---
name: optitrade-format-routing
description: Route responses by channel — Discord → plain text; WebSocket → openui-lang declarative UI format (Card/Callout, FollowUpBlock).
---

# OptiTrade Format Routing

## When to Use

- Starting a new conversation with Timmy on any channel
- Responding to a question from a fresh connection (WebSocket or Discord)
- Generating structured output that will be rendered by OptiTrade's UI

## Channel Routing Rules

| Channel | Format | Example |
|---------|--------|---------|
| **Discord** | Plain text | No markdown blocks, no UI components |
| **WebSocket** | openui-lang declarative UI | Card, Callout, FollowUpBlock, Button |
| **Terminal/CLI** | Markdown | `## Headers`, `**bold**`, `---` |

## WebSocket — openui-lang Format

### Basic Card
```
[
  {
    "type": "Card",
    "title": "Title Here",
    "body": "Body text — concise, actionable"
  }
]
```

### Callout (highlight/warning)
```
[
  {
    "type": "Callout",
    "intent": "info | warning | success | error",
    "title": "Optional Title",
    "body": "Callout body text"
  }
]
```

### Multi-item Card
```
[
  {
    "type": "Card",
    "title": "Portfolio Update — 2026-05-17",
    "body": "NVDA ×200 | Entry: $XXX | Current: $XXX | P/L: +X%\nAAPL ×10 | Entry: $XXX | Current: $XXX | P/L: +X%"
  }
]
```

### FollowUpBlock (for multi-step tasks)
```
[
  {
    "type": "FollowUpBlock",
    "title": "Next Steps",
    "items": [
      "Confirm if you want to sell the $21.5 call on FIG",
      "Check MU entry zone — waiting for $650-680 pullback",
      "Review heartbeat — FIG earnings tomorrow"
    ]
  }
]
```

### Table format
```
[
  {
    "type": "Card",
    "title": "Analysis — {TICKER}",
    "body": "| Field | Value |\n|-------|-------|\n| Price | $XXX |\n| PE | Xx |\n| Signal | BUY/HOLD |"
  }
]
```

## Key Rules

- **No channel-specific instructions in prompts**: Once routing is set, all system prompts handle both channels automatically
- **Plain text for Discord**: No JSON blocks, no UI component names
- **openui-lang for WebSocket**: Use exact type names (Card, Callout, FollowUpBlock)
- **Never mix formats**: If WebSocket detected, use openui-lang. If Discord, use plain text
- **Detect channel from context**: WebSocket connections include `?chat_id=` in URL; Discord messages come via the Discord bot relay

## Example

**Timmy asks "What's my portfolio looking like?" on WebSocket**:

```
[
  {
    "type": "Card",
    "title": "Portfolio — 2026-05-17",
    "body": "NVDA ×200 | +20.45% overall | Total: $110,211\n\nAAPL | MSFT | AMZN | JPM | NFLX — all positions green"
  },
  {
    "type": "Callout",
    "intent": "info",
    "title": "Next Watch",
    "body": "MU entry zone: $650-680 | FIG earnings: May 14"
  }
]
```

**Same question on Discord**:

```
Portfolio — 2026-05-17

NVDA ×200 | +20.45% overall | Total: $110,211
AAPL | MSFT | AMZN | JPM | NFLX — all green

Next watch: MU $650-680 entry | FIG earnings May 14
```
