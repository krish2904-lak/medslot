# MediSlot

> A conflict-free clinic appointment scheduling and front-desk operations system with intelligent rescheduling and workflow automation.

MediSlot is a full-stack clinic scheduling application designed for busy clinic front desks to manage doctors, patients, appointments, availability, cancellations, rescheduling, and operational automation from a single interface.

The system is built around one core principle:

> **A clinic should never accidentally double-book a doctor.**

Instead of treating appointment scheduling as simple CRUD, MediSlot uses centralized scheduling rules that consider:

- Doctor working hours
- Break periods
- Existing appointments
- Appointment duration
- Doctor buffer time
- Rescheduling conflicts
- Cancellation state

The same scheduling constraints are reused across booking and rescheduling workflows.

---

# Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Twist Round / Automation Workflows](#twist-round--automation-workflows)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Setup](#setup)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Health Check](#health-check)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [Database](#database)
- [Scheduling Conflict Rules](#scheduling-conflict-rules)
- [Cancellation Rules](#cancellation-rules)
- [Pagination and Sorting](#pagination-and-sorting)
- [Automation Clock](#automation-clock)
- [Testing](#testing)
- [Debugging](#debugging)
- [Engineering Decisions](#engineering-decisions)
- [Project Verification](#project-verification)
- [Future Features](#future-features)
- [Design Philosophy](#design-philosophy)
- [License](#license)

---

# Overview

MediSlot provides a practical front-desk workflow for managing daily clinic operations.

The system supports:

- Staff authentication
- Doctor management
- Doctor schedule configuration
- Patient management
- Patient search
- Appointment booking
- Real-time availability checking
- Conflict-free scheduling
- Doctor daily schedules
- Appointment rescheduling
- Cancellation handling
- Late-cancellation fee calculation
- Slot recovery after cancellation
- Morning appointment reminders
- No-show automation
- Appointment filtering
- Pagination
- Sorting
- Demo data
- Front-desk dashboard
- Operational automation workflows

The application is divided into two main layers:

```text
Frontend
   ↓
REST API
   ↓
Backend Scheduling & Business Logic
   ↓
SQLite Database
```

The frontend communicates with the backend through REST APIs and does not access the database directly.

---

# Key Features

## 1. Staff Authentication

MediSlot provides authentication for clinic staff.

Features include:

- Staff registration
- Staff login
- JWT-based authentication
- Password hashing using bcryptjs
- Protected API routes
- Bearer-token authorization

---

## 2. Doctor Management

Clinic staff can manage doctors and their scheduling configuration.

Supported operations include:

- View doctors
- Add doctors
- View individual doctor information
- Update doctor information
- Configure working hours
- Configure break periods
- Configure appointment buffer time
- View doctor's daily schedule
- Check available appointment slots

Example scheduling model:

```text
Doctor
  ├── Working Hours
  ├── Breaks
  ├── Buffer Time
  └── Appointments
```

---

## 3. Patient Management

MediSlot provides basic patient management functionality.

Staff can:

- View patients
- Add patients
- Search patients
- Find patients by name/details
- View individual patient information

Patient lookup allows front-desk staff to quickly find existing patients before creating a new appointment.

---

## 4. Appointment Booking

Staff can create appointments by selecting:

- Patient
- Doctor
- Date
- Start time
- End time

Before an appointment is created, the backend validates the requested time against the doctor's schedule.

The booking operation checks:

```text
Requested Time
      ↓
Working Hours
      ↓
Break Validation
      ↓
Existing Appointment Check
      ↓
Buffer Validation
      ↓
Appointment Created
```

---

## 5. Conflict-Free Scheduling

MediSlot prevents overlapping appointments for the same doctor.

A booking can be rejected if:

- It starts outside working hours
- It ends outside working hours
- It overlaps a break
- It overlaps an existing confirmed appointment
- It violates the doctor's buffer time
- The requested slot is otherwise unavailable

This validation happens on the backend rather than relying only on frontend checks.

---

## 6. Doctor Daily View

The system provides a daily schedule view for doctors.

This allows staff to understand:

- Which appointments are scheduled
- Appointment timing
- Patient allocation
- Doctor availability
- Schedule occupancy

---

## 7. Smart Rescheduling

Existing appointments can be moved to another date/time.

Rescheduling is not treated as a simple database update.

The new slot is checked again against:

- Doctor working hours
- Break periods
- Existing appointments
- Buffer time
- Availability rules

This prevents a user from bypassing conflict protection through rescheduling.

---

## 8. Cancellation Management

Appointments can be cancelled while preserving cancellation information.

The system records:

- Cancellation status
- Cancellation reason
- Applicable cancellation fee

Cancellation behavior is controlled using the configured cancellation policy.

---

## 9. Late-Cancellation Fee

MediSlot supports a configurable cancellation policy.

The policy contains values such as:

```text
Free cancellation window
Late cancellation fee
```

The current default policy is:

```text
Free cancellation window: 4 hours
Late cancellation fee: ₹100
```

The backend determines whether the cancellation falls inside or outside the configured free-cancellation window.

---

## 10. Slot Rescue

When an appointment is cancelled, the previously occupied time becomes available again.

MediSlot treats this as recoverable clinic capacity.

The Slot Rescue workflow helps front-desk staff identify and reuse recovered appointment capacity.

Instead of:

```text
Cancellation
     ↓
Empty Slot
```

MediSlot supports:

```text
Cancellation
     ↓
Recovered Capacity
     ↓
Slot Rescue
     ↓
Potential New Appointment
```

---

## 11. Morning Appointment Reminders

MediSlot supports a morning reminder workflow for appointments scheduled for the current day.

The workflow identifies today's appointments and triggers the notification workflow.

This reduces the need for staff to manually check every appointment.

---

## 12. No-Show Automation

MediSlot includes an automated no-show workflow.

The system evaluates appointments based on their scheduled start time.

If an appointment remains incomplete beyond the configured threshold, it can be automatically processed as a no-show.

This helps prevent stale appointments from remaining indefinitely in the active schedule.

---

## 13. Appointment Filtering

Appointments can be filtered using available query parameters such as:

- Date
- Doctor
- Patient

This allows staff to quickly narrow down large appointment lists.

---

## 14. Pagination

Appointment results support pagination.

This prevents the frontend from unnecessarily loading large numbers of records at once.

---

## 15. Sorting

Appointment results can be sorted using supported fields and ascending/descending order.

This allows the dashboard to display appointments according to operational requirements.

---

## 16. Professional Front-Desk Dashboard

The dashboard provides an operational overview including:

- Today's appointments
- Confirmed appointments
- Available slots
- Cancelled/no-show information
- Doctor schedules
- Quick booking
- Smart rescheduling
- Automation workflows
- Clinic system status

The interface is designed around a clinic operations workflow rather than a generic CRUD dashboard.

---

# Twist Round / Automation Workflows

MediSlot goes beyond basic appointment CRUD by implementing operational workflows around the clinic scheduling lifecycle.

The main workflows are:

```text
┌──────────────────────────────┐
│        MediSlot Core         │
│      Scheduling Engine       │
└──────────────┬───────────────┘
               │
       ┌───────┼────────┬──────────────┐
       ↓       ↓        ↓              ↓
   Reschedule Reminders No-Show     Slot Rescue
```

---

# 1. Smart Reschedule

### Problem

A patient needs a different appointment time.

Simply updating the appointment timestamp can create a conflict.

### MediSlot Solution

The system validates the new slot using the same scheduling rules as a new booking.

```text
Existing Appointment
        ↓
New Date / Time
        ↓
Check Doctor Availability
        ↓
Check Working Hours
        ↓
Check Break
        ↓
Check Existing Appointments
        ↓
Check Buffer
        ↓
Reschedule
```

The same patient and doctor remain associated with the appointment.

---

# 2. Morning Reminders

### Problem

Clinic staff need to remind patients about appointments scheduled for the current day.

### MediSlot Solution

The morning reminder workflow:

1. Identifies today's appointments.
2. Selects appointments requiring reminders.
3. Sends/processes the notification workflow.
4. Records the workflow result.

This creates a repeatable operational workflow instead of requiring manual appointment-by-appointment checking.

---

# 3. No-Show Automation

### Problem

An appointment can remain active even after its scheduled start time if nobody updates its status.

### MediSlot Solution

The automation evaluates appointment timing.

Conceptually:

```text
Appointment Start
       ↓
Wait / Advance Clock
       ↓
Check Appointment Status
       ↓
Completed?
   ┌───┴───┐
  YES      NO
   ↓        ↓
 Keep     No-Show
 Status    Workflow
```

This keeps the appointment lifecycle consistent.

---

# 4. Slot Rescue

### Problem

A cancelled appointment creates unused clinic capacity.

### MediSlot Solution

MediSlot surfaces recovered availability so the front desk can reuse the slot.

```text
Confirmed Appointment
        ↓
Cancellation
        ↓
Slot Becomes Available
        ↓
Slot Rescue
        ↓
Potential Rebooking
```

---

# Why the Automation Layer Matters

The automation workflows are built around the same scheduling model as normal appointments.

They are not isolated UI demonstrations.

Core scheduling rules remain central:

```text
Doctor Schedule
       ↓
Working Hours
       ↓
Break Validation
       ↓
Existing Appointments
       ↓
Buffer-Time Validation
       ↓
Conflict-Free Operation
```

This keeps booking, rescheduling, and automation behavior consistent.

---

# System Architecture

```text
                         ┌─────────────────────┐
                         │    Clinic Staff     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   React + Vite UI   │
                         │   Frontend Dashboard│
                         └──────────┬──────────┘
                                    │
                              REST API
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │      Node.js + Express      │
                    │                             │
                    │ Authentication              │
                    │ Appointment APIs             │
                    │ Doctor APIs                  │
                    │ Patient APIs                 │
                    │ Scheduling Logic             │
                    │ Cancellation Logic           │
                    │ Automation Workflows         │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │          SQLite             │
                    │       better-sqlite3        │
                    └─────────────────────────────┘
```

---

# Tech Stack

## Frontend

- React
- Vite
- JavaScript
- CSS
- REST API integration

## Backend

- Node.js
- Express.js
- JavaScript
- REST API

## Database

- SQLite
- better-sqlite3

## Authentication

- JSON Web Tokens
- bcryptjs

## Testing

- Node.js built-in test runner

## Development

- npm
- Git
- GitHub
- VS Code / GitHub Codespaces

---

# Repository Structure

```text
medslot/
│
├── backend/
│   ├── src/
│   │   ├── database/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── ...
│   │
│   ├── package.json
│   ├── .env.example
│   └── ...
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── ...
│   │
│   ├── package.json
│   └── ...
│
├── README.md
├── REASONING.md
├── AI_LOGS.md
└── .gitignore
```

---

# Setup

## Prerequisites

Install:

- Node.js
- npm
- Git

Verify:

```bash
node --version
npm --version
git --version
```

---

# 1. Clone the Repository

```bash
git clone https://github.com/krish2904-lak/medslot.git
```

Move into the project:

```bash
cd medslot
```

---

# 2. Install Backend Dependencies

```bash
cd backend
npm install
```

---

# 3. Install Frontend Dependencies

Open another terminal or return to the project root:

```bash
cd ../frontend
npm install
```

---

# Environment Configuration

Create:

```text
backend/.env
```

Example:

```env
PORT=5000
JWT_SECRET=replace-with-a-strong-random-secret
```

Do not commit real secrets to Git.

The `.env` file should remain local.

---

# Running the Application

## Start Backend

From:

```text
backend/
```

run:

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

---

## Start Frontend

From:

```text
frontend/
```

run:

```bash
npm run dev -- --host 0.0.0.0
```

The Vite development server will display the frontend URL in the terminal.

Typically:

```text
http://localhost:5173
```

---

# Health Check

Verify that the backend is running:

```bash
curl http://localhost:5000/api/health
```

If the endpoint responds successfully, the backend is available.

---

# API Reference

All API routes are prefixed with:

```text
/api
```

Protected routes require:

```http
Authorization: Bearer <JWT_TOKEN>
```

---

# Health API

## Check Backend Health

```http
GET /api/health
```

Used to verify that the backend is running.

---

# Authentication API

## Register Staff

```http
POST /api/auth/register
```

Creates a staff account.

---

## Login Staff

```http
POST /api/auth/login
```

Authenticates a staff member and returns an authentication token.

---

# Doctor API

## Get Doctors

```http
GET /api/doctors
```

Returns the available doctors.

---

## Create Doctor

```http
POST /api/doctors
```

Creates a doctor record.

---

## Get Doctor

```http
GET /api/doctors/:id
```

Returns information for a specific doctor.

---

## Update Doctor

```http
PATCH /api/doctors/:id
```

Updates doctor information or scheduling configuration.

---

## Get Doctor Day

```http
GET /api/doctors/:id/day
```

Returns the doctor's schedule for the relevant day.

---

## Get Available Slots

```http
GET /api/doctors/:id/available-slots?date=YYYY-MM-DD
```

Returns available appointment slots for a doctor on a selected date.

Example:

```text
GET /api/doctors/1/available-slots?date=2026-09-17
```

---

# Patient API

## Get Patients

```http
GET /api/patients
```

Returns patients.

---

## Create Patient

```http
POST /api/patients
```

Creates a new patient.

---

## Search Patients

```http
GET /api/patients/search?q=term
```

Searches patients using a query term.

Example:

```text
GET /api/patients/search?q=Rahul
```

---

## Get Patient

```http
GET /api/patients/:id
```

Returns an individual patient.

---

# Appointment API

## Get Appointments

```http
GET /api/appointments
```

Returns appointment records.

Supports filtering, sorting, and pagination.

---

## Check Appointment Availability

```http
GET /api/appointments/availability?doctorId=1&date=2026-09-17
```

Checks appointment availability for a doctor and date.

---

## Create Appointment

```http
POST /api/appointments
```

Creates a new appointment after validating scheduling constraints.

---

## Get Appointment

```http
GET /api/appointments/:id
```

Returns a specific appointment.

---

## Update Appointment

```http
PATCH /api/appointments/:id
```

Updates an appointment where supported.

---

## Cancel Appointment

```http
POST /api/appointments/:id/cancel
```

Cancels an appointment and applies the configured cancellation policy.

---

## Reschedule Appointment

```http
POST /api/appointments/:id/reschedule
```

Moves an appointment to a new date/time after re-validating scheduling conflicts.

---

# Automation API

MediSlot's automation workflows are exposed through the backend and surfaced through the frontend automation dashboard.

The automation layer includes:

```text
Smart Reschedule
Morning Reminders
No-Show Automation
Slot Rescue
```

For challenge/evaluation environments, the clock-control workflow can be triggered through:

```http
POST /clock
```

This allows time-dependent workflows such as morning reminders and no-show processing to be evaluated without waiting for real-world time to pass.

---

# Authentication

MediSlot uses JWT authentication.

The authentication lifecycle is:

```text
Staff Registration
       ↓
Password Hashing
       ↓
Login
       ↓
JWT Issued
       ↓
Frontend Stores Authentication State
       ↓
Bearer Token
       ↓
Protected API
```

Protected requests use:

```http
Authorization: Bearer <token>
```

Example:

```bash
curl \
  -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/doctors
```

Passwords are hashed using:

```text
bcryptjs
```

The frontend does not directly communicate with SQLite.

---

# Database

MediSlot uses:

```text
SQLite
```

through:

```text
better-sqlite3
```

SQLite was selected because it provides a lightweight local database without requiring a separate database server.

---

# Main Database Tables

## users

Stores staff authentication information.

Typical responsibilities:

- Staff account
- Login credentials
- Authentication identity

---

## doctors

Stores doctor information and scheduling configuration.

Includes scheduling concepts such as:

- Working hours
- Breaks
- Buffer time

---

## patients

Stores patient information used by the front desk.

---

## cancellation_policies

Stores cancellation policy configuration.

Important policy values include:

```text
free_cancellation_hours
late_cancellation_fee
```

---

## appointments

Stores appointment lifecycle information.

Appointment records can contain:

- Patient
- Doctor
- Start time
- End time
- Status
- Cancellation reason
- Cancellation fee
- Scheduling information

---

# Scheduling Conflict Rules

Scheduling validation is one of the core pieces of MediSlot.

A new appointment must satisfy all applicable scheduling constraints.

---

## Rule 1 — Working Hours

The appointment must fit completely inside the doctor's configured working hours.

For example:

```text
Doctor Working Hours

09:00 ───────────────────── 17:00
```

An appointment extending beyond the working period is rejected.

---

## Rule 2 — Break Periods

Appointments cannot overlap a doctor's configured break.

Example:

```text
09:00 ───── 13:00
             BREAK
13:30 ───── 17:00
```

An appointment crossing the break is invalid.

---

## Rule 3 — Existing Appointment

A new confirmed appointment cannot overlap another confirmed appointment for the same doctor.

Example:

```text
Appointment A
10:00 ───────── 10:30

Appointment B
          10:20 ───────── 10:50
```

Result:

```text
REJECTED
```

because the appointments overlap.

---

## Rule 4 — Valid Adjacent Slots

If no buffer is configured:

```text
Appointment A
10:00 ───── 10:30

Appointment B
              10:30 ───── 11:00
```

The appointments can be adjacent.

---

## Rule 5 — Doctor Buffer Time

If a doctor has:

```text
buffer_minutes = 10
```

the next appointment must respect that buffer.

Example:

```text
Appointment A
10:00 ───── 10:30

Buffer
              10:30 ───── 10:40

Next Appointment
                          10:40 ─────
```

This prevents appointments from being packed too closely together.

---

## Rule 6 — Rescheduling Uses the Same Rules

A user cannot bypass scheduling protection by rescheduling.

The new time is validated again against:

```text
Working Hours
Breaks
Existing Appointments
Buffer
Availability
```

Only then is the appointment moved.

---

# Cancellation Rules

MediSlot supports configurable cancellation behavior.

The cancellation policy contains:

```text
free_cancellation_hours
late_cancellation_fee
```

Default configuration:

```text
Free cancellation window = 4 hours
Late cancellation fee    = ₹100
```

---

## Cancellation Flow

```text
Cancellation Requested
          ↓
Check Appointment Time
          ↓
Check Cancellation Policy
          ↓
Free Cancellation?
      ┌───┴───┐
     YES      NO
      ↓        ↓
   Fee ₹0    Apply Fee
      └───┬────┘
          ↓
Store Cancellation
```

The appointment retains:

- Cancellation status
- Cancellation reason
- Applicable fee

---

# Pagination and Sorting

The appointments API supports pagination, filtering, and sorting.

Endpoint:

```http
GET /api/appointments
```

---

## Pagination Parameters

### `page`

Page number.

Example:

```text
?page=2
```

---

### `limit`

Number of records per page.

Example:

```text
?limit=20
```

---

# Filtering

## Filter by Date

```text
?date=2026-09-17
```

---

## Filter by Doctor

```text
?doctorId=1
```

---

## Filter by Patient

```text
?patientId=1
```

---

# Sorting

The endpoint supports sorting using supported appointment fields.

Example:

```text
?sort=start_time
```

Descending:

```text
?sort=start_time&order=desc
```

Ascending:

```text
?sort=start_time&order=asc
```

---

## Combined Example

```text
/api/appointments?page=1&limit=20&sort=start_time&order=asc&date=2026-09-17
```

This allows the frontend to request only the appointment data required for the current dashboard view.

---

# Automation Clock

Some workflows depend on time.

Waiting for real time during testing would make automated evaluation slow and unreliable.

MediSlot therefore supports a clock-control workflow for evaluation.

The clock can be advanced through:

```http
POST /clock
```

This allows time-dependent workflows to be tested deterministically.

Examples include:

```text
Morning Reminder
       ↓
Advance Clock
       ↓
Today's Appointments
       ↓
Reminder Workflow
```

and:

```text
Appointment Start
       ↓
Advance Clock
       ↓
30+ Minute Threshold
       ↓
No-Show Automation
```

This makes time-based behavior easier to test during the twist round.

---

# Testing

The backend uses Node.js's built-in test runner.

Run:

```bash
cd backend
npm test
```

For detailed output:

```bash
npm test -- --test-reporter=spec
```

---

# Frontend Build Verification

To verify that the frontend compiles successfully:

```bash
cd frontend
npm run build
```

A successful build confirms that the production frontend bundle can be generated.

---

# Manual Verification Checklist

Before submission, verify:

```text
[ ] Staff registration
[ ] Staff login
[ ] Dashboard loads
[ ] Doctors load
[ ] Patients load
[ ] Patient search works
[ ] Appointment booking works
[ ] Availability works
[ ] Conflict prevention works
[ ] Doctor day view works
[ ] Cancellation works
[ ] Late cancellation fee works
[ ] Smart reschedule works
[ ] Slot Rescue works
[ ] Morning Reminders work
[ ] No-Show Automation works
[ ] Pagination works
[ ] Sorting works
[ ] Navigation works
[ ] Browser console is clean
[ ] Backend tests pass
[ ] Frontend build passes
```

---

# Debugging

## Backend Does Not Start

Run:

```bash
cd backend
npm install
npm run dev
```

Then check:

```bash
curl http://localhost:5000/api/health
```

If the health endpoint does not respond, inspect the backend terminal for startup errors.

---

# Authentication Errors

If the frontend reports authentication errors:

1. Confirm the backend is running.
2. Confirm registration/login succeeds.
3. Confirm the login response contains a token.
4. Confirm the frontend maintains the authentication state.
5. Confirm protected API requests send:

```http
Authorization: Bearer <token>
```

---

# Booking Errors

If booking fails, check:

- Doctor ID
- Patient ID
- Date
- Start time
- End time
- Doctor working hours
- Break periods
- Existing appointments
- Buffer time

A rejected booking does not necessarily indicate a system error.

It may indicate that the requested slot violates a scheduling rule.

---

# Rescheduling Errors

If rescheduling fails:

1. Verify the appointment exists.
2. Verify the target doctor/date/time.
3. Check working hours.
4. Check breaks.
5. Check existing appointments.
6. Check doctor buffer.
7. Check backend logs.

Rescheduling intentionally uses the same conflict rules as booking.

---

# Morning Reminder Errors

If the reminder workflow fails:

1. Confirm the backend is running.
2. Confirm today's appointments exist.
3. Verify authentication.
4. Trigger the automation workflow.
5. Check the backend response.
6. Check browser console/network logs.

For time-based evaluation, use the clock-control workflow instead of waiting for actual time.

---

# No-Show Automation Errors

If no-show processing does not occur:

1. Confirm the appointment start time.
2. Confirm the appointment is still incomplete.
3. Advance the evaluation clock if required.
4. Trigger the automation workflow.
5. Check the appointment status.
6. Inspect backend logs.

---

# Frontend API Errors

If the browser shows an API error:

### Step 1

Confirm backend health:

```bash
curl http://localhost:5000/api/health
```

### Step 2

Open browser DevTools.

Check:

```text
Console
Network
```

### Step 3

Inspect the failed request.

Verify:

```text
URL
HTTP Method
Status Code
Request Headers
Authorization Header
Response Body
```

### Step 4

Check backend terminal output.

---

# Common Development Issues

## Port Already in Use

If port `5000` or `5173` is already occupied, stop the old process or use another available port.

---

## Dependencies Missing

Run:

```bash
npm install
```

inside the relevant directory.

Backend:

```bash
cd backend
npm install
```

Frontend:

```bash
cd frontend
npm install
```

---

## Environment Variable Problems

Verify:

```text
backend/.env
```

contains:

```env
PORT=5000
JWT_SECRET=your-secret
```

Restart the backend after modifying environment variables.

---

# Engineering Decisions

## Why SQLite?

SQLite keeps the project lightweight and easy to run.

Advantages for this project:

- No external database server
- Minimal setup
- Fast local development
- Transaction support
- Suitable for the challenge environment

---

## Why REST API?

REST provides a clear boundary between:

```text
Frontend
```

and:

```text
Backend Business Logic
```

This makes the application easier to test and extend.

---

## Why Centralized Scheduling Rules?

Scheduling rules are business-critical.

If booking and rescheduling implemented different rules, the system could allow a conflict through one workflow.

Therefore:

```text
Booking
   │
   ├─────────────┐
   │             │
   ▼             ▼
Scheduling Validation
   ▲             ▲
   │             │
Reschedule    Availability
```

The same scheduling constraints are reused.

---

## Why Backend Validation?

Frontend validation improves user experience, but it cannot be trusted as the final protection.

The backend performs the authoritative scheduling validation.

This prevents invalid requests from bypassing the UI.

---

# Project Verification

The project should be verified using both automated tests and manual workflows.

---

## Backend Test

```bash
cd backend
npm test
```

---

## Frontend Build

```bash
cd frontend
npm run build
```

---

## Health Check

```bash
curl http://localhost:5000/api/health
```

---

## Functional Verification

The final workflow should cover:

```text
Authentication
     ↓
Doctor Setup
     ↓
Patient Setup
     ↓
Appointment Booking
     ↓
Conflict Validation
     ↓
Daily Schedule
     ↓
Rescheduling
     ↓
Cancellation
     ↓
Slot Rescue
     ↓
Morning Reminder
     ↓
No-Show Automation
```

---

# Future Features

The current version focuses on reliable appointment scheduling and front-desk automation.

Potential future extensions include:

## 1. Recurring Appointments

Support recurring patient visits and repeated schedules.

---

## 2. Rich Patient History

Add detailed patient appointment history and visit records.

---

## 3. Role-Based Staff Permissions

Support roles such as:

```text
Admin
Doctor
Receptionist
Manager
```

with different permissions.

---

## 4. Audit Logs

Track important system operations such as:

- Appointment creation
- Appointment cancellation
- Rescheduling
- Policy changes
- Staff actions
- Automation events

---

## 5. Advanced Reporting

Add operational analytics such as:

- Daily appointment volume
- Doctor utilization
- Cancellation rate
- No-show rate
- Slot utilization
- Peak clinic hours

---

## 6. Calendar Integrations

Support external calendar integrations.

Potential integrations include:

- Google Calendar
- Outlook Calendar
- iCal

---

## 7. SMS and Email Providers

Replace the current notification workflow with real external notification providers.

Potential channels:

- SMS
- Email
- WhatsApp

---

## 8. Appointment Waitlist

Allow patients to join a waitlist when preferred slots are unavailable.

When a slot becomes available:

```text
Cancellation
     ↓
Waitlist Check
     ↓
Matching Patient
     ↓
Notification
     ↓
Potential Booking
```

---

## 9. Multi-Clinic Support

Support multiple clinics and locations from a single application.

---

## 10. Advanced Analytics

Provide operational dashboards for:

- Doctor workload
- Patient volume
- Appointment trends
- Cancellation trends
- No-show trends
- Slot utilization

---

# Design Philosophy

MediSlot is built around three main operational goals.

---

## 1. Prevent Conflicts

The scheduling engine should prevent accidental double-booking.

```text
Doctor
  ↓
Schedule
  ↓
Availability
  ↓
Conflict Check
  ↓
Safe Booking
```

---

## 2. Recover Capacity

Cancelled appointments should not simply become lost capacity.

```text
Cancellation
     ↓
Recovered Slot
     ↓
Slot Rescue
     ↓
Potential Rebooking
```

---

## 3. Automate Repetitive Operations

Routine clinic operations can be automated.

```text
Morning
   ↓
Reminder Workflow

Appointment Start
   ↓
Completion Check
   ↓
No-Show Workflow
```

---

# MediSlot Workflow

The complete system can be viewed as:

```text
                         MEDISLOT
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
     SCHEDULING          LIFECYCLE        AUTOMATION
          │                 │                 │
          ▼                 ▼                 ▼
       Booking          Reschedule       Reminders
       Availability     Cancellation     No-Show
       Conflicts        Slot Rescue
          │                 │                 │
          └─────────────────┼─────────────────┘
                            ▼
                    CLINIC OPERATIONS
```

---

# Project Documentation

Additional project reasoning is documented in:

```text
REASONING.md
```

AI-assisted development decisions and development logs are documented in:

```text
AI_LOGS.md
```

These files provide additional context about implementation decisions and the development process.

---

# License

This project is developed as a full-stack clinic scheduling and automation engineering project.

---

# Author

**Lakshya Jain**

GitHub:

https://github.com/krish2904-lak

Repository:

https://github.com/krish2904-lak/medslot
