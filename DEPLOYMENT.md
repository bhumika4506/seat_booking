# SeatFlow — Deployment Guide

## Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm 9+

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend will automatically create `data.json` with all squads, members, and seats on first run.

**API available at:** `http://localhost:8000`
**API docs at:** `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

**Frontend available at:** `http://localhost:5173`

### Environment Variables

**Backend** (optional, defaults shown):
```
DATA_FILE=data.json
PORT=8000
```

**Frontend** (optional, defaults shown):
```
VITE_API_URL=http://localhost:8000
```

---

## Production Deployment

### Backend
1. Install dependencies: `pip install -r requirements.txt`
2. Run: `uvicorn main:app --host 0.0.0.0 --port 8000`
3. Update CORS origins in `main.py` to your frontend domain

### Frontend
1. Set `VITE_API_URL` to your backend URL
2. Build: `npm run build`
3. Serve the `dist/` folder with any static file server

### Build Commands
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
VITE_API_URL=https://your-backend-url.com npm run build
# Serve dist/ folder
```

---

## Data Persistence

- Development uses `data.json` (auto-created on first run)
- For production, replace with PostgreSQL
- Use `GET /reset` endpoint to clear all data during development

---

## Project Structure

```
seat_allocation_system/
├── backend/
│   ├── main.py              ← FastAPI application
│   ├── requirements.txt     ← Python dependencies
│   ├── data.json            ← Auto-created on first run
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── main.jsx         ← React entry point
│       ├── App.jsx          ← Root layout + routing
│       ├── index.css        ← Design system
│       ├── api.js           ← API client
│       ├── utils.js         ← Utilities
│       ├── Toast.jsx        ← Toast notifications
│       ├── Sidebar.jsx      ← Navigation sidebar
│       ├── Dashboard.jsx    ← Stats & charts
│       ├── FloorPlan.jsx    ← 50-seat visual map
│       ├── WeekView.jsx     ← Week allocation matrix
│       ├── MySchedule.jsx   ← Personal schedule
│       ├── BookSeat.jsx     ← Booking flow
│       ├── BlockSeat.jsx    ← Block seat (3PM gate)
│       ├── Vacation.jsx     ← Vacation manager
│       └── Squads.jsx       ← Squad directory
├── docs/
│   └── flow.md
├── README.md
└── DEPLOYMENT.md
```
