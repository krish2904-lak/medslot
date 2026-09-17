function toMinutes(timeString) {
  if (!timeString) return 0;
  if (typeof timeString === 'number') return timeString;

  const [hours, minutes] = String(timeString).split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(totalMinutes) {
  const safeMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function overlaps(startA, endA, startB, endB) {
  const firstStart = startA instanceof Date ? startA.getTime() : new Date(startA).getTime();
  const firstEnd = endA instanceof Date ? endA.getTime() : new Date(endA).getTime();
  const secondStart = startB instanceof Date ? startB.getTime() : new Date(startB).getTime();
  const secondEnd = endB instanceof Date ? endB.getTime() : new Date(endB).getTime();

  if (Number.isNaN(firstStart) || Number.isNaN(firstEnd) || Number.isNaN(secondStart) || Number.isNaN(secondEnd)) {
    const aStart = toMinutes(startA);
    const aEnd = toMinutes(endA);
    const bStart = toMinutes(startB);
    const bEnd = toMinutes(endB);
    return aStart < bEnd && aEnd > bStart;
  }

  return firstStart < secondEnd && firstEnd > secondStart;
}

function generateSlots(startTime, endTime, durationMinutes, breakStart, breakEnd) {
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  const breakStartMinutes = breakStart ? toMinutes(breakStart) : null;
  const breakEndMinutes = breakEnd ? toMinutes(breakEnd) : null;

  const slots = [];

  for (let slotMinutes = startMinutes; slotMinutes <= endMinutes; slotMinutes += durationMinutes) {
    const slotEndMinutes = slotMinutes + durationMinutes;

    const isInsideBreak =
      breakStartMinutes !== null &&
      breakEndMinutes !== null &&
      slotMinutes < breakEndMinutes &&
      slotEndMinutes > breakStartMinutes;

    if (slotMinutes >= endMinutes) {
      if (slotMinutes === endMinutes && slotEndMinutes > endMinutes) {
        slots.push(formatTime(slotMinutes));
      }
      continue;
    }

    if (isInsideBreak) continue;

    slots.push(formatTime(slotMinutes));
  }

  return slots;
}

function getAvailableSlots(doctor, appointments = [], dateString) {
  const normalizedDate = dateString || new Date().toISOString().slice(0, 10);
  const doctorStart = toMinutes(doctor.start_time);
  const doctorEnd = toMinutes(doctor.end_time);
  const appointmentLength = Number(doctor.appointment_duration || 30);

  const baseSlots = generateSlots(
    doctor.start_time,
    doctor.end_time,
    appointmentLength,
    doctor.break_start,
    doctor.break_end
  );

  return baseSlots.filter((slot) => {
    const slotMinutes = toMinutes(slot);
    const slotEndMinutes = slotMinutes + appointmentLength;

    if (slotMinutes < doctorStart || slotMinutes >= doctorEnd || slotEndMinutes > doctorEnd) {
      return false;
    }

    return !(appointments || []).some((appointment) => {
      if (!appointment || appointment.status === 'CANCELLED') return false;
      const appointmentStart = new Date(appointment.start_time);
      const appointmentEnd = new Date(appointment.end_time);
      const slotStart = new Date(`${normalizedDate}T${slot}:00`);
      const slotEnd = new Date(slotStart.getTime() + (appointmentLength * 60000));
      return overlaps(slotStart, slotEnd, appointmentStart, appointmentEnd);
    });
  });
}

function isAppointmentConflict(newStart, newEnd, existingAppointments = []) {
  const nextStart = new Date(newStart).getTime();
  const nextEnd = new Date(newEnd).getTime();

  return existingAppointments.some((appointment) => {
    if (!appointment || appointment.status === 'CANCELLED') return false;
    const appointmentStart = new Date(appointment.start_time).getTime();
    const appointmentEnd = new Date(appointment.end_time).getTime();
    return nextStart < appointmentEnd && nextEnd > appointmentStart;
  });
}

module.exports = {
  toMinutes,
  formatTime,
  overlaps,
  generateSlots,
  getAvailableSlots,
  isAppointmentConflict
};
