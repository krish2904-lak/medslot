const express = require('express');
const authenticate = require('../middleware/authMiddleware');
const {
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
  getAvailability,
  triggerNotificationClock,
  getNotifications,
  triggerAutomationClock
} = require('../controllers/clinicController');

const router = express.Router();

router.get('/doctors', authenticate, listDoctors);
router.post('/doctors', authenticate, createDoctor);
router.get('/doctors/:id', authenticate, getDoctorById);
router.patch('/doctors/:id', authenticate, updateDoctor);
router.get('/doctors/:id/day', authenticate, getDoctorDayView);
router.get('/doctors/:id/available-slots', authenticate, getDoctorAvailableSlots);

router.get('/patients', authenticate, listPatients);
router.post('/patients', authenticate, createPatient);
router.get('/patients/search', authenticate, searchPatients);
router.get('/patients/:id', authenticate, getPatientById);

router.get('/appointments', authenticate, listAppointments);
router.get('/appointments/availability', authenticate, getAvailability);
router.post('/appointments', authenticate, createAppointment);
router.get('/appointments/:id', authenticate, getAppointmentById);
router.patch('/appointments/:id', authenticate, updateAppointment);
router.post('/appointments/:id/cancel', authenticate, cancelAppointment);
router.post('/appointments/:id/reschedule', authenticate, rescheduleAppointment);

router.get('/notifications', authenticate, getNotifications);
router.post('/notifications/clock', authenticate, triggerNotificationClock);
router.post('/automation/clock', authenticate, triggerAutomationClock);

module.exports = router;
