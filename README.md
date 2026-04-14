# SeatFlow v2.0 — Smart Workspace Management System

A full-stack, enterprise-grade seat booking application built with FastAPI and React Vite for managing workspace seat allocations across multiple floors and zones. 

## 🚀 New in v2.0
- **Secure Authentication:** JWT-based login with role-based access control (Admin/Employee).
- **Real-Time Synergy:** WebSockets dynamically broadcast seat bookings, check-ins, and layout changes instantly to everyone.
- **Advanced Booking Flow:** Granular Time Slots (Morning/Afternoon/Full-Day), intuitive zone/floor filters, and multiple occurrence Repeat/Recurring schedules.
- **Physical QR Check-Ins:** Virtual bookings are strictly enforced; lack of physical QR scan within 30 minutes triggers automatic seat release.
- **Admin Command Center:** Powerful global interface to modify seat grids, toggle blockers for physical maintenance, and monitor global usage stats.
- **In-App Notification Hub:** Real-time push updates for reminders and booking statuses.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+ · FastAPI · Uvicorn · python-jose (JWT) · WebSockets |
| Frontend | React 18 · Vite · Axios · qrcode.react · lucide-react |
| Storage | JSON file-based with automated migration handlers |
| Styling | Pure CSS with premium dynamic variables & glassmorphism |
| Fonts | Syne (Display) + DM Sans (Body) |

## Quick Start

### Backend
*Note: We utilize port `8001` by default to bypass common local OS TCP freezes.*
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --port 8001
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`. 
**Default Admin Login:** `M0101` / `pass123`

## Business Rules & Automation

- **Auto-Release Policy**: If a user fails to digitally "check-in" 30 minutes before or after their active shift slot, the desk is auto-released to the pool.
- **Prevent Double Booking**: Database-level strict concurrency checks prevent time-slot conflicts (e.g. reserving an afternoon when full-day is already filled).
- **Fair Lottery**: 3PM block gate continues to ensure fair daily grabs for non-designated seats.
- **No Booking** on weekends or system-defined holidays.

## API Endpoints

*Endpoints require `Authorization: Bearer <token>` globally.*

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Authenticate & get JWT token |
| GET | `/squads` | All squads |
| GET | `/seats` | Floor plan configuration |
| GET | `/holidays` | System holidays |
| POST | `/book-seat` | Book standard slot |
| POST | `/book-recurring` | Book weekly/monthly ranges |
| POST | `/modify-booking`| Move/reschedule existing block |
| POST | `/release-seat` | Cancel booking |
| POST | `/checkin` | Process physical attendance |
| GET | `/stats` | Global occupancy numbers |
| POST | `/admin/seats` | Provision new seats |
| PUT | `/admin/seats/{id}` | Update/Maintain seats |
| WS | `/ws` | Real-time events protocol |
