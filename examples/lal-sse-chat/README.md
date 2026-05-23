# SSE Chat Example

Demonstrates streaming LLM-style responses via Server-Sent Events in Sumi.

## Pattern

- `POST /chat` accepts a `{ prompt: string }` body
- Returns SSE stream with token-by-token responses
- Uses validated JSON body and middleware

## Run

```bash
cd examples/lal-sse-chat
sumi dev
```

## Test

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello"}'
```
