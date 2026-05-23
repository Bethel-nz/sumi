# WebSocket Agent Example

Demonstrates a WebSocket backend for agent-style interaction in Sumi.

## Pattern

- `WS /agent` connects a persistent WebSocket
- Server echoes user messages with an "agent prefix"
- In production, replace echo with actual LLM/agent logic

## Run

```bash
cd examples/lal-ws-agent
sumi dev
```

## Test

Open `ws://localhost:3000/agent` in a WebSocket client or browser.
