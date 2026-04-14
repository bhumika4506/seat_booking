# SeatFlow — Smart Workspace Seat Booking System

A full-stack seat booking application built with FastAPI and React Vite for managing workspace seat allocations across 10 squads and 2 batches.

## Features

- **Smart Batch Rotation** — Automated 2-week cycle schedule
- **3PM Block Gate** — Fair daily lottery for non-designated seats
- **Auto-Release on Vacation** — Seats freed when vacation is marked
- **Visual Floor Plan** — Real-time 50-seat map with squad colors
- **Zero Config Start** — Auto-initializes all data on first run
- **Utilization Analytics** — Live occupancy tracking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+ · FastAPI · Uvicorn |
| Frontend | React 18 · Vite · Axios · date-fns · lucide-react |
| Storage | JSON file-based |
| Styling | Pure CSS with CSS variables |
| Fonts | Syne + DM Sans |

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`, Backend at `http://localhost:8000`.

## Business Rules

- **50 seats**: Seats 1-40 (fixed), Seats 41-50 (floater)
- **10 squads** with 8 members each = 80 members
- **2-week rotating cycle** for designated days
- **Block seats** only after 3PM for next working day
- **Vacation** auto-releases existing bookings
- **No booking** on weekends or holidays

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/squads` | All squads |
| GET | `/seats` | All seats |
| GET | `/members` | All members |
| GET | `/holidays` | Holiday list |
| GET | `/week-allocation` | Week seat map |
| GET | `/member-schedule` | Personal schedule |
| GET | `/stats` | Utilization stats |
| POST | `/book-seat` | Book a seat |
| POST | `/release-seat` | Release booking |
| POST | `/vacation` | Mark vacation |
| DELETE | `/vacation` | Remove vacation |
| POST | `/block-seat` | Block a seat |
| DELETE | `/block-seat` | Remove block |
| GET | `/reset` | Reset all data |
