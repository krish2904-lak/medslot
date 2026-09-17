# MediSlot Reasoning

## Engineering decisions

- The app is structured as a working frontend/backend split with the React UI consuming the Express API instead of accessing SQLite directly.
- The scheduling logic is preserved in the backend services and controller validation rather than being rewritten or refactored.
- The booking contract is strictly aligned with the backend: doctor_id, patient_id, start_time, and end_time are the actual required fields.
- A JWT is required for protected routes, and login is used to issue the token for the current session.
- The availability engine validates appointments against working hours, configured breaks, and existing bookings, with buffer minutes applied to avoid dangerous overlaps.

## Scheduling algorithm

The backend computes availability from the configured doctor working window and filters out any blocked or occupied time. The main rule is that an appointment is valid only if it fits inside the doctor schedule and does not overlap breaks or previous appointments. A buffer window is also enforced when present.

## Cancellation logic

The cancellation path reads the most recent cancellation policy, checks whether the cancellation occurs within the free window, and applies the late fee when required. The fee and reason are persisted on the appointment record.

## Testing and fixes

- The working demo was validated with real backend requests and browser interactions.
- The root cause of the final booking failure was a timezone mismatch between the frontend serializer and the backend local-time validation logic. The fix preserved the app behavior while aligning the timestamp contract.
- The login flow was also tightened so the app uses the newly issued token immediately instead of firing protected requests before the token is ready.

## Final scope note

This repository is intentionally kept in a stable, demo-ready state. No feature work was added after the app was confirmed working; only the final repository layout and submission documentation were prepared.
