# Async Jobs Example

Demonstrates a resumable async job pattern using standard Hono handlers in Sumi.

## Pattern

- `POST /jobs` creates a job and returns `202 { jobId }`
- `GET /jobs/:id` polls job status
- `GET /jobs/:id/stream` connects via SSE for real-time updates
- Jobs run in the background (simulated with setTimeout)

## Run

```bash
cd examples/lal-async-jobs
sumi dev
```

## Test

```bash
# Create a job
curl -X POST http://localhost:3000/jobs -H "Content-Type: application/json" -d '{"task":"process"}'

# Poll status
curl http://localhost:3000/jobs/JOB_ID

# Stream updates
curl http://localhost:3000/jobs/JOB_ID/stream
```
