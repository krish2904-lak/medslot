const test = require('node:test');
const assert = require('node:assert/strict');

const {
  toMinutes,
  overlaps,
  generateSlots,
  getAvailableSlots,
  isAppointmentConflict
} = require('./services/schedulingEngine');

test('toMinutes converts HH:MM into minutes', () => {
  assert.equal(toMinutes('09:30'), 570);
  assert.equal(toMinutes('17:00'), 1020);
});

test('overlaps detects conflicting time ranges', () => {
  assert.equal(overlaps('09:00', '09:30', '09:15', '09:45'), true);
  assert.equal(overlaps('09:00', '09:30', '09:30', '10:00'), false);
});

test('generateSlots creates all valid consultation slots and omits break time', () => {
  const slots = generateSlots('09:00', '11:00', 30, '10:00', '10:30');
  assert.deepEqual(slots, [
    '09:00',
    '09:30',
    '10:30',
    '11:00'
  ]);
});

test('getAvailableSlots filters out booked appointments', () => {
  const doctor = {
    start_time: '09:00',
    end_time: '11:00',
    break_start: '10:00',
    break_end: '10:30',
    appointment_duration: 30,
    buffer_minutes: 0
  };

  const appointments = [
    { start_time: '2026-09-17T09:00:00', end_time: '2026-09-17T09:30:00' },
    { start_time: '2026-09-17T10:30:00', end_time: '2026-09-17T11:00:00' }
  ];

  const slots = getAvailableSlots(doctor, appointments, '2026-09-17');
  assert.deepEqual(slots, ['09:30']);
});

test('isAppointmentConflict catches overlapping bookings', () => {
  const existing = [
    { start_time: '2026-09-17T10:00:00', end_time: '2026-09-17T10:30:00' }
  ];

  assert.equal(
    isAppointmentConflict('2026-09-17T09:45:00', '2026-09-17T10:15:00', existing),
    true
  );

  assert.equal(
    isAppointmentConflict('2026-09-17T10:30:00', '2026-09-17T11:00:00', existing),
    false
  );
});
