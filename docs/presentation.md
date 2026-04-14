# SeatFlow: Intelligent Seat Allocation System
## Streamlining Workspace Management

---

## Slide 1: Overview
**Title: SeatFlow - Intelligent Seat Allocation System**

* **What it is:** A full-stack web application designed to manage hybrid office seating efficiently.
* **Scale:** Manages 10 Squads, 80 Members, and 50 Seats.
* **Goal:** Eliminate booking conflicts, enforce business rules, and provide a clear visual overview of office occupancy.

---

## Slide 2: Architecture & Technology Stack
**Title: Modern Full-Stack Architecture**

* **Frontend (React + Vite):** A fast, component-based UI running on port 5173. Provides dashboards, visual floor plans, and step-by-step booking flows.
* **Backend (Python FastAPI):** A high-performance API running on port 8000. Handles all business logic and validation across 14 RESTful endpoints.
* **Database (JSON File Storage):** Uses a lightweight `data.json` file ensuring zero complex database setup while maintaining data integrity.
* **Integration (`api.js`):** Seamless data exchange via Axios HTTP calls, ensuring the frontend is always synced with the backend state.

---

## Slide 3: Key Features & User Experience
**Title: Core Features for Users & Admins**

* **Visual Floor Plan & Dashboards:** Real-time visual representation of all 50 seats (Fixed vs. Floater) and daily occupancy statistics.
* **Smart Booking System:** Context-aware booking that highlights available seats and restricts invalid choices based on the user's squad.
* **After-Hours "Block Seat" Rule:** Allows users to reserve seats only after 3:00 PM for the next working day.
* **Vacation & Schedule Management:** Integrated vacation logger that automatically frees up previously booked seats.

---

## Slide 4: Business Rules Engine
**Title: Automated Policy Enforcement**

* **Fortnightly Rotation:** Squads are split into two batches (1-5 and 6-10) with designated office days that automatically swap every week.
* **Designated vs. Non-Designated Days:** On designated days, members can book Fixed Seats (S01-S40). On non-designated days, they are restricted to Floater Seats (S41-S50).
* **Holiday & Weekend Protection:** The backend actively blocks bookings for non-working days.
* **Fair Usage:** Strictly enforces a "one booking per member per day" rule to prevent hoarding.
