# MediSlot

MediSlot is a full-stack clinic scheduling demo for front-desk operations. The repository is split into a React/Vite frontend and a Node/Express + SQLite backend that share the same working scheduling model.

## Overview

This application supports clinic staff in managing doctors, patients, appointment bookings, cancellation rules, and conflict-aware availability checks. The project is intentionally kept simple and production-minded for a demo environment, with a lightweight SQLite database and a JWT-backed auth flow.

## Features

- Staff authentication with JWT
- Doctor management and schedule configuration
- Patient management and lookup
- Appointment booking with daily availability checks
- Scheduling conflict prevention based on working hours, breaks, and existing bookings
- Cancellation tracking and late-cancellation fee logic
- Appointment list pagination and sorting
- Demo data loading for quick front-desk use

## Tech stack

- Frontend: React, Vite, CSS
- Backend: Node.js, Express
- Database: SQLite via better-sqlite3
- Authentication: JWT + bcryptjs
- Testing: Node built-in test runner

## Repository structure

- `frontend/` — React + Vite app
- `backend/` — Express API, SQLite database, scheduling logic, and backend tests
- `README.md` — project setup and usage
- `REASONING.md` — engineering decisions and rules
- `AI_LOGS.md` — raw AI conversation transcript

## Setup

### 1. Install dependencies

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 2. Environment configuration

Create a local `.env` file in `backend/` based on `backend/.env.example`.

```env
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret
```

### 3. Frontend run command

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

The frontend runs on:

- http://localhost:5173

### 4. Backend run command

```bash
cd backend
npm run dev
```

The backend runs on:

- http://localhost:5000

### 5. Health check

```bash
curl http://localhost:5000/api/health
```

## Actual API endpoint list

### Health

- `GET /api/health`

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`

### Doctors

- `GET /api/doctors`
- `POST /api/doctors`
- `GET /api/doctors/:id`
- `PATCH /api/doctors/:id`
- `GET /api/doctors/:id/day`
- `GET /api/doctors/:id/available-slots?date=YYYY-MM-DD`

### Patients

- `GET /api/patients`
- `POST /api/patients`
- `GET /api/patients/search?q=term`
- `GET /api/patients/:id`

### Appointments

- `GET /api/appointments`
- `GET /api/appointments/availability?doctorId=1&date=2026-09-17`
- `POST /api/appointments`
- `GET /api/appointments/:id`
- `PATCH /api/appointments/:id`
- `POST /api/appointments/:id/cancel`
- `POST /api/appointments/:id/reschedule`

### Notes

- All protected routes require an `Authorization: Bearer <token>` header.
- The frontend uses the same API layer as the backend contract and does not access the SQLite database directly.

## Database

The backend uses SQLite with a local file database at `backend/medslot.db`.

Tables include:

- `users`
- `doctors`
- `patients`
- `cancellation_policies`
- `appointments`

The schema is created on startup in `backend/src/database/schema.js` and the connection is initialized in `backend/src/database/db.js`.

## Authentication

Authentication is handled with JWT. A successful login returns a JSON Web Token that must be sent on protected requests via the `Authorization` header.

Example:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/doctors
```

## Scheduling conflict rule

Scheduling conflict protection is enforced as follows:

- the appointment must start and end within the doctor's configured working hours
- the appointment cannot overlap a configured break window
- the appointment cannot overlap another confirmed appointment for the same doctor
- doctor `buffer_minutes` is applied as a protective gap before/after existing appointments

This logic is implemented in `backend/src/services/schedulingEngine.js` and the controller validation in `backend/src/controllers/clinicController.js`.

## Cancellation rule

Cancellations use the latest `cancellation_policies` row to determine policy behavior.

Actual rule in the current implementation:

- free cancellation window is controlled by `free_cancellation_hours` (default `4` hours)
- late cancellation fee is controlled by `late_cancellation_fee` (default `100`)
- if the appointment is canceled inside the free window or the reason contains `late`, the late fee is applied
- the cancellation reason and fee are stored on the appointment record

## Pagination and sorting

`GET /api/appointments` supports query parameters:

- `page` (default `1`)
- `limit` (default `20`)
- `sort` (`start_time`, `end_time`, `created_at`, `doctor_id`, `patient_id`, `status`)
- `order` (`asc` or `desc`)
- `date` (filter by date)
- `doctorId` (filter by doctor)
- `patientId` (filter by patient)

## Debugging

Common checks:

```bash
cd backend && npm run dev
curl http://localhost:5000/api/health
```

If the frontend reports auth errors:

- verify the backend is running
- verify the login returned a JWT
- confirm the stored token is sent in the Authorization header

If bookings fail:

- confirm the doctor and patient IDs are valid
- confirm the start/end time falls within the doctor's working hours
- confirm the appointment does not overlap another appointment or break block

## Future features

Planned enhancements are intentionally left out of the current working demo and should be implemented only after the production scheduling model is fully stabilized. Likely additions include:

- appointment reminders
- recurring visits
- stronger patient histories
- advanced staff roles and permissions
- audit logs and reporting
- calendar export and integrations
