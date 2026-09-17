const db = require('../database/db');

function formatAppointmentTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildReminderMessage(appointment) {
  return `Reminder: ${appointment.patient_name} has an appointment with ${appointment.doctor_name} at ${formatAppointmentTime(appointment.start_time)}.`;
}

function triggerMorningNotifications() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  const appointments = db.prepare(`
    SELECT a.*, p.name AS patient_name, d.name AS doctor_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    WHERE a.status NOT IN ('CANCELLED', 'NO_SHOW')
      AND a.start_time >= ?
      AND a.start_time <= ?
    ORDER BY a.start_time ASC
  `).all(startOfDay.toISOString(), endOfDay.toISOString());

  const notifications = [];

  for (const appointment of appointments) {
    const sentDate = new Date(appointment.start_time).toISOString().slice(0, 10);
    const existing = db.prepare(`
      SELECT id FROM notifications
      WHERE appointment_id = ? AND notification_type = 'morning_reminder' AND sent_date = ?
    `).get(appointment.id, sentDate);

    if (existing) {
      continue;
    }

    const payload = {
      patient_name: appointment.patient_name,
      doctor_name: appointment.doctor_name,
      appointment_time: appointment.start_time,
      appointment_id: appointment.id
    };

    const job = db.prepare(`
      INSERT INTO notifications (appointment_id, notification_type, sent_date, title, message, payload_json)
      VALUES (?, 'morning_reminder', ?, 'Appointment reminder', ?, ?)
    `).run(
      appointment.id,
      sentDate,
      buildReminderMessage(appointment),
      JSON.stringify(payload)
    );

    notifications.push({
      id: job.lastInsertRowid,
      appointment_id: appointment.id,
      doctor_name: appointment.doctor_name,
      patient_name: appointment.patient_name,
      appointment_time: appointment.start_time,
      message: buildReminderMessage(appointment),
      sent_date: sentDate,
      notification_type: 'morning_reminder'
    });
  }

  return {
    success: true,
    generated: notifications.length,
    notifications
  };
}

function listNotifications(limit = 25) {
  const rows = db.prepare(`
    SELECT n.*, a.start_time, a.end_time, p.name AS patient_name, d.name AS doctor_name
    FROM notifications n
    LEFT JOIN appointments a ON a.id = n.appointment_id
    LEFT JOIN patients p ON p.id = a.patient_id
    LEFT JOIN doctors d ON d.id = a.doctor_id
    ORDER BY n.created_at DESC
    LIMIT ?
  `).all(limit);

  return {
    success: true,
    count: rows.length,
    notifications: rows.map((row) => ({
      ...row,
      payload: row.payload_json ? JSON.parse(row.payload_json) : null
    }))
  };
}

module.exports = {
  triggerMorningNotifications,
  listNotifications
};
