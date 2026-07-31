---
name: websocket-session-persistence
description: Connect to WebSocket with a stable chat_id so SOUL.md/USER.md/MEMORY.md load on every fresh connection instead of generating a random UUID each time.
---

# WebSocket Session Persistence

## When to Use

- User initiates a fresh WebSocket connection and memory files fail to load
- Nanobot behaves as a brand-new session with no context of Timmy, portfolio, or prior conversations
- After a connection drop, you want the same session context restored automatically

## Steps

```
1. On WebSocket connect URL, include ?chat_id=<session_id> as query param
   - Use a stable session identifier tied to the user (e.g., "timmy-prod", "timmy-dev")
   - Fallback for new/anonymous sessions: use "ws:default" as the chat_id
2. When the server receives a connection with chat_id:
   - Load SOUL.md, USER.md, MEMORY.md keyed to that chat_id
   - If "ws:default" and no prior session exists → start fresh (empty context)
3. Session continues normally with full memory context
```

## Key Rules

- **Random UUID per connection = broken sessions**: Every new connection generated a new UUID, so memory never loaded on reconnect
- **Fallback must be a named string**, not `null` — use `"ws:default"` as the sentinel
- Session state (conversation history, tool call results) is separate from memory files

## Example

**Broken connection:**
```
ws://localhost:8080/ws
→ chat_id: "a3f8b2c1-..." (random UUID each time) ❌
```

**Fixed connection:**
```
ws://localhost:8080/ws?chat_id=timmy-prod
→ chat_id: "timmy-prod" ✅
→ Loads /root/.nanobot/workspace/memory/SOUL.md
→ Loads /root/.nanobot/workspace/memory/USER.md
→ Loads /root/.nanobot/workspace/memory/MEMORY.md
```

## Output Format

On successful connection with known session:
```
✅ Session restored — timmy-prod
   Memory loaded: SOUL.md ✓ | USER.md ✓ | MEMORY.md ✓
```

On new/anonymous session:
```
🆕 New session started — ws:default
   Memory: empty (no prior context)
```
