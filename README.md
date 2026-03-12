# ArvyaX Nature Journal

An AI-assisted journaling system built with the MERN stack. Users write journal entries after immersive nature sessions (forest, ocean, mountain) and the app analyses their emotional state using the **Google Gemini** LLM.

---

## Tech Stack

| Layer    | Technology                        |
| -------- | --------------------------------- |
| Frontend | React 19 + Vite                   |
| Backend  | Node.js + Express 5               |
| Database | MongoDB + Mongoose                |
| LLM      | Google Gemini 2.5 Flash           |
| HTTP     | Axios                             |

---

## Prerequisites

- Node.js ≥ 18
- pnpm ≥ 8
- A running MongoDB instance (local or Atlas)
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)

---

## Getting Started

### 1. Clone & install dependencies

```bash
# Server
cd server
pnpm install

# Client
cd ../client
pnpm install
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/arvyax-journal
GEMINI_API_KEY=<your_key_here>
CLIENT_URL=http://localhost:5173
```

### 3. Run in development

**Terminal 1 – API server:**

```bash
cd server
pnpm dev
```

**Terminal 2 – React client:**

```bash
cd client
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## API Reference

### POST `/api/journal`

Create a new journal entry.

**Request body**

```json
{
  "userId": "123",
  "ambience": "forest",
  "text": "I felt calm today after listening to the rain."
}
```

**Response** `201` – the created entry document.

---

### GET `/api/journal/:userId`

Fetch all entries for a user (newest first).

**Response** `200` – array of entry documents.

---

### POST `/api/journal/analyze`

Analyse a text snippet with the Gemini LLM. If an `entryId` is supplied and the entry already has a stored analysis, the cached result is returned instead of making a new LLM call.

Rate limit: **10 requests / minute** per IP.

**Request body**

```json
{
  "text": "I felt calm today after listening to the rain",
  "entryId": "<optional mongo id>"
}
```

**Response** `200`

```json
{
  "emotion": "calm",
  "keywords": ["rain", "nature", "peace"],
  "summary": "User experienced relaxation during the forest session"
}
```

---

### POST `/api/journal/analyze/stream`

Same as `/analyze` but streams the Gemini response using **Server-Sent Events (SSE)**. The client receives incremental text chunks while the model is generating, followed by a final parsed result event.

Rate limit: **10 requests / minute** per IP.

**Request body** — same as `/analyze`.

**SSE event stream**

```
event: chunk
data: "I felt"

event: chunk
data: " calm..."

event: done
data: {"emotion":"calm","keywords":["rain","nature","peace"],"summary":"..."}
```

If a cached result exists the server emits a single `done` event immediately.

---

### GET `/api/journal/insights/:userId`

Aggregated insights derived from all analysed entries.

**Response** `200`

```json
{
  "totalEntries": 8,
  "topEmotion": "calm",
  "mostUsedAmbience": "forest",
  "recentKeywords": ["focus", "nature", "rain"]
}
```

---

## Project Structure

```
Arvyax-assignment/
├── docker-compose.yml       # Full-stack Docker setup
├── client/                  # React + Vite frontend
│   ├── Dockerfile
│   ├── nginx.conf           # Nginx reverse proxy (proxies /api → server)
│   └── src/
│       ├── components/
│       │   ├── EntryList.jsx    # Entry cards with streaming Analyze button
│       │   ├── InsightPanel.jsx
│       │   └── JournalForm.jsx
│       ├── services/
│       │   └── api.js           # Axios + SSE fetch helpers
│       └── App.jsx
└── server/                  # Express API
    ├── Dockerfile
    ├── models/
    │   └── JournalEntry.js      # Mongoose schema
    ├── routes/
    │   └── journal.js           # All /api/journal routes
    ├── services/
    │   └── geminiService.js     # Gemini LLM integration + LRU cache + streaming
    └── index.js                 # App entry point
```

---

## Running with Docker

Make sure Docker and Docker Compose are installed, then:

```bash
# Copy and fill in the env file
cp server/.env.example server/.env   # set GEMINI_API_KEY

# Build and start all services (MongoDB + API server + Nginx client)
docker compose up --build
```

Open [http://localhost](http://localhost).

The `docker-compose.yml` starts three services:
- **mongo** — MongoDB 7 with a named volume for persistence
- **server** — Express API on port 5000 (internal)
- **client** — React app served by Nginx on port 80, with `/api/*` proxied to the server

---

## Bonus Features Implemented

| Feature                   | Details                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| Streaming LLM response    | `POST /api/journal/analyze/stream` — SSE endpoint; frontend shows live typing while Gemini streams |
| Analysis caching (LRU)    | In-process LRU cache (500 entries, 1 h TTL) keyed by SHA-256 hash of text — no repeat LLM calls    |
| Analysis caching (DB)     | `analysis` sub-document persisted on the MongoDB entry; instant cache hit on re-request             |
| Rate limiting (global)    | 100 requests / 15 min per IP on all `/api/*` routes                                                 |
| Rate limiting (analysis)  | Stricter 10 requests / 1 min per IP on both `/analyze` endpoints                                    |
| Docker setup              | `Dockerfile` for server & client + `docker-compose.yml` with MongoDB, Express, and Nginx            |

---

## Running with a `.env` file

The server reads environment variables via `dotenv`. Never commit your real `.env` — only `.env.example` is tracked.
