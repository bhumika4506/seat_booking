"""
SeatFlow — Smart Workspace Seat Booking System
FastAPI Backend with JSON file-based storage
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import date, datetime, timedelta
from typing import Optional
import json
import os
import copy

app = FastAPI(title="SeatFlow API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = os.environ.get("DATA_FILE", "data.json")

# ────────────────────────────────────────────
# Holidays
# ────────────────────────────────────────────
HOLIDAYS = [
    "2025-01-26", "2025-03-17", "2025-04-14", "2025-05-01", "2025-08-15",
    "2025-10-02", "2025-10-20", "2025-11-05", "2025-12-25",
    "2026-01-01", "2026-01-26", "2026-03-06",
]

# ────────────────────────────────────────────
# Pydantic request models
# ────────────────────────────────────────────
class BookSeatRequest(BaseModel):
    member_id: str
    seat_id: str
    date: str

class ReleaseSeatRequest(BaseModel):
    member_id: str
    date: str

class VacationRequest(BaseModel):
    member_id: str
    date: str

class BlockSeatRequest(BaseModel):
    member_id: str
    seat_id: str
    date: str

# ────────────────────────────────────────────
# Data helpers
# ────────────────────────────────────────────
def load_data() -> dict:
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return init_data()

def save_data(data: dict):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)

def init_data() -> dict:
    """Auto-generate squads, members, seats."""
    data = {
        "squads": {},
        "seats": {},
        "bookings": {},
        "vacations": {},
        "blocks": {},
    }

    # 10 squads, 8 members each
    for sq in range(1, 11):
        squad_id = f"squad_{sq}"
        batch = 1 if sq <= 5 else 2
        members = []
        for m in range(1, 9):
            mid = f"M{sq:02d}{m:02d}"
            members.append({
                "id": mid,
                "name": f"Member {sq}-{m}",
                "squad_id": squad_id,
                "email": f"member{sq}{m}@org.com",
            })
        data["squads"][squad_id] = {
            "id": squad_id,
            "name": f"Squad {sq}",
            "batch": batch,
            "members": members,
        }

    # 50 seats: 5 rows x 10 cols
    for i in range(1, 51):
        sid = f"S{i:02d}"
        row = (i - 1) // 10
        col = (i - 1) % 10
        data["seats"][sid] = {
            "id": sid,
            "number": i,
            "is_floater": i >= 41,
            "row": row,
            "col": col,
        }

    save_data(data)
    return data

# ────────────────────────────────────────────
# Business logic helpers
# ────────────────────────────────────────────
def is_holiday(d: str) -> bool:
    return d in HOLIDAYS

def is_weekend(d: date) -> bool:
    return d.weekday() >= 5

def get_week_number_in_fortnight(d: date) -> int:
    """ISO week odd = Week 1, even = Week 2"""
    return 1 if d.isocalendar()[1] % 2 == 1 else 2

def is_designated_day(squad_id: str, d: date, data: dict) -> bool:
    """True if d is an office day for this squad's batch"""
    batch = data["squads"][squad_id]["batch"]
    week = get_week_number_in_fortnight(d)
    dow = d.weekday()  # 0=Mon ... 4=Fri
    if batch == 1:
        return (week == 1 and dow in [0, 1, 2]) or (week == 2 and dow in [3, 4])
    elif batch == 2:
        return (week == 1 and dow in [3, 4]) or (week == 2 and dow in [0, 1, 2])
    return False

def find_member(member_id: str, data: dict):
    for sq in data["squads"].values():
        for m in sq["members"]:
            if m["id"] == member_id:
                return m, sq
    return None, None

def get_next_working_day(from_date: date) -> date:
    """Get the next working day after from_date, skipping weekends and holidays."""
    nxt = from_date + timedelta(days=1)
    while is_weekend(nxt) or is_holiday(nxt.isoformat()):
        nxt += timedelta(days=1)
    return nxt

def can_block_for_date(target_date_str: str) -> bool:
    """Block only allowed after 3PM for next working day."""
    now = datetime.now()
    if now.hour < 15:
        return False
    next_day = get_next_working_day(now.date())
    return target_date_str == next_day.isoformat()

# ────────────────────────────────────────────
# API Endpoints
# ────────────────────────────────────────────

@app.get("/squads")
def get_squads():
    data = load_data()
    return list(data["squads"].values())

@app.get("/seats")
def get_seats():
    data = load_data()
    return list(data["seats"].values())

@app.get("/members")
def get_members(squad_id: Optional[str] = None):
    data = load_data()
    members = []
    for sq in data["squads"].values():
        if squad_id and sq["id"] != squad_id:
            continue
        members.extend(sq["members"])
    return members

@app.get("/holidays")
def get_holidays():
    return HOLIDAYS

@app.get("/week-allocation")
def get_week_allocation(week_start: str):
    """Full week seat map — returns allocation for Mon–Fri."""
    data = load_data()
    try:
        start = date.fromisoformat(week_start)
    except ValueError:
        raise HTTPException(400, "Invalid date format")

    result = {}
    for i in range(5):  # Mon–Fri
        d = start + timedelta(days=i)
        ds = d.isoformat()
        day_info = {
            "date": ds,
            "day_name": d.strftime("%A"),
            "is_holiday": is_holiday(ds),
            "is_weekend": is_weekend(d),
            "seats": {},
            "designated_squads": [],
        }

        # Find which squads are designated
        for sq in data["squads"].values():
            if is_designated_day(sq["id"], d, data):
                day_info["designated_squads"].append({
                    "id": sq["id"],
                    "name": sq["name"],
                    "batch": sq["batch"],
                })

        # Seat allocations
        for seat_id, seat in data["seats"].items():
            seat_info = {**seat, "status": "available", "booking": None, "block": None}

            # Check bookings
            for bk_key, bk in data["bookings"].items():
                if bk_key.startswith(f"{ds}_{seat_id}_"):
                    seat_info["status"] = "booked"
                    seat_info["booking"] = bk
                    break

            # Check blocks
            if seat_info["status"] == "available":
                for bl_key, bl in data["blocks"].items():
                    if bl_key.startswith(f"{ds}_{seat_id}_"):
                        seat_info["status"] = "blocked"
                        seat_info["block"] = bl
                        break

            day_info["seats"][seat_id] = seat_info

        result[ds] = day_info

    return result

@app.get("/member-schedule")
def get_member_schedule(member_id: str, week_start: str):
    """Personal schedule for a member for a week."""
    data = load_data()
    member, squad = find_member(member_id, data)
    if not member:
        raise HTTPException(404, "Member not found")

    try:
        start = date.fromisoformat(week_start)
    except ValueError:
        raise HTTPException(400, "Invalid date format")

    schedule = []
    for i in range(5):
        d = start + timedelta(days=i)
        ds = d.isoformat()

        day_entry = {
            "date": ds,
            "day_name": d.strftime("%A"),
            "is_holiday": is_holiday(ds),
            "is_weekend": is_weekend(d),
            "is_designated": is_designated_day(squad["id"], d, data),
            "booking": None,
            "vacation": None,
            "block": None,
        }

        # Check booking
        for bk_key, bk in data["bookings"].items():
            if bk["date"] == ds and bk["member"]["id"] == member_id:
                day_entry["booking"] = bk
                break

        # Check vacation
        vac_key = f"{ds}_{member_id}"
        if vac_key in data["vacations"]:
            day_entry["vacation"] = data["vacations"][vac_key]

        # Check block
        for bl_key, bl in data["blocks"].items():
            if bl["date"] == ds and bl["member"]["id"] == member_id:
                day_entry["block"] = bl
                break

        schedule.append(day_entry)

    return {
        "member": member,
        "squad": {"id": squad["id"], "name": squad["name"], "batch": squad["batch"]},
        "schedule": schedule,
    }

@app.get("/stats")
def get_stats(week_start: str):
    """Utilisation stats for a week."""
    data = load_data()
    try:
        start = date.fromisoformat(week_start)
    except ValueError:
        raise HTTPException(400, "Invalid date format")

    total_seats = 50
    daily_stats = []
    total_bookings = 0
    floater_usage = 0
    vacation_count = 0
    block_count = 0
    working_days = 0

    for i in range(5):
        d = start + timedelta(days=i)
        ds = d.isoformat()

        if is_holiday(ds) or is_weekend(d):
            daily_stats.append({
                "date": ds,
                "day_name": d.strftime("%A"),
                "bookings": 0,
                "is_holiday": True,
                "occupancy_pct": 0,
            })
            continue

        working_days += 1
        day_bookings = 0
        day_floater = 0

        for bk_key, bk in data["bookings"].items():
            if bk["date"] == ds:
                day_bookings += 1
                if bk.get("is_floater_use"):
                    day_floater += 1

        day_blocks = sum(1 for bl in data["blocks"].values() if bl["date"] == ds)
        day_vacations = sum(1 for v in data["vacations"].values() if v["date"] == ds)

        total_bookings += day_bookings
        floater_usage += day_floater
        block_count += day_blocks
        vacation_count += day_vacations

        daily_stats.append({
            "date": ds,
            "day_name": d.strftime("%A"),
            "bookings": day_bookings,
            "blocks": day_blocks,
            "is_holiday": False,
            "occupancy_pct": round((day_bookings / total_seats) * 100, 1) if total_seats else 0,
        })

    utilization = 0
    if working_days > 0:
        utilization = round((total_bookings / (total_seats * working_days)) * 100, 1)

    return {
        "utilization_pct": utilization,
        "total_bookings": total_bookings,
        "floater_usage": floater_usage,
        "vacation_releases": vacation_count,
        "blocked_seats": block_count,
        "total_seats": total_seats,
        "daily": daily_stats,
    }

@app.post("/book-seat")
def book_seat(req: BookSeatRequest):
    data = load_data()
    d = req.date
    try:
        dt = date.fromisoformat(d)
    except ValueError:
        raise HTTPException(400, "Invalid date format")

    # Weekend check
    if is_weekend(dt):
        raise HTTPException(400, "Cannot book on weekends")

    # Holiday check
    if is_holiday(d):
        raise HTTPException(400, "Cannot book on holidays")

    member, squad = find_member(req.member_id, data)
    if not member:
        raise HTTPException(404, "Member not found")
    if req.seat_id not in data["seats"]:
        raise HTTPException(404, "Seat not found")

    seat = data["seats"][req.seat_id]
    designated = is_designated_day(squad["id"], dt, data)

    # Rule: On non-designated days, can only book floater seats via block
    if not designated and not seat["is_floater"]:
        raise HTTPException(400, "On non-designated days, only floater seats (41-50) can be booked")

    # Rule: One booking per member per day
    for bk_key in data["bookings"]:
        if bk_key.endswith(f"_{req.member_id}") and data["bookings"][bk_key]["date"] == d:
            raise HTTPException(400, "Member already has a booking for this day")

    # Rule: One booking per seat per day
    for bk_key in data["bookings"]:
        if bk_key.startswith(f"{d}_{req.seat_id}_"):
            raise HTTPException(400, "Seat already booked for this day")

    # Check if seat is blocked by someone else
    for bl_key in list(data["blocks"].keys()):
        if bl_key.startswith(f"{d}_{req.seat_id}_") and not bl_key.endswith(f"_{req.member_id}"):
            raise HTTPException(400, "Seat is blocked by another member")

    booking_key = f"{d}_{req.seat_id}_{req.member_id}"
    data["bookings"][booking_key] = {
        "member": member,
        "seat": seat,
        "squad": {"id": squad["id"], "name": squad["name"], "batch": squad["batch"]},
        "date": d,
        "is_floater_use": seat["is_floater"],
        "booked_at": datetime.now().isoformat(),
    }

    # Remove block if member had blocked this seat
    block_key = f"{d}_{req.seat_id}_{req.member_id}"
    if block_key in data["blocks"]:
        del data["blocks"][block_key]

    save_data(data)
    return {"message": "Seat booked successfully", "booking": data["bookings"][booking_key]}

@app.post("/release-seat")
def release_seat(req: ReleaseSeatRequest):
    data = load_data()
    d = req.date

    # Find and remove the booking
    to_remove = None
    for bk_key, bk in data["bookings"].items():
        if bk["date"] == d and bk["member"]["id"] == req.member_id:
            to_remove = bk_key
            break

    if not to_remove:
        raise HTTPException(404, "No booking found for this member on this date")

    del data["bookings"][to_remove]
    save_data(data)
    return {"message": "Seat released successfully"}

@app.post("/vacation")
def mark_vacation(req: VacationRequest):
    data = load_data()
    d = req.date
    try:
        dt = date.fromisoformat(d)
    except ValueError:
        raise HTTPException(400, "Invalid date format")

    if is_weekend(dt):
        raise HTTPException(400, "Cannot mark vacation on weekends")
    if is_holiday(d):
        raise HTTPException(400, "Cannot mark vacation on holidays")

    member, squad = find_member(req.member_id, data)
    if not member:
        raise HTTPException(404, "Member not found")

    vac_key = f"{d}_{req.member_id}"
    if vac_key in data["vacations"]:
        raise HTTPException(400, "Vacation already marked for this day")

    # Auto-release booking if exists
    to_remove = None
    for bk_key, bk in data["bookings"].items():
        if bk["date"] == d and bk["member"]["id"] == req.member_id:
            to_remove = bk_key
            break
    if to_remove:
        del data["bookings"][to_remove]

    data["vacations"][vac_key] = {
        "member": member,
        "date": d,
        "marked_at": datetime.now().isoformat(),
    }

    save_data(data)
    return {"message": "Vacation marked. Existing booking auto-released." if to_remove else "Vacation marked."}

@app.delete("/vacation")
def remove_vacation(member_id: str, date: str):
    data = load_data()
    vac_key = f"{date}_{member_id}"
    if vac_key not in data["vacations"]:
        raise HTTPException(404, "No vacation found")
    del data["vacations"][vac_key]
    save_data(data)
    return {"message": "Vacation removed"}

@app.post("/block-seat")
def block_seat(req: BlockSeatRequest):
    data = load_data()
    d = req.date
    try:
        dt = date.fromisoformat(d)
    except ValueError:
        raise HTTPException(400, "Invalid date format")

    if is_weekend(dt):
        raise HTTPException(400, "Cannot block on weekends")
    if is_holiday(d):
        raise HTTPException(400, "Cannot block on holidays")

    # 3PM gate
    if not can_block_for_date(d):
        raise HTTPException(400, "Blocking is only allowed after 3:00 PM for the next working day")

    member, squad = find_member(req.member_id, data)
    if not member:
        raise HTTPException(404, "Member not found")
    if req.seat_id not in data["seats"]:
        raise HTTPException(404, "Seat not found")

    seat = data["seats"][req.seat_id]

    # Block is only for non-designated days
    if is_designated_day(squad["id"], dt, data):
        raise HTTPException(400, "No need to block on your designated day — book directly instead")

    # Check seat not already booked
    for bk_key in data["bookings"]:
        if bk_key.startswith(f"{d}_{req.seat_id}_"):
            raise HTTPException(400, "Seat already booked for this day")

    # Check seat not already blocked by someone else
    for bl_key in data["blocks"]:
        if bl_key.startswith(f"{d}_{req.seat_id}_"):
            raise HTTPException(400, "Seat already blocked for this day")

    # One block per member per day
    for bl_key in data["blocks"]:
        if bl_key.endswith(f"_{req.member_id}") and data["blocks"][bl_key]["date"] == d:
            raise HTTPException(400, "Member already has a block for this day")

    block_key = f"{d}_{req.seat_id}_{req.member_id}"
    data["blocks"][block_key] = {
        "member": member,
        "seat": seat,
        "squad": {"id": squad["id"], "name": squad["name"], "batch": squad["batch"]},
        "date": d,
        "blocked_at": datetime.now().isoformat(),
    }

    save_data(data)
    return {"message": "Seat blocked successfully", "block": data["blocks"][block_key]}

@app.delete("/block-seat")
def unblock_seat(member_id: str, seat_id: str, date: str):
    data = load_data()
    block_key = f"{date}_{seat_id}_{member_id}"
    if block_key not in data["blocks"]:
        raise HTTPException(404, "No block found")
    del data["blocks"][block_key]
    save_data(data)
    return {"message": "Block removed"}

@app.get("/reset")
def reset_data():
    """Reset all data (dev only)."""
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
    data = init_data()
    return {"message": "Data reset successfully"}

# ────────────────────────────────────────────
# Run
# ────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
