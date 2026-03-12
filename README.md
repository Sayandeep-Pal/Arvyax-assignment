# ArvyaX Nature Journal

An AI-assisted journaling system built with the MERN stack. Users write journal entries after immersive nature sessions (forest, ocean, mountain) and the app analyses their emotional state using the **Google Gemini** LLM.

---

## Tech Stack

| Layer    | Technology                        |
| -------- | --------------------------------- |
| Frontend | React 19 + Vite                   |
| Backend  | Node.js + Express 5               |
| Database | MongoDB + Mongoose                |
| LLM      | Google Gemini 2.0 Flash           |
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
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── EntryList.jsx
│       │   ├── InsightPanel.jsx
│       │   └── JournalForm.jsx
│       ├── services/
│       │   └── api.js       # Axios wrappers
│       └── App.jsx
└── server/                  # Express API
    ├── models/
    │   └── JournalEntry.js  # Mongoose schema
    ├── routes/
    │   └── journal.js       # All /api/journal routes
    ├── services/
    │   └── geminiService.js # Gemini LLM integration
    └── index.js             # App entry point
```

---

## Bonus Features Implemented

| Feature                  | Details                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| Analysis caching         | `analysis` field stored on the MongoDB document; skips LLM on repeat |
| Rate limiting            | 100 requests / 15 min per IP via `express-rate-limit`                 |
| Centralised error handler| Global Express error middleware with consistent JSON error format     |

---

## Running with a `.env` file

The server reads environment variables via `dotenv`. Never commit your real `.env` — only `.env.example` is tracked.
