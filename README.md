# MediSlot

> A conflict-free clinic appointment scheduling and front-desk operations system with intelligent rescheduling and workflow automation.

MediSlot is a full-stack clinic scheduling application designed for front-desk staff to manage doctors, patients, appointments, availability, cancellations, and operational workflows from a single interface.

The system is built around one core principle:

**A clinic should never accidentally double-book a doctor.**

Instead of treating scheduling as simple CRUD, MediSlot uses a centralized scheduling model that considers working hours, breaks, existing appointments, and doctor buffer time before allowing a booking or reschedule.

---

## Overview

MediSlot provides a practical front-desk workflow for managing daily clinic operations.

The application supports:

- Staff authentication
- Doctor management
- Patient management
- Appointment booking
- Conflict-free availability checking
- Doctor daily schedules
- Appointment rescheduling
- Cancellation and late-cancellation fee handling
- Slot recovery after cancellations
- Morning appointment reminders
- No-show automation
- Appointment filtering, pagination, and sorting
- Demo data for quick testing
- A professional clinic operations dashboard

The frontend is built with React and Vite, while the backend uses Node.js, Express, and SQLite.

The frontend communicates with the backend through REST APIs and never accesses the SQLite database directly.

---

# Features

## Authentication

- Staff registration
- Staff login
- JWT-based authentication
- Password hashing with bcryptjs
- Protected API routes
- Bearer-token authentication

## Doctor Management

- View doctors
- Add doctors
- Update doctor information
- Configure working hours
- Configure break windows
- Configure appointment buffer time
- View a doctor's daily schedule
- Check available appointment slots

## Patient Management

- View patients
- Add patients
- Search patients by name/details
- View individual patient information

## Appointment Management

- Book appointments
- Check daily availability
- View appointments
- Filter appointments
- Sort appointments
- Paginate appointment results
- Cancel appointments
- Reschedule appointments
- Prevent overlapping appointments
- Validate appointments against doctor working hours

## Conflict-Free Scheduling

MediSlot prevents invalid bookings by validating:

- Doctor working hours
- Break periods
- Existing confirmed appointments
- Appointment start/end times
- Doctor buffer time

The same scheduling rules are reused when appointments are rescheduled.

## Cancellation Management

- Appointment cancellation
- Cancellation reason tracking
- Configurable free-cancellation window
- Late-cancellation fee calculation
- Fee storage against the appointment

## Front-Desk Dashboard

The dashboard provides an operational overview including:

- Today's appointments
- Confirmed appointments
- Available slots
- Cancelled/no-show information
- Today's schedule
- Quick booking access
- Automation workflows
- Clinic system status

---

# Twist Round / Automation Workflows

MediSlot extends beyond basic appointment CRUD by implementing operational workflows designed around realistic clinic front-desk problems.

## 1. Smart Reschedule

Allows staff to move an existing appointment to another date/time.

Before rescheduling, the system re-validates:

- Doctor availability
- Working hours
- Break periods
- Existing appointments
- Buffer-time constraints

The appointment keeps the same patient and doctor while moving to a conflict-free slot.

---

## 2. Morning Reminders

The Morning Reminder workflow generates notifications for appointments scheduled for the current day.

This allows clinic staff to trigger the morning notification workflow rather than manually checking every appointment.

The workflow is exposed through a protected backend endpoint and is accessible from the frontend automation dashboard.

---

## 3. No-Show Automation

MediSlot includes an automated no-show workflow for incomplete appointments.

The automation checks appointments against their scheduled start time and configured threshold.

Appointments that remain incomplete after the configured period can be processed as no-shows.

This prevents stale appointments from remaining indefinitely in the active schedule.

---

## 4. Slot Rescue

When an appointment is cancelled, the previously occupied time becomes an opportunity for another booking.

The Slot Rescue workflow surfaces cancelled capacity so front-desk staff can quickly reuse the recovered appointment slot.

This turns cancellation handling into an operational recovery workflow instead of simply deleting/canceling a record.

---

## Why These Workflows Matter

The automation layer uses the same scheduling model as normal booking.

This means the application is not simply a collection of independent demo buttons.

The workflows operate around the same clinic constraints:

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
