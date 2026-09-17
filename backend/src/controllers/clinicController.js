const db = require('../database/db');
const { getAvailableSlots, isAppointmentConflict } = require('../services/schedulingEngine');

function normalizeDoctorInput(payload = {}) {
  return {
    name: String(payload.name || '').trim(),
    specialization: String(payload.specialization || '').trim(),
    start_time: payload.start_time || '09:00',
    end_time: payload.end_time || '17:00',
    break_start: payload.break_start || null,
    break_end: payload.break_end || null,
    appointment_duration: Number(payload.appointment_duration || 30),
    buffer_minutes: Number(payload.buffer_minutes || 0)
  };
}

function parseDateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalIsoDate(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function buildAppointmentQuery(filterByDoctorId = null, filterByPatientId = null, dateOnly = null) {
  let query = `
    SELECT a.*, d.name AS doctor_name, p.name AS patient_name
    FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    JOIN patients p ON p.id = a.patient_id
  `;
  const params = [];
  const clauses = [];

  if (filterByDoctorId) {
    clauses.push('a.doctor_id = ?');
    params.push(Number(filterByDoctorId));
  }

  if (filterByPatientId) {
    clauses.push('a.patient_id = ?');
    params.push(Number(filterByPatientId));
  }

  if (dateOnly) {
    clauses.push('date(a.start_time) = ?');
    params.push(dateOnly);
  }

  if (clauses.length) {
    query += ` WHERE ${clauses.join(' AND ')}`;
  }

  return { query, params };
}

function getDoctorById(req, res) {
  try {
    const { id } = req.params;
    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(Number(id));

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    return res.json({ success: true, doctor });
  } catch (error) {
    console.error('Get doctor error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch doctor' });
  }
}

function updateDoctor(req, res) {
  try {
    const { id } = req.params;
    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(Number(id));

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const updates = normalizeDoctorInput({ ...doctor, ...req.body });
    const result = db.prepare(`
      UPDATE doctors
      SET name = ?, specialization = ?, start_time = ?, end_time = ?, break_start = ?, break_end = ?, appointment_duration = ?, buffer_minutes = ?
      WHERE id = ?
    `).run(
      updates.name,
      updates.specialization,
      updates.start_time,
      updates.end_time,
      updates.break_start,
      updates.break_end,
      Number(updates.appointment_duration),
      Number(updates.buffer_minutes),
      Number(id)
    );

    if (result.changes === 0) {
      return res.status(400).json({ success: false, message: 'Unable to update doctor' });
    }

    const updatedDoctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(Number(id));
    return res.json({ success: true, message: 'Doctor updated', doctor: updatedDoctor });
  } catch (error) {
    console.error('Update doctor error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update doctor' });
  }
}

function listDoctors(req, res) {
  try {
    const doctors = db.prepare('SELECT * FROM doctors ORDER BY name ASC').all();
    return res.json({ success: true, doctors });
  } catch (error) {
    console.error('List doctors error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load doctors' });
  }
}

function createDoctor(req, res) {
  try {
    const doctor = normalizeDoctorInput(req.body);

    if (!doctor.name) {
      return res.status(400).json({ success: false, message: 'Doctor name is required' });
    }

    const result = db.prepare(`
      INSERT INTO doctors (
        name, specialization, start_time, end_time, break_start, break_end,
        appointment_duration, buffer_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      doctor.name,
      doctor.specialization || '',
      doctor.start_time,
      doctor.end_time,
      doctor.break_start,
      doctor.break_end,
      doctor.appointment_duration,
      doctor.buffer_minutes
    );

    const createdDoctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ success: true, message: 'Doctor created', doctor: createdDoctor });
  } catch (error) {
    console.error('Create doctor error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create doctor' });
  }
}

function getDoctorDayView(req, res) {
  try {
    const { id } = req.params;
    const { date } = req.query;
    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(Number(id));

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const targetDate = date || new Date().toISOString().slice(0, 10);
    const appointments = db.prepare(`
      SELECT a.*, p.name AS patient_name
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      WHERE a.doctor_id = ? AND date(a.start_time) = ?
      ORDER BY a.start_time ASC
    `).all(Number(id), targetDate);

    return res.json({ success: true, doctor, date: targetDate, appointments });
  } catch (error) {
    console.error('Get doctor day view error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch doctor day view' });
  }
}

function getDoctorAvailableSlots(req, res) {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Date is required' });
    }

    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(Number(id));
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const appointments = db.prepare(`
      SELECT * FROM appointments
      WHERE doctor_id = ? AND date(start_time) = ? AND status != 'CANCELLED'
      ORDER BY start_time ASC
    `).all(Number(id), date);

    const slots = getAvailableSlots(doctor, appointments, date);
    return res.json({ success: true, doctor, date, slots });
  } catch (error) {
    console.error('Get doctor slots error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch available slots' });
  }
}

function listPatients(req, res) {
  try {
    const patients = db.prepare('SELECT * FROM patients ORDER BY created_at DESC').all();
    return res.json({ success: true, patients });
  } catch (error) {
    console.error('List patients error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load patients' });
  }
}

function createPatient(req, res) {
  try {
    const { name, phone, email } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    const result = db.prepare(`
      INSERT INTO patients (name, phone, email)
      VALUES (?, ?, ?)
    `).run(String(name).trim(), String(phone).trim(), email ? String(email).trim() : null);

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ success: true, message: 'Patient created', patient });
  } catch (error) {
    console.error('Create patient error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create patient' });
  }
}

function getPatientById(req, res) {
  try {
    const { id } = req.params;
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(Number(id));

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    return res.json({ success: true, patient });
  } catch (error) {
    console.error('Get patient error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch patient' });
  }
}

function searchPatients(req, res) {
  try {
    const q = String(req.query.q || '').trim();

    if (!q) {
      return res.json({ success: true, query: q, results: [] });
    }

    const patients = db.prepare(`
      SELECT * FROM patients
      WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?
      ORDER BY created_at DESC LIMIT 25
    `).all(`%${q}%`, `%${q}%`, `%${q}%`);

    return res.json({ success: true, query: q, results: patients });
  } catch (error) {
    console.error('Search patients error:', error);
    return res.status(500).json({ success: false, message: 'Failed to search patients' });
  }
}

function listAppointments(req, res) {
  try {
    const { date, doctorId, patientId, page = 1, limit = 20, sort = 'start_time', order = 'asc' } = req.query;
    const pageNumber = Number(page) > 0 ? Number(page) : 1;
    const limitNumber = Number(limit) > 0 ? Number(limit) : 20;
    const sortField = ['start_time', 'end_time', 'created_at', 'doctor_id', 'patient_id', 'status'].includes(sort) ? sort : 'start_time';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const baseQuery = buildAppointmentQuery(doctorId || null, patientId || null, date || null);
    const totalQuery = `SELECT COUNT(*) AS total FROM (${baseQuery.query})`;
    const totalResult = db.prepare(totalQuery).get(...baseQuery.params);
    const total = Number(totalResult?.total || 0);

    const orderQuery = `${baseQuery.query} ORDER BY a.${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
    const offset = (pageNumber - 1) * limitNumber;
    const appointments = db.prepare(orderQuery).all(...[...baseQuery.params, limitNumber, offset]);

    return res.json({ success: true, page: pageNumber, limit: limitNumber, total, data: appointments });
  } catch (error) {
    console.error('List appointments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load appointments' });
  }
}

function getAppointmentById(req, res) {
  try {
    const { id } = req.params;
    const appointment = db.prepare(`
      SELECT a.*, d.name AS doctor_name, p.name AS patient_name
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      JOIN patients p ON p.id = a.patient_id
      WHERE a.id = ?
    `).get(Number(id));

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    return res.json({ success: true, appointment });
  } catch (error) {
    console.error('Get appointment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch appointment' });
  }
}

function validateAppointmentWindow(doctor, startDate, endDate) {
  if (!doctor) {
    return { valid: false, code: 'VALIDATION_ERROR', message: 'Doctor not found' };
  }

  const startMinutes = new Date(startDate).getHours() * 60 + new Date(startDate).getMinutes();
  const endMinutes = new Date(endDate).getHours() * 60 + new Date(endDate).getMinutes();
  const doctorStart = Number(String(doctor.start_time || '09:00').split(':')[0]) * 60 + Number(String(doctor.start_time || '09:00').split(':')[1]);
  const doctorEnd = Number(String(doctor.end_time || '17:00').split(':')[0]) * 60 + Number(String(doctor.end_time || '17:00').split(':')[1]);

  if (startMinutes < doctorStart || endMinutes > doctorEnd || endMinutes <= startMinutes) {
    return { valid: false, code: 'VALIDATION_ERROR', message: 'Appointment must be within the doctor\'s working hours' };
  }

  if (doctor.break_start && doctor.break_end) {
    const breakStart = Number(String(doctor.break_start).split(':')[0]) * 60 + Number(String(doctor.break_start).split(':')[1]);
    const breakEnd = Number(String(doctor.break_end).split(':')[0]) * 60 + Number(String(doctor.break_end).split(':')[1]);
    if (startMinutes < breakEnd && endMinutes > breakStart) {
      return { valid: false, code: 'SCHEDULE_CONFLICT', message: 'Appointment overlaps with doctor break' };
    }
  }

  return { valid: true };
}

function findDoctorConflict(doctor, startDate, endDate, excludedAppointmentId = null) {
  if (!doctor) return false;

  const bufferMs = Number(doctor.buffer_minutes || 0) * 60 * 1000;
  const appointments = db.prepare(`
    SELECT * FROM appointments
    WHERE doctor_id = ? AND status != 'CANCELLED'
    ORDER BY start_time ASC
  `).all(Number(doctor.id));

  return appointments.some((appointment) => {
    if (excludedAppointmentId && Number(appointment.id) === Number(excludedAppointmentId)) {
      return false;
    }

    const existingStart = new Date(appointment.start_time).getTime();
    const existingEnd = new Date(appointment.end_time).getTime();
    return new Date(startDate).getTime() < (existingEnd + bufferMs) && new Date(endDate).getTime() > (existingStart - bufferMs);
  });
}

function getAvailability(req, res) {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !date) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'doctorId and date are required' });
    }

    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(Number(doctorId));
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    const appointments = db.prepare(`
      SELECT * FROM appointments
      WHERE doctor_id = ? AND date(start_time) = ? AND status != 'CANCELLED'
      ORDER BY start_time ASC
    `).all(Number(doctorId), String(date));

    const slots = getAvailableSlots(doctor, appointments, String(date));
    return res.json({ success: true, doctor, date: String(date), slots });
  } catch (error) {
    console.error('Get availability error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch availability' });
  }
}

function createAppointment(req, res) {
  try {
    const payload = req.body || {};
    const doctorId = Number(payload.doctor_id ?? payload.doctorId);
    const patientId = Number(payload.patient_id ?? payload.patientId);
    const startTime = payload.start_time || payload.startTime;
    const endTime = payload.end_time || payload.endTime;

    if (!doctorId || !patientId || !startTime || !endTime) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Doctor, patient, start time and end time are required' });
    }

    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId);

    if (!doctor || !patient) {
      return res.status(404).json({ success: false, message: 'Doctor or patient not found' });
    }

    const startDate = parseDateValue(startTime);
    const endDate = parseDateValue(endTime);

    if (!startDate || !endDate || endDate <= startDate) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Start and end times must be valid and end later than start' });
    }

    const checkWindow = validateAppointmentWindow(doctor, startDate, endDate);
    if (!checkWindow.valid) {
      return res.status(checkWindow.code === 'SCHEDULE_CONFLICT' ? 409 : 400).json({ success: false, code: checkWindow.code, message: checkWindow.message });
    }

    const hasConflict = findDoctorConflict(doctor, startDate, endDate);
    if (hasConflict) {
      return res.status(409).json({ success: false, code: 'SCHEDULE_CONFLICT', message: 'Selected time conflicts with an existing appointment or buffer requirement' });
    }

    const result = db.prepare(`
      INSERT INTO appointments (doctor_id, patient_id, start_time, end_time)
      VALUES (?, ?, ?, ?)
    `).run(
      doctorId,
      patientId,
      toLocalIsoDate(startDate),
      toLocalIsoDate(endDate)
    );

    const appointment = db.prepare(`
      SELECT a.*, d.name AS doctor_name, p.name AS patient_name
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      JOIN patients p ON p.id = a.patient_id
      WHERE a.id = ?
    `).get(result.lastInsertRowid);

    return res.status(201).json({ success: true, message: 'Appointment booked', appointment });
  } catch (error) {
    console.error('Create appointment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to book appointment' });
  }
}

function updateAppointment(req, res) {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(Number(id));

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const updateFields = { status: payload.status || appointment.status };
    if (payload.start_time) updateFields.start_time = payload.start_time;
    if (payload.end_time) updateFields.end_time = payload.end_time;
    if (payload.cancellation_reason !== undefined) updateFields.cancellation_reason = payload.cancellation_reason;
    if (payload.cancellation_fee !== undefined) updateFields.cancellation_fee = Number(payload.cancellation_fee || 0);

    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(Number(appointment.doctor_id));
    const startValue = updateFields.start_time ? new Date(updateFields.start_time) : new Date(appointment.start_time);
    const endValue = updateFields.end_time ? new Date(updateFields.end_time) : new Date(appointment.end_time);

    if (doctor && updateFields.start_time && updateFields.end_time) {
      const windowCheck = validateAppointmentWindow(doctor, startValue, endValue);
      if (!windowCheck.valid) {
        return res.status(windowCheck.code === 'SCHEDULE_CONFLICT' ? 409 : 400).json({ success: false, code: windowCheck.code, message: windowCheck.message });
      }

      const startConflict = findDoctorConflict(doctor, startValue, endValue, Number(id));
      if (startConflict) {
        return res.status(409).json({ success: false, code: 'SCHEDULE_CONFLICT', message: 'Updated time conflicts with another appointment' });
      }
    }

    const result = db.prepare(`
      UPDATE appointments
      SET status = ?, start_time = COALESCE(?, start_time), end_time = COALESCE(?, end_time), cancellation_reason = ?, cancellation_fee = ?
      WHERE id = ?
    `).run(
      updateFields.status,
      updateFields.start_time || null,
      updateFields.end_time || null,
      updateFields.cancellation_reason !== undefined ? updateFields.cancellation_reason : appointment.cancellation_reason,
      Number(updateFields.cancellation_fee !== undefined ? updateFields.cancellation_fee : appointment.cancellation_fee),
      Number(id)
    );

    if (result.changes === 0) {
      return res.status(400).json({ success: false, message: 'Unable to update appointment' });
    }

    const updatedAppointment = db.prepare(`
      SELECT a.*, d.name AS doctor_name, p.name AS patient_name
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      JOIN patients p ON p.id = a.patient_id
      WHERE a.id = ?
    `).get(Number(id));

    return res.json({ success: true, message: 'Appointment updated', appointment: updatedAppointment });
  } catch (error) {
    console.error('Update appointment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update appointment' });
  }
}

function cancelAppointment(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(Number(id));

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const policy = db.prepare('SELECT * FROM cancellation_policies ORDER BY id DESC LIMIT 1').get();
    const freeHours = Number(policy?.free_cancellation_hours || 4);
    const lateFee = Number(policy?.late_cancellation_fee || 100);
    const startDate = new Date(appointment.start_time);
    const differenceHours = (startDate.getTime() - Date.now()) / (1000 * 60 * 60);
    const normalizedReason = String(reason || '').trim().toLowerCase();
    const fee = differenceHours < freeHours || normalizedReason.includes('late') ? lateFee : 0;

    const updated = db.prepare(`
      UPDATE appointments
      SET status = 'CANCELLED', cancellation_time = ?, cancellation_reason = ?, cancellation_fee = ?
      WHERE id = ?
    `).run(new Date().toISOString(), reason || 'Cancelled by staff', fee, Number(id));

    if (updated.changes === 0) {
      return res.status(400).json({ success: false, message: 'Unable to cancel appointment' });
    }

    const cancelledAppointment = db.prepare(`
      SELECT a.*, d.name AS doctor_name, p.name AS patient_name
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      JOIN patients p ON p.id = a.patient_id
      WHERE a.id = ?
    `).get(Number(id));

    return res.json({ success: true, message: 'Appointment cancelled', appointment: cancelledAppointment, fee });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel appointment' });
  }
}

function rescheduleAppointment(req, res) {
  try {
    const { id } = req.params;
    const { new_start_time, new_end_time } = req.body || {};
    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(Number(id));

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (!new_start_time || !new_end_time) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'New start and end times are required' });
    }

    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(Number(appointment.doctor_id));
    const startDate = parseDateValue(new_start_time);
    const endDate = parseDateValue(new_end_time);

    if (!startDate || !endDate || endDate <= startDate) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'New times must be valid and end later than start' });
    }

    const windowCheck = validateAppointmentWindow(doctor, startDate, endDate);
    if (!windowCheck.valid) {
      return res.status(windowCheck.code === 'SCHEDULE_CONFLICT' ? 409 : 400).json({ success: false, code: windowCheck.code, message: windowCheck.message });
    }

    const hasConflict = findDoctorConflict(doctor, startDate, endDate, Number(id));
    if (hasConflict) {
      return res.status(409).json({ success: false, code: 'SCHEDULE_CONFLICT', message: 'Rescheduled time conflicts with an existing appointment' });
    }

    const result = db.prepare(`
      UPDATE appointments
      SET start_time = ?, end_time = ?
      WHERE id = ?
    `).run(toLocalIsoDate(startDate), toLocalIsoDate(endDate), Number(id));

    if (result.changes === 0) {
      return res.status(400).json({ success: false, message: 'Unable to reschedule appointment' });
    }

    const refreshed = db.prepare(`
      SELECT a.*, d.name AS doctor_name, p.name AS patient_name
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      JOIN patients p ON p.id = a.patient_id
      WHERE a.id = ?
    `).get(Number(id));

    return res.json({ success: true, message: 'Appointment rescheduled', appointment: refreshed });
  } catch (error) {
    console.error('Reschedule appointment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reschedule appointment' });
  }
}

module.exports = {
  listDoctors,
  createDoctor,
  getDoctorById,
  updateDoctor,
  getDoctorDayView,
  getDoctorAvailableSlots,
  listPatients,
  createPatient,
  getPatientById,
  searchPatients,
  listAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getAvailability
};
