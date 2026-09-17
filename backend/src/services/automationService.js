const db = require('../database/db');

function triggerNoShowAutomation() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 60 * 1000);

  const rows = db.prepare(`
    SELECT a.*, p.name AS patient_name, d.name AS doctor_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    WHERE a.status NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED')
      AND a.start_time <= ?
    ORDER BY a.start_time ASC
  `).all(cutoff.toISOString());

  const changed = [];

  for (const appointment of rows) {
    const result = db.prepare(`
      UPDATE appointments
      SET status = 'NO_SHOW'
      WHERE id = ? AND status NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED')
    `).run(appointment.id);

    if (result.changes > 0) {
      changed.push({
        id: appointment.id,
        patient_name: appointment.patient_name,
        doctor_name: appointment.doctor_name,
        start_time: appointment.start_time,
        status: 'NO_SHOW'
      });
    }
  }

  return {
    success: true,
    processed: rows.length,
    changed: changed.map((item) => ({ id: item.id, status: item.status, patient_name: item.patient_name, doctor_name: item.doctor_name, start_time: item.start_time }))
  };
}

module.exports = {
  triggerNoShowAutomation
};
