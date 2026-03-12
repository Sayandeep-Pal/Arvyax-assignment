# Architecture — ArvyaX Nature Journal

## System Overview

```
┌─────────────┐  HTTP/JSON + SSE  ┌──────────────────────────────────┐
│  React SPA  │ ◄───────────────► │  Express API  (port 5000)        │
│ (Vite/Nginx │                   │                                  │
│  port 5173) │                   │  POST /api/journal               │
└─────────────┘                   │  GET  /api/journal/:userId       │
                                  │  POST /api/journal/analyze       │
                                  │  POST /api/journal/analyze/stream│
                                  │  GET  /api/journal/insights/:id  │
                                  └──────────────┬───────────────────┘
                                                 │
                              ┌──────────────────┼──────────────────────┐
                              │                  │                      │
                        ┌─────▼──────┐  ┌────────▼──────┐  ┌──────────▼────────┐
                        │  MongoDB   │  │  Gemini 2.5   │  │  In-process LRU   │
                        │ (Mongoose) │  │  Flash (LLM)  │  │  cache (lru-cache)│
                        └────────────┘  └───────────────┘  └───────────────────┘
```

---

## 1. How would you scale this to 100 000 users?

**Horizontal scaling of the API layer**

- Run multiple Express instances behind a load balancer (e.g., AWS ALB / nginx). Express is stateless, so any instance can serve any request.
- Use PM2 cluster mode as a first, zero-infrastructure step for vertical scaling.

**Database**

- Switch the MongoDB deployment to a replica set for high-availability reads and a write-concern that tolerates node failures.
- Introduce **read replicas** — the `GET /journal/:userId` and `GET /insights/:userId` endpoints are read-heavy and benefit immediately.
- Index `userId` (already present in the schema) and add a compound index on `(userId, createdAt)` for the sorted listing query.
- For very high write throughput consider MongoDB Atlas with auto-scaling sharding on the `userId` key.

**LLM calls**

- LLM calls are the most expensive operation. Move analysis to a **background job queue** (BullMQ + Redis). When a user clicks "Analyse", the API enqueues a job and returns `202 Accepted` with a job ID. The client polls `/api/journal/job/:id` or receives a push notification via WebSocket/SSE.
- This decouples the HTTP request lifetime from slow LLM latency and allows the worker pool to be scaled independently.

---

## 2. How would you reduce LLM cost?

1. **Cache analysis results** — store the LLM response in the `analysis` sub-document on the `JournalEntry`. Re-requests for the same entry return the cached value instantly. *(Already implemented.)*

2. **Content-hash deduplication** — compute a SHA-256 hash of the normalised text before calling the LLM. Maintain a separate `AnalysisCache` collection keyed by hash. If the same text is submitted by different users, only one LLM call is made.

3. **Token reduction** — truncate very long entries to the first 400–500 tokens before building the prompt. Mental-wellness emotion analysis rarely needs the full verbatim text.

4. **Batch analysis** — if insights are computed nightly (via a cron job), batch multiple un-analysed entries into a single prompt instead of one call per entry.

5. **Model tiering** — use a smaller/cheaper model (e.g., `gemini-2.0-flash-lite`) for single-entry analysis and the full `gemini-2.5-flash` model only for weekly insight summaries.

---

## 3. How would you cache repeated analysis?

Three-layer strategy:

| Layer | Mechanism | Scope | TTL | Status |
|---|---|---|---|---|
| **Application** | `lru-cache` keyed by SHA-256(text) | in-process, sub-ms | 1 hour | **Implemented** |
| **Database** | `analysis` sub-doc on `JournalEntry` | per entry, permanent | infinite | **Implemented** |
| **Distributed** | Redis `SET nx ex` keyed by SHA-256(text) | cross-instance, shared | 24 hours | Recommended for production |

**Current lookup flow (implemented):**

1. Compute `key = sha256(normalise(text))`.
2. Check in-process LRU cache (`lru-cache`, 500 entries, 1 h TTL) → hit: return immediately.
3. If `entryId` supplied, check MongoDB `entry.analysis` → hit: return immediately.
4. Call Gemini 2.5 Flash API.
5. Store result in LRU cache.
6. If `entryId` supplied, persist `analysis` on the MongoDB document.

**Recommended addition for multi-instance deployments:**

Insert a Redis check between steps 2 and 3. On a miss, backfill Redis + LRU after the Gemini call. This ensures all instances share the same cache, preventing duplicate LLM calls across pods.

---

## 4. How would you protect sensitive journal data?

**Encryption at rest**

- Enable MongoDB encryption-at-rest (MongoDB Atlas supports this natively via storage engine encryption).
- For field-level sensitivity, use **client-side field-level encryption (CSFLE)** so the server never sees plaintext journal text; the MongoDB driver encrypts/decrypts on the client side using a customer-managed key.

**Encryption in transit**

- Enforce TLS for all connections (HTTPS for the API, `tls: true` in the MongoDB connection string).

**Authentication & authorisation**

- Replace the current plain-text `userId` parameter with **JWT-based authentication** (e.g., via Auth0 / Clerk). The server extracts the authenticated user ID from the verified token, ignoring any user-supplied ID.
- Enforce ownership checks: a user can only read/write their own entries (`entry.userId === req.userId`).

**API security**

- Rate limiting is applied at two levels: 100 req/15 min globally on all `/api/*` routes, and a stricter 10 req/1 min on both `/analyze` endpoints to guard against LLM cost abuse. Both are already implemented via `express-rate-limit`.
- Sanitise all user input (text, ambience) at the route layer to prevent injection.

**Audit logging**

- Log every read of journal data with the requesting user ID and timestamp to an append-only audit log (e.g., MongoDB capped collection or a SIEM).

**Data minimisation**

- Do not send raw journal text to the LLM beyond what is necessary for analysis. Strip PII (names, dates, locations) with a lightweight regex pass before the Gemini prompt.
