"""
SeatFlow v2.0 — Smart Workspace Seat Booking System
FastAPI Backend: JWT Auth, WebSockets, Time Slots, QR Check-in, Admin Panel, Recurring Bookings
"""

from fastapi import FastAPI, HTTPException, Query, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import date, datetime, timedelta
from typing import Optional, List
import json, os, uuid
from jose import jwt, JWTError

# ── Constants ──────────────────────────────────────────────────────────
SECRET_KEY = "seatflow-secret-2026-xyz"
ALGORITHM = "HS256"
DEFAULT_PASSWORD = "pass123"

HOLIDAYS = [
    "2025-01-26", "2025-03-17", "2025-04-14", "2025-05-01", "2025-08-15",
    "2025-10-02", "2025-10-20", "2025-11-05", "2025-12-25",
    "2026-01-01", "2026-01-26", "2026-03-06", "2026-04-14",
]

SLOT_CONFLICTS = {
    "full_day":  ["morning", "afternoon", "full_day"],
    "morning":   ["morning", "full_day"],
    "afternoon": ["afternoon", "full_day"],
}

ZONE_MAP = {0: "A", 1: "A", 2: "A", 3: "A", 4: "B", 5: "B", 6: "B", 7: "C", 8: "C", 9: "C"}
AMENITIES_SEED = {0: ["window", "standing_desk"], 9: ["window"], 5: ["near_printer"], 1: ["standing_desk"], 8: ["near_printer", "standing_desk"]}

DATA_FILE = os.environ.get("DATA_FILE", "data.json")

# ── App ────────────────────────────────────────────────────────────────
app = FastAPI(title="SeatFlow API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── WebSocket Manager ──────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, event: dict):
        dead = []
        for ws in self.connections:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.connections.remove(ws)

manager = ConnectionManager()

# ── Auth ───────────────────────────────────────────────────────────────
security = HTTPBearer(auto_error=False)

def create_token(member_id: str, role: str) -> str:
    exp = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode({"sub": member_id, "role": role, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return {"member_id": payload["sub"], "role": payload["role"]}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ── Pydantic Models ────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    member_id: str
    password: str

class BookSeatRequest(BaseModel):
    member_id: str
    seat_id: str
    date: str
    time_slot: str = "full_day"  # morning | afternoon | full_day

class RecurringBookingRequest(BaseModel):
    member_id: str
    seat_id: str
    start_date: str
    time_slot: str = "full_day"
    repeat: str = "weekly"   # weekly | monthly
    occurrences: int = 4

class ModifyBookingRequest(BaseModel):
    booking_id: str
    new_seat_id: Optional[str] = None
    new_time_slot: Optional[str] = None

class ReleaseSeatRequest(BaseModel):
    member_id: str
    date: str

class CheckInRequest(BaseModel):
    member_id: str
    date: str

class VacationRequest(BaseModel):
    member_id: str
    date: str

class BlockSeatRequest(BaseModel):
    member_id: str
    seat_id: str
    date: str

class AdminSeatRequest(BaseModel):
    floor: int = 1
    zone: str = "A"
    amenities: List[str] = []
    is_floater: bool = False

class AdminSeatUpdateRequest(BaseModel):
    zone: Optional[str] = None
    amenities: Optional[List[str]] = None
    is_floater: Optional[bool] = None
    is_blocked: Optional[bool] = None

# ── Data Helpers ───────────────────────────────────────────────────────
def clean_member(m: dict) -> dict:
    return {k: v for k, v in m.items() if k != "password"}

def add_notification(data: dict, member_id: str, message: str, notif_type: str = "info"):
    nid = str(uuid.uuid4())[:8]
    data.setdefault("notifications", {})[nid] = {
        "id": nid,
        "member_id": member_id,
        "message": message,
        "type": notif_type,
        "read": False,
        "timestamp": datetime.now().isoformat(),
    }

def migrate_data(data: dict) -> dict:
    """Migrate old data.json format to v2 schema."""
    data.setdefault("checkins", {})
    data.setdefault("notifications", {})
    data.setdefault("recurring_bookings", {})

    # Migrate seats
    for seat_id, seat in data.get("seats", {}).items():
        if "floor" not in seat:
            row = seat.get("row", 0)
            col = seat.get("col", 0)
            seat["floor"] = 1 if row <= 1 else (2 if row <= 3 else 3)
            seat["zone"] = ZONE_MAP.get(col, "A")
            seat["amenities"] = AMENITIES_SEED.get(col, [])
            seat["is_blocked"] = False

    # Migrate members
    for sq in data.get("squads", {}).values():
        for i, member in enumerate(sq.get("members", [])):
            if "role" not in member:
                member["role"] = "admin" if i == 0 else "employee"
            if "password" not in member:
                member["password"] = DEFAULT_PASSWORD

    # Migrate old booking keys (date_seatid_memberid → date_seatid_timeslot_memberid)
    to_migrate = {}
    for bk_key, bk in list(data.get("bookings", {}).items()):
        parts = bk_key.split("_")
        # Old format has exactly 3 parts: 2026-04-14_S05_M0101
        # New format: 2026-04-14_S05_full_day_M0101 (5 parts due to "full_day" with underscore)
        date_part = parts[0]
        if len(parts) == 3 and parts[2].startswith("M"):
            seat_id = parts[1]
            member_id = parts[2]
            new_key = f"{date_part}_{seat_id}_full_day_{member_id}"
            bk.setdefault("time_slot", "full_day")
            bk.setdefault("id", str(uuid.uuid4())[:8])
            to_migrate[bk_key] = (new_key, bk)
    for old_key, (new_key, bk) in to_migrate.items():
        del data["bookings"][old_key]
        data["bookings"][new_key] = bk
    return data

def load_data() -> dict:
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            data = json.load(f)
        return migrate_data(data)
    return init_data()

def save_data(data: dict):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)

def init_data() -> dict:
    data = {
        "squads": {}, "seats": {}, "bookings": {}, "vacations": {},
        "blocks": {}, "checkins": {}, "notifications": {}, "recurring_bookings": {},
    }
    for sq in range(1, 11):
        squad_id = f"squad_{sq}"
        batch = 1 if sq <= 5 else 2
        members = []
        for m in range(1, 9):
            mid = f"M{sq:02d}{m:02d}"
            members.append({
                "id": mid, "name": f"Member {sq}-{m}",
                "squad_id": squad_id, "email": f"member{sq}{m}@org.com",
                "role": "admin" if m == 1 else "employee",
                "password": DEFAULT_PASSWORD,
            })
        data["squads"][squad_id] = {"id": squad_id, "name": f"Squad {sq}", "batch": batch, "members": members}

    for i in range(1, 51):
        sid = f"S{i:02d}"
        row = (i - 1) // 10
        col = (i - 1) % 10
        data["seats"][sid] = {
            "id": sid, "number": i, "is_floater": i >= 41,
            "row": row, "col": col,
            "floor": 1 if row <= 1 else (2 if row <= 3 else 3),
            "zone": ZONE_MAP.get(col, "A"),
            "amenities": AMENITIES_SEED.get(col, []),
            "is_blocked": False,
        }
    save_data(data)
    return data

# ── Business Logic ─────────────────────────────────────────────────────
def is_holiday(d: str) -> bool:
    return d in HOLIDAYS

def is_weekend(d: date) -> bool:
    return d.weekday() >= 5

def get_iso_week(d: date) -> int:
    return d.isocalendar()[1]

def is_designated_day(squad_id: str, d: date, data: dict) -> bool:
    batch = data["squads"][squad_id]["batch"]
    week = 1 if get_iso_week(d) % 2 == 1 else 2
    dow = d.weekday()
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
    nxt = from_date + timedelta(days=1)
    while is_weekend(nxt) or is_holiday(nxt.isoformat()):
        nxt += timedelta(days=1)
    return nxt

def can_block_for_date(target_date_str: str) -> bool:
    now = datetime.now()
    if now.hour < 15:
        return False
    return target_date_str == get_next_working_day(now.date()).isoformat()

def slot_conflicts(slot_a: str, slot_b: str) -> bool:
    return slot_b in SLOT_CONFLICTS.get(slot_a, [])

def run_auto_release(data: dict) -> list:
    released = []
    now = datetime.now()
    today = now.date().isoformat()
    grace = timedelta(minutes=30)
    morning_start = now.replace(hour=9, minute=0, second=0, microsecond=0)
    if now < morning_start + grace:
        return released
    for bk_key, bk in list(data.get("bookings", {}).items()):
        if bk["date"] != today:
            continue
        if bk.get("time_slot", "full_day") not in ["full_day", "morning"]:
            continue
        ci_key = f"{today}_{bk['member']['id']}"
        if ci_key in data.get("checkins", {}):
            continue
        del data["bookings"][bk_key]
        add_notification(data, bk["member"]["id"],
            f"⚠️ Your seat {bk['seat']['id']} was auto-released (no check-in after 30 min)", "warning")
        released.append(bk_key)
    return released

# ── API Endpoints ──────────────────────────────────────────────────────

@app.post("/login")
async def login(req: LoginRequest):
    data = load_data()
    member, squad = find_member(req.member_id, data)
    if not member:
        raise HTTPException(404, "Member not found")
    if member.get("password", DEFAULT_PASSWORD) != req.password:
        raise HTTPException(401, "Invalid password")
    token = create_token(member["id"], member.get("role", "employee"))
    return {
        "access_token": token, "token_type": "bearer",
        "member": clean_member(member),
        "squad": {"id": squad["id"], "name": squad["name"], "batch": squad["batch"]},
    }

@app.get("/me")
async def get_me(user=Depends(get_current_user)):
    data = load_data()
    member, squad = find_member(user["member_id"], data)
    if not member:
        raise HTTPException(404, "Member not found")
    return {**clean_member(member), "squad": {"id": squad["id"], "name": squad["name"], "batch": squad["batch"]}}

@app.get("/squads")
def get_squads():
    data = load_data()
    result = []
    for sq in data["squads"].values():
        result.append({**sq, "members": [clean_member(m) for m in sq["members"]]})
    return result

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
        members.extend([clean_member(m) for m in sq["members"]])
    return members

@app.get("/holidays")
def get_holidays():
    return HOLIDAYS

@app.get("/week-allocation")
def get_week_allocation(week_start: str):
    data = load_data()
    try:
        start = date.fromisoformat(week_start)
    except ValueError:
        raise HTTPException(400, "Invalid date format")

    result = {}
    for i in range(5):
        d = start + timedelta(days=i)
        ds = d.isoformat()
        day_info = {
            "date": ds, "day_name": d.strftime("%A"),
            "is_holiday": is_holiday(ds), "is_weekend": is_weekend(d),
            "seats": {}, "designated_squads": [],
        }
        for sq in data["squads"].values():
            if is_designated_day(sq["id"], d, data):
                day_info["designated_squads"].append({"id": sq["id"], "name": sq["name"], "batch": sq["batch"]})

        for seat_id, seat in data["seats"].items():
            seat_info = {**seat, "status": "available", "booking": None, "bookings": [], "block": None}
            if seat.get("is_blocked"):
                seat_info["status"] = "maintenance"
            else:
                day_bookings = [bk for bk_key, bk in data["bookings"].items() if bk_key.startswith(f"{ds}_{seat_id}_")]
                if day_bookings:
                    seat_info["bookings"] = [{**bk, "member": clean_member(bk["member"])} for bk in day_bookings]
                    seat_info["booking"] = seat_info["bookings"][0]
                    slots = [bk.get("time_slot", "full_day") for bk in day_bookings]
                    if "full_day" in slots or ("morning" in slots and "afternoon" in slots):
                        seat_info["status"] = "booked"
                    else:
                        seat_info["status"] = "partial"
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
            "date": ds, "day_name": d.strftime("%A"),
            "is_holiday": is_holiday(ds), "is_weekend": is_weekend(d),
            "is_designated": is_designated_day(squad["id"], d, data),
            "booking": None, "vacation": None, "block": None, "checkin": None,
        }
        for bk_key, bk in data["bookings"].items():
            if bk["date"] == ds and bk["member"]["id"] == member_id:
                day_entry["booking"] = {**bk, "member": clean_member(bk["member"])}
                break
        vac_key = f"{ds}_{member_id}"
        if vac_key in data.get("vacations", {}):
            day_entry["vacation"] = data["vacations"][vac_key]
        ci_key = f"{ds}_{member_id}"
        if ci_key in data.get("checkins", {}):
            day_entry["checkin"] = data["checkins"][ci_key]
        for bl_key, bl in data.get("blocks", {}).items():
            if bl["date"] == ds and bl["member"]["id"] == member_id:
                day_entry["block"] = bl
                break
        schedule.append(day_entry)

    return {"member": clean_member(member), "squad": {"id": squad["id"], "name": squad["name"], "batch": squad["batch"]}, "schedule": schedule}

@app.get("/stats")
def get_stats(week_start: str):
    data = load_data()
    try:
        start = date.fromisoformat(week_start)
    except ValueError:
        raise HTTPException(400, "Invalid date format")

    total_seats = len(data["seats"])
    daily_stats, total_bookings, floater_usage, vacation_count, block_count, working_days = [], 0, 0, 0, 0, 0
    for i in range(5):
        d = start + timedelta(days=i)
        ds = d.isoformat()
        if is_holiday(ds) or is_weekend(d):
            daily_stats.append({"date": ds, "day_name": d.strftime("%A"), "bookings": 0, "is_holiday": True, "occupancy_pct": 0})
            continue
        working_days += 1
        day_bookings = sum(1 for bk in data["bookings"].values() if bk["date"] == ds)
        day_floater = sum(1 for bk in data["bookings"].values() if bk["date"] == ds and bk.get("is_floater_use"))
        day_blocks = sum(1 for bl in data.get("blocks", {}).values() if bl["date"] == ds)
        day_vacations = sum(1 for v in data.get("vacations", {}).values() if v["date"] == ds)
        total_bookings += day_bookings
        floater_usage += day_floater
        block_count += day_blocks
        vacation_count += day_vacations
        daily_stats.append({"date": ds, "day_name": d.strftime("%A"), "bookings": day_bookings,
                             "blocks": day_blocks, "vacations": day_vacations, "is_holiday": False,
                             "occupancy_pct": round(day_bookings / total_seats * 100, 1)})

    squads_info = []
    for sq in data["squads"].values():
        designated_days = [start + timedelta(days=i) for i in range(5)
                           if not is_holiday((start + timedelta(days=i)).isoformat()) and not is_weekend(start + timedelta(days=i))
                           and is_designated_day(sq["id"], start + timedelta(days=i), data)]
        squads_info.append({"id": sq["id"], "name": sq["name"], "batch": sq["batch"],
                            "designated_days": [d.strftime("%A") for d in designated_days]})
    return {
        "week_start": week_start, "total_bookings": total_bookings, "floater_usage": floater_usage,
        "vacation_count": vacation_count, "block_count": block_count, "working_days": working_days,
        "utilization_pct": round(total_bookings / (total_seats * max(working_days, 1)) * 100, 1),
        "daily": daily_stats, "squads": squads_info,
    }

# ── Booking ────────────────────────────────────────────────────────────
@app.post("/book-seat")
async def book_seat(req: BookSeatRequest):
    data = load_data()
    d = req.date
    try:
        dt = date.fromisoformat(d)
    except ValueError:
        raise HTTPException(400, "Invalid date format")
    if is_weekend(dt):
        raise HTTPException(400, "Cannot book on weekends")
    if is_holiday(d):
        raise HTTPException(400, "Cannot book on holidays")

    member, squad = find_member(req.member_id, data)
    if not member:
        raise HTTPException(404, "Member not found")
    if req.seat_id not in data["seats"]:
        raise HTTPException(404, "Seat not found")
    seat = data["seats"][req.seat_id]
    if seat.get("is_blocked"):
        raise HTTPException(400, "Seat is under maintenance")

    designated = is_designated_day(squad["id"], dt, data)
    if not designated and not seat["is_floater"]:
        raise HTTPException(400, "On non-designated days, only floater seats (41-50) can be booked")

    vac_key = f"{d}_{req.member_id}"
    if vac_key in data.get("vacations", {}):
        raise HTTPException(400, "Cannot book on a vacation day. Remove vacation first.")

    for bk_key, bk in data["bookings"].items():
        if bk["date"] == d and bk["member"]["id"] == req.member_id:
            if slot_conflicts(req.time_slot, bk.get("time_slot", "full_day")):
                raise HTTPException(400, f"You already have a conflicting booking this day")

    for bk_key, bk in data["bookings"].items():
        if bk_key.startswith(f"{d}_{req.seat_id}_"):
            if slot_conflicts(req.time_slot, bk.get("time_slot", "full_day")):
                raise HTTPException(400, "Seat already booked for this time slot")

    for bl_key in data.get("blocks", {}):
        if bl_key.startswith(f"{d}_{req.seat_id}_") and not bl_key.endswith(f"_{req.member_id}"):
            raise HTTPException(400, "Seat is blocked by another member")

    booking_id = str(uuid.uuid4())[:8]
    bk_key = f"{d}_{req.seat_id}_{req.time_slot}_{req.member_id}"
    data["bookings"][bk_key] = {
        "id": booking_id, "member": clean_member(member), "seat": seat,
        "squad": {"id": squad["id"], "name": squad["name"], "batch": squad["batch"]},
        "date": d, "time_slot": req.time_slot, "is_floater_use": seat["is_floater"],
        "booked_at": datetime.now().isoformat(),
    }
    block_key = f"{d}_{req.seat_id}_{req.member_id}"
    if block_key in data.get("blocks", {}):
        del data["blocks"][block_key]

    slot_label = {"full_day": "Full Day", "morning": "Morning (9AM-1PM)", "afternoon": "Afternoon (1PM-6PM)"}.get(req.time_slot, req.time_slot)
    add_notification(data, req.member_id, f"✅ Seat {req.seat_id} booked for {d} ({slot_label})", "success")
    save_data(data)
    await manager.broadcast({"type": "booking_update", "date": d})
    return {"message": "Seat booked successfully", "booking": data["bookings"][bk_key]}

@app.post("/book-recurring")
async def book_recurring(req: RecurringBookingRequest):
    data = load_data()
    try:
        start_dt = date.fromisoformat(req.start_date)
    except ValueError:
        raise HTTPException(400, "Invalid date")
    member, squad = find_member(req.member_id, data)
    if not member:
        raise HTTPException(404, "Member not found")
    if req.seat_id not in data["seats"]:
        raise HTTPException(404, "Seat not found")

    delta = timedelta(weeks=1) if req.repeat == "weekly" else timedelta(weeks=4)
    created, skipped = [], []
    for i in range(req.occurrences):
        target = start_dt + delta * i
        ds = target.isoformat()
        if is_weekend(target) or is_holiday(ds):
            skipped.append(ds)
            continue
        bk_key = f"{ds}_{req.seat_id}_{req.time_slot}_{req.member_id}"
        if bk_key in data["bookings"]:
            skipped.append(ds)
            continue
        seat = data["seats"][req.seat_id]
        data["bookings"][bk_key] = {
            "id": str(uuid.uuid4())[:8], "member": clean_member(member), "seat": seat,
            "squad": {"id": squad["id"], "name": squad["name"], "batch": squad["batch"]},
            "date": ds, "time_slot": req.time_slot, "is_floater_use": seat["is_floater"],
            "booked_at": datetime.now().isoformat(), "recurring": True,
        }
        created.append(ds)

    rec_id = str(uuid.uuid4())[:8]
    data.setdefault("recurring_bookings", {})[rec_id] = {
        "id": rec_id, "member_id": req.member_id, "seat_id": req.seat_id,
        "time_slot": req.time_slot, "start_date": req.start_date,
        "repeat": req.repeat, "occurrences": req.occurrences, "dates_created": created,
        "created_at": datetime.now().isoformat(),
    }
    if created:
        add_notification(data, req.member_id, f"🔁 Recurring booking created for {len(created)} dates", "success")
    save_data(data)
    await manager.broadcast({"type": "booking_update"})
    return {"message": f"Recurring booking created", "created": created, "skipped": skipped}

@app.post("/release-seat")
async def release_seat(req: ReleaseSeatRequest):
    data = load_data()
    to_remove = None
    for bk_key, bk in data["bookings"].items():
        if bk["date"] == req.date and bk["member"]["id"] == req.member_id:
            to_remove = bk_key
            break
    if not to_remove:
        raise HTTPException(404, "No booking found")
    seat_id = data["bookings"][to_remove]["seat"]["id"]
    del data["bookings"][to_remove]
    ci_key = f"{req.date}_{req.member_id}"
    if ci_key in data.get("checkins", {}):
        del data["checkins"][ci_key]
    add_notification(data, req.member_id, f"Seat {seat_id} released for {req.date}", "info")
    save_data(data)
    await manager.broadcast({"type": "booking_update", "date": req.date})
    return {"message": "Seat released"}

@app.post("/modify-booking")
async def modify_booking(req: ModifyBookingRequest):
    data = load_data()
    found_key, found_bk = None, None
    for bk_key, bk in data["bookings"].items():
        if bk.get("id") == req.booking_id:
            found_key, found_bk = bk_key, bk
            break
    if not found_key:
        raise HTTPException(404, "Booking not found")

    bk = found_bk
    d = bk["date"]
    new_seat_id = req.new_seat_id or bk["seat"]["id"]
    new_time_slot = req.new_time_slot or bk.get("time_slot", "full_day")
    member_id = bk["member"]["id"]

    if new_seat_id not in data["seats"]:
        raise HTTPException(404, "New seat not found")

    del data["bookings"][found_key]
    for bk_key2, bk2 in data["bookings"].items():
        if bk_key2.startswith(f"{d}_{new_seat_id}_"):
            if slot_conflicts(new_time_slot, bk2.get("time_slot", "full_day")):
                data["bookings"][found_key] = bk
                raise HTTPException(400, "New slot conflicts with existing booking")

    new_key = f"{d}_{new_seat_id}_{new_time_slot}_{member_id}"
    data["bookings"][new_key] = {**bk, "seat": data["seats"][new_seat_id], "time_slot": new_time_slot, "modified_at": datetime.now().isoformat()}
    add_notification(data, member_id, f"✏️ Booking modified: {new_seat_id} ({new_time_slot}) on {d}", "info")
    save_data(data)
    await manager.broadcast({"type": "booking_update", "date": d})
    return {"message": "Booking modified", "booking": data["bookings"][new_key]}

# ── Vacation ───────────────────────────────────────────────────────────
@app.post("/vacation")
async def mark_vacation(req: VacationRequest):
    data = load_data()
    d = req.date
    try:
        dt = date.fromisoformat(d)
    except ValueError:
        raise HTTPException(400, "Invalid date")
    if is_weekend(dt) or is_holiday(d):
        raise HTTPException(400, "Cannot mark vacation on weekends or holidays")

    released_seat = None
    for bk_key, bk in list(data["bookings"].items()):
        if bk["date"] == d and bk["member"]["id"] == req.member_id:
            released_seat = bk["seat"]["id"]
            del data["bookings"][bk_key]
            break

    vac_key = f"{d}_{req.member_id}"
    data.setdefault("vacations", {})[vac_key] = {"member_id": req.member_id, "date": d, "marked_at": datetime.now().isoformat()}
    msg = f"🌴 Vacation marked for {d}" + (f". Seat {released_seat} released." if released_seat else "")
    add_notification(data, req.member_id, msg, "info")
    save_data(data)
    await manager.broadcast({"type": "booking_update", "date": d})
    return {"message": msg}

@app.delete("/vacation")
async def remove_vacation(member_id: str, date_str: str = Query(..., alias="date")):
    data = load_data()
    vac_key = f"{date_str}_{member_id}"
    if vac_key not in data.get("vacations", {}):
        raise HTTPException(404, "Vacation not found")
    del data["vacations"][vac_key]
    save_data(data)
    return {"message": "Vacation removed"}

# ── Block Seat ─────────────────────────────────────────────────────────
@app.post("/block-seat")
async def block_seat(req: BlockSeatRequest):
    data = load_data()
    d = req.date
    if not can_block_for_date(d):
        raise HTTPException(400, "Blocking only allowed after 3PM for the next working day")
    if req.seat_id not in data["seats"]:
        raise HTTPException(404, "Seat not found")
    if data["seats"][req.seat_id].get("is_blocked"):
        raise HTTPException(400, "Seat is under maintenance")
    for bk_key in data["bookings"]:
        if bk_key.startswith(f"{d}_{req.seat_id}_"):
            raise HTTPException(400, "Seat already booked for this day")
    for bl_key in data.get("blocks", {}):
        if bl_key.startswith(f"{d}_{req.seat_id}_") and not bl_key.endswith(f"_{req.member_id}"):
            raise HTTPException(400, "Seat is blocked by another member")
    member, _ = find_member(req.member_id, data)
    if not member:
        raise HTTPException(404, "Member not found")
    bl_key = f"{d}_{req.seat_id}_{req.member_id}"
    data.setdefault("blocks", {})[bl_key] = {
        "member": clean_member(member), "seat": data["seats"][req.seat_id],
        "date": d, "blocked_at": datetime.now().isoformat(),
    }
    save_data(data)
    await manager.broadcast({"type": "booking_update", "date": d})
    return {"message": f"Seat {req.seat_id} blocked for {d}"}

@app.delete("/block-seat")
async def unblock_seat(member_id: str, seat_id: str, date_str: str = Query(..., alias="date")):
    data = load_data()
    bl_key = f"{date_str}_{seat_id}_{member_id}"
    if bl_key not in data.get("blocks", {}):
        raise HTTPException(404, "Block not found")
    del data["blocks"][bl_key]
    save_data(data)
    await manager.broadcast({"type": "booking_update", "date": date_str})
    return {"message": "Block removed"}

# ── Check-in / Check-out ───────────────────────────────────────────────
@app.post("/checkin")
async def check_in(req: CheckInRequest):
    data = load_data()
    booking = None
    for bk_key, bk in data["bookings"].items():
        if bk["date"] == req.date and bk["member"]["id"] == req.member_id:
            booking = bk
            break
    if not booking:
        raise HTTPException(404, "No booking found for this member today")
    ci_key = f"{req.date}_{req.member_id}"
    if ci_key in data.get("checkins", {}):
        raise HTTPException(400, "Already checked in")
    data.setdefault("checkins", {})[ci_key] = {
        "member_id": req.member_id, "date": req.date,
        "seat_id": booking["seat"]["id"],
        "checkin_time": datetime.now().isoformat(), "checkout_time": None,
    }
    add_notification(data, req.member_id, f"✅ Checked in to {booking['seat']['id']}", "success")
    save_data(data)
    await manager.broadcast({"type": "checkin_update", "date": req.date})
    return {"message": "Checked in successfully", "checkin": data["checkins"][ci_key]}

@app.post("/checkout")
async def check_out(req: CheckInRequest):
    data = load_data()
    ci_key = f"{req.date}_{req.member_id}"
    if ci_key not in data.get("checkins", {}):
        raise HTTPException(404, "Not checked in")
    if data["checkins"][ci_key].get("checkout_time"):
        raise HTTPException(400, "Already checked out")
    data["checkins"][ci_key]["checkout_time"] = datetime.now().isoformat()
    save_data(data)
    await manager.broadcast({"type": "checkin_update", "date": req.date})
    return {"message": "Checked out", "checkin": data["checkins"][ci_key]}

@app.get("/checkin-status")
def get_checkin_status(member_id: str, date_str: str = Query(..., alias="date")):
    data = load_data()
    released = run_auto_release(data)
    if released:
        save_data(data)
    booking = None
    for bk_key, bk in data["bookings"].items():
        if bk["date"] == date_str and bk["member"]["id"] == member_id:
            booking = {**bk, "member": clean_member(bk["member"])}
            break
    ci_key = f"{date_str}_{member_id}"
    return {"booking": booking, "checkin": data.get("checkins", {}).get(ci_key), "auto_released_count": len(released)}

# ── History & Notifications ────────────────────────────────────────────
@app.get("/booking-history")
def get_booking_history(member_id: str, limit: int = 50):
    data = load_data()
    history = []
    for bk_key, bk in data["bookings"].items():
        if bk["member"]["id"] == member_id:
            ci_key = f"{bk['date']}_{member_id}"
            history.append({**bk, "member": clean_member(bk["member"]), "checkin": data.get("checkins", {}).get(ci_key)})
    history.sort(key=lambda x: x["date"], reverse=True)
    return history[:limit]

@app.get("/notifications")
def get_notifications(member_id: str):
    data = load_data()
    notifs = [n for n in data.get("notifications", {}).values() if n["member_id"] == member_id]
    notifs.sort(key=lambda x: x["timestamp"], reverse=True)
    return notifs[:30]

@app.put("/notifications/read")
def mark_read(member_id: str):
    data = load_data()
    changed = 0
    for nid, n in data.get("notifications", {}).items():
        if n["member_id"] == member_id and not n["read"]:
            data["notifications"][nid]["read"] = True
            changed += 1
    save_data(data)
    return {"message": f"Marked {changed} as read"}

# ── Admin Endpoints ────────────────────────────────────────────────────
@app.get("/admin/stats")
def admin_stats(_=Depends(require_admin)):
    data = load_data()
    today = date.today().isoformat()
    total_members = sum(len(sq["members"]) for sq in data["squads"].values())
    today_bookings = [bk for bk in data["bookings"].values() if bk["date"] == today]
    today_checkins = [ci for ci in data.get("checkins", {}).values() if ci["date"] == today]
    seat_counts = {}
    for bk in data["bookings"].values():
        sid = bk["seat"]["id"]
        seat_counts[sid] = seat_counts.get(sid, 0) + 1
    top_seats = sorted(seat_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    all_bks = [{**bk, "member": clean_member(bk["member"])} for bk in data["bookings"].values()]
    return {
        "total_members": total_members, "total_seats": len(data["seats"]),
        "total_bookings": len(data["bookings"]), "total_vacations": len(data.get("vacations", {})),
        "total_blocks": len(data.get("blocks", {})),
        "today_bookings": len(today_bookings), "today_checkins": len(today_checkins),
        "checkin_rate": round(len(today_checkins) / max(len(today_bookings), 1) * 100, 1),
        "top_seats": [{"seat_id": s, "count": c} for s, c in top_seats],
        "all_bookings": sorted(all_bks, key=lambda x: x["date"], reverse=True),
    }

@app.post("/admin/seat")
async def admin_add_seat(req: AdminSeatRequest, _=Depends(require_admin)):
    data = load_data()
    existing_nums = [s["number"] for s in data["seats"].values()]
    new_num = max(existing_nums) + 1 if existing_nums else 1
    new_id = f"S{new_num:02d}"
    row, col = (new_num - 1) // 10, (new_num - 1) % 10
    data["seats"][new_id] = {
        "id": new_id, "number": new_num, "is_floater": req.is_floater,
        "row": row, "col": col, "floor": req.floor, "zone": req.zone,
        "amenities": req.amenities, "is_blocked": False,
    }
    save_data(data)
    await manager.broadcast({"type": "seat_update"})
    return {"message": f"Seat {new_id} added", "seat": data["seats"][new_id]}

@app.delete("/admin/seat/{seat_id}")
async def admin_remove_seat(seat_id: str, _=Depends(require_admin)):
    data = load_data()
    if seat_id not in data["seats"]:
        raise HTTPException(404, "Seat not found")
    del data["seats"][seat_id]
    save_data(data)
    await manager.broadcast({"type": "seat_update"})
    return {"message": f"Seat {seat_id} removed"}

@app.put("/admin/seat/{seat_id}")
async def admin_update_seat(seat_id: str, req: AdminSeatUpdateRequest, _=Depends(require_admin)):
    data = load_data()
    if seat_id not in data["seats"]:
        raise HTTPException(404, "Seat not found")
    seat = data["seats"][seat_id]
    if req.zone is not None: seat["zone"] = req.zone
    if req.amenities is not None: seat["amenities"] = req.amenities
    if req.is_floater is not None: seat["is_floater"] = req.is_floater
    if req.is_blocked is not None: seat["is_blocked"] = req.is_blocked
    save_data(data)
    await manager.broadcast({"type": "seat_update"})
    return {"message": f"Seat {seat_id} updated", "seat": data["seats"][seat_id]}

# ── WebSocket ──────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)

# ── Reset ──────────────────────────────────────────────────────────────
@app.get("/reset")
async def reset_data():
    data = load_data()
    data["bookings"] = {}
    data["vacations"] = {}
    data["blocks"] = {}
    data["checkins"] = {}
    data["notifications"] = {}
    data["recurring_bookings"] = {}
    save_data(data)
    await manager.broadcast({"type": "reset"})
    return {"message": "All data reset"}
