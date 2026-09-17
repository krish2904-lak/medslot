const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./server');

let server;
let baseUrl;
let token;
let doctorId;
let patientId;
let appointmentId;

async function apiFetch(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data = text ? JSON.parse(text) : {};

  return { status: response.status, data };
}

test.before(async () => {
  server = startServer(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('registration works', async () => {
  const result = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: { name: 'Clinic Staff', email: 'staff@example.com', password: 'secret123' }
  });

  assert.equal(result.status, 201);
  assert.equal(result.data.success, true);
  assert.ok(result.data.user?.id);
});

test('login works and returns JWT', async () => {
  const result = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email: 'staff@example.com', password: 'secret123' }
  });

  assert.equal(result.status, 200);
  assert.equal(result.data.success, true);
  assert.ok(result.data.token);
  token = result.data.token;
});

test('duplicate email is rejected', async () => {
  const result = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: { name: 'Clone User', email: 'staff@example.com', password: 'secret456' }
  });

  assert.equal(result.status, 409);
  assert.equal(result.data.success, false);
});

test('invalid login is rejected', async () => {
  const result = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email: 'staff@example.com', password: 'wrongpass' }
  });

  assert.equal(result.status, 401);
  assert.equal(result.data.success, false);
});

test('doctor creation works', async () => {
  const result = await apiFetch('/api/doctors', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name: 'Dr. Smith',
      specialization: 'Cardiology',
      start_time: '09:00',
      end_time: '17:00',
      break_start: '12:00',
      break_end: '12:30',
      appointment_duration: 30,
      buffer_minutes: 15
    }
  });

  assert.equal(result.status, 201);
  doctorId = result.data.doctor.id;
  assert.ok(doctorId);
});

test('patient creation works', async () => {
  const result = await apiFetch('/api/patients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { name: 'John Doe', phone: '9876543210', email: 'john@example.com' }
  });

  assert.equal(result.status, 201);
  patientId = result.data.patient.id;
  assert.ok(patientId);
});

test('appointment creation works', async () => {
  const result = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      doctor_id: doctorId,
      patient_id: patientId,
      start_time: '2026-09-17T09:00:00',
      end_time: '2026-09-17T09:30:00'
    }
  });

  assert.equal(result.status, 201);
  appointmentId = result.data.appointment.id;
  assert.ok(appointmentId);
});

test('adjacent appointments are allowed when buffer permits', async () => {
  const patient2 = await apiFetch('/api/patients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { name: 'Jane Doe', phone: '9876543211', email: 'jane@example.com' }
  });

  const result = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      doctor_id: doctorId,
      patient_id: patient2.data.patient.id,
      start_time: '2026-09-17T09:45:00',
      end_time: '2026-09-17T10:15:00'
    }
  });

  assert.equal(result.status, 201);
});

test('overlapping appointments are rejected', async () => {
  const patient3 = await apiFetch('/api/patients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { name: 'Sam Lee', phone: '9876543212', email: 'sam@example.com' }
  });

  const result = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      doctor_id: doctorId,
      patient_id: patient3.data.patient.id,
      start_time: '2026-09-17T09:10:00',
      end_time: '2026-09-17T09:40:00'
    }
  });

  assert.equal(result.status, 409);
  assert.equal(result.data.code, 'SCHEDULE_CONFLICT');
});

test('surrounding appointments in different time windows are allowed', async () => {
  const patient4 = await apiFetch('/api/patients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { name: 'Chris Ray', phone: '9876543213', email: 'chris@example.com' }
  });

  const result = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      doctor_id: doctorId,
      patient_id: patient4.data.patient.id,
      start_time: '2026-09-17T10:30:00',
      end_time: '2026-09-17T11:00:00'
    }
  });

  assert.equal(result.status, 201);
});

test('different doctors can share the same time', async () => {
  const doctor2 = await apiFetch('/api/doctors', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      name: 'Dr. Brown',
      specialization: 'Neurology',
      start_time: '09:00',
      end_time: '17:00',
      break_start: '13:00',
      break_end: '13:30',
      appointment_duration: 30,
      buffer_minutes: 0
    }
  });

  const patient5 = await apiFetch('/api/patients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { name: 'Noah Reed', phone: '9876543214', email: 'noah@example.com' }
  });

  const result = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      doctor_id: doctor2.data.doctor.id,
      patient_id: patient5.data.patient.id,
      start_time: '2026-09-17T09:00:00',
      end_time: '2026-09-17T09:30:00'
    }
  });

  assert.equal(result.status, 201);
});

test('cancelled appointment does not block slot', async () => {
  const patient6 = await apiFetch('/api/patients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { name: 'Ella West', phone: '9876543215', email: 'ella@example.com' }
  });

  const create = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      doctor_id: doctorId,
      patient_id: patient6.data.patient.id,
      start_time: '2026-09-18T10:00:00',
      end_time: '2026-09-18T10:30:00'
    }
  });

  const cancel = await apiFetch(`/api/appointments/${create.data.appointment.id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { reason: 'Patient rescheduled' }
  });

  const slot = await apiFetch(`/api/doctors/${doctorId}/available-slots?date=2026-09-18`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(cancel.status, 200);
  assert.equal(slot.status, 200);
  assert.ok(slot.data.slots.includes('10:00'));
});

test('break restriction is enforced', async () => {
  const patient7 = await apiFetch('/api/patients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { name: 'Luke Hart', phone: '9876543216', email: 'luke@example.com' }
  });

  const result = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      doctor_id: doctorId,
      patient_id: patient7.data.patient.id,
      start_time: '2026-09-18T12:15:00',
      end_time: '2026-09-18T12:45:00'
    }
  });

  assert.equal(result.status, 409);
  assert.equal(result.data.code, 'SCHEDULE_CONFLICT');
});

test('working-hours restriction is enforced', async () => {
  const patient8 = await apiFetch('/api/patients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { name: 'Mia Lee', phone: '9876543217', email: 'mia@example.com' }
  });

  const result = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      doctor_id: doctorId,
      patient_id: patient8.data.patient.id,
      start_time: '2026-09-18T08:00:00',
      end_time: '2026-09-18T08:30:00'
    }
  });

  assert.equal(result.status, 400);
  assert.equal(result.data.code, 'VALIDATION_ERROR');
});

test('buffer restriction is enforced', async () => {
  const patient9 = await apiFetch('/api/patients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { name: 'Noel Price', phone: '9876543218', email: 'noel@example.com' }
  });

  const result = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      doctor_id: doctorId,
      patient_id: patient9.data.patient.id,
      start_time: '2026-09-17T09:40:00',
      end_time: '2026-09-17T10:10:00'
    }
  });

  assert.equal(result.status, 409);
});

test('early cancellation is free and late cancellation is ₹100', async () => {
  const patient10 = await apiFetch('/api/patients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { name: 'Ruby Moss', phone: '9876543219', email: 'ruby@example.com' }
  });

  const early = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      doctor_id: doctorId,
      patient_id: patient10.data.patient.id,
      start_time: '2026-09-19T15:00:00',
      end_time: '2026-09-19T15:30:00'
    }
  });

  const earlyCancel = await apiFetch(`/api/appointments/${early.data.appointment.id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { reason: 'Patient request' }
  });

  assert.equal(earlyCancel.status, 200);
  assert.equal(earlyCancel.data.fee, 0);

  const late = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      doctor_id: doctorId,
      patient_id: patient10.data.patient.id,
      start_time: '2026-09-20T16:00:00',
      end_time: '2026-09-20T16:30:00'
    }
  });

  const lateCancel = await apiFetch(`/api/appointments/${late.data.appointment.id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { reason: 'Late notice' }
  });

  assert.equal(lateCancel.status, 200);
  assert.equal(lateCancel.data.fee, 100);
});

test('rescheduling prevents conflicts', async () => {
  const patient11 = await apiFetch('/api/patients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { name: 'Olivia Price', phone: '9876543220', email: 'olivia@example.com' }
  });

  const appointment = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      doctor_id: doctorId,
      patient_id: patient11.data.patient.id,
      start_time: '2026-09-21T09:00:00',
      end_time: '2026-09-21T09:30:00'
    }
  });

  const result = await apiFetch(`/api/appointments/${appointment.data.appointment.id}/reschedule`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { new_start_time: '2026-09-17T09:00:00', new_end_time: '2026-09-17T09:30:00' }
  });

  assert.equal(result.status, 409);
  assert.equal(result.data.code, 'SCHEDULE_CONFLICT');
});

test('pagination and sorting work for appointments', async () => {
  const result = await apiFetch('/api/appointments?page=1&limit=2&sort=start_time&order=asc', {
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(result.status, 200);
  assert.equal(result.data.page, 1);
  assert.equal(result.data.limit, 2);
  assert.ok(Array.isArray(result.data.data));
  assert.ok(result.data.total >= 1);
});

test('patient search works by name or phone', async () => {
  const result = await apiFetch('/api/patients/search?q=John', {
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.data.results));
});
