const db = require('../database/db');

function getCancellationPolicy() {
  return db.prepare('SELECT * FROM cancellation_policies ORDER BY id DESC LIMIT 1').get() || {
    id: 1,
    free_cancellation_hours: 4,
    late_cancellation_fee: 100
  };
}

function calculateCancellationFee(appointmentStartTime, cancellationTimeOverride, policy = getCancellationPolicy()) {
  const appointmentStart = new Date(appointmentStartTime);
  const cancellationTime = new Date(cancellationTimeOverride || new Date());
  const freeWindowMs = Number(policy.free_cancellation_hours || 4) * 60 * 60 * 1000;
  const cutoffTime = new Date(appointmentStart.getTime() - freeWindowMs);

  if (Number.isNaN(appointmentStart.getTime()) || Number.isNaN(cancellationTime.getTime())) {
    return Number(policy.late_cancellation_fee || 100);
  }

  return cancellationTime < cutoffTime ? 0 : Number(policy.late_cancellation_fee || 100);
}

module.exports = {
  getCancellationPolicy,
  calculateCancellationFee
};
