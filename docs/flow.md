# SeatFlow — App Flow Documentation

## Overview
SeatFlow is a smart workspace seat booking system for an organization with 50 seats, 10 squads, and 2 batches.

## User Flow

### 1. Dashboard
- View weekly utilization statistics
- See daily occupancy bar chart
- View squad designated day schedule

### 2. Floor Plan
- Interactive 50-seat visual map
- Day selector tabs (Mon–Fri)
- Color-coded by squad
- Floater zone clearly separated
- Click seats for details
- Filter by squad

### 3. Week View
- Designated days matrix (squads × days)
- Daily booking summaries
- Week navigation

### 4. My Schedule
- Personal week view
- See designated vs non-designated days
- Book/release seats inline
- View vacation and block status

### 5. Book a Seat
- Step 1: Select day (with free seat counts)
- Step 2: Filter seats (all/fixed/floater)
- Step 3: Visual seat selection
- Confirm booking

### 6. Block Seat
- 3PM gate mechanism
- Only for non-designated days
- Block for next working day only
- View/remove existing blocks

### 7. Vacation
- Mark/remove vacation days
- Auto-releases existing bookings
- Cannot mark on holidays

### 8. Squads
- Directory of all 10 squads
- Expandable member lists
- Batch and color coding

## Batch Rotation Logic
- ISO week odd = Week 1, even = Week 2
- Batch 1 (Squads 1-5): Week 1 → Mon,Tue,Wed; Week 2 → Thu,Fri
- Batch 2 (Squads 6-10): Week 1 → Thu,Fri; Week 2 → Mon,Tue,Wed
- Each squad visits office exactly 5 days per 2-week cycle
