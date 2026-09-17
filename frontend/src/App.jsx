import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'medslot-demo-auth'
const todayIso = new Date().toISOString().slice(0, 10)

function formatDate(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isoSlot(date, time) {
  return `${date}T${time}:00`
}

function getClockMinutes(value) {
  if (!value) return 0
  const [hours, minutes] = String(value).split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

function toTimeString(totalMinutes) {
  const safe = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60)
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function normalizeAppointmentData(appointment, doctors, patients) {
  if (!appointment) return null

  const doctorName = appointment.doctor_name || doctors.find((doctor) => String(doctor.id) === String(appointment.doctor_id))?.name || 'Unknown doctor'
  const patientName = appointment.patient_name || patients.find((patient) => String(patient.id) === String(appointment.patient_id))?.name || 'Unknown patient'

  return {
    ...appointment,
    doctor_name: doctorName,
    patient_name: patientName,
  }
}

function App() {
  const [auth, setAuth] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [activeView, setActiveView] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [appointments, setAppointments] = useState([])
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [slots, setSlots] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loginForm, setLoginForm] = useState({
    email: 'staff@example.com',
    password: 'secret123',
  })
  const [bookingForm, setBookingForm] = useState({
    doctorId: '',
    patientId: '',
    date: todayIso,
    startTime: '09:00',
    endTime: '09:30',
  })
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleForm, setRescheduleForm] = useState({
    date: todayIso,
    startTime: '09:00',
    endTime: '09:30',
  })
  const [rescheduleAlert, setRescheduleAlert] = useState('')
  const [notificationResult, setNotificationResult] = useState(null)
  const [automationResult, setAutomationResult] = useState(null)

  const token = auth?.token

  const request = async (path, options = {}, authToken = token) => {
    const isApiPath = typeof path === 'string' && path.startsWith('/api')
    const requestUrl = isApiPath ? `http://localhost:5000${path}` : path

    const response = await fetch(requestUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()
    const data = text && contentType.includes('application/json') ? JSON.parse(text) : {}

    if (!response.ok) {
      const fallbackMessage = text && !contentType.includes('application/json') ? text.slice(0, 200) : data?.message
      throw new Error(fallbackMessage || 'Request failed')
    }

    if (text && !contentType.includes('application/json')) {
      throw new Error('Expected JSON response from backend but received an HTML page.')
    }

    return data
  }

  const showToast = (text) => {
    setMessage(text)
    window.clearTimeout(showToast.timeout)
    showToast.timeout = window.setTimeout(() => setMessage(''), 3500)
  }

  const refreshDashboard = async (authToken = token) => {
    if (!authToken) return

    try {
      const dateParam = bookingForm.date || todayIso
      const [doctorData, patientData, appointmentData] = await Promise.all([
        request('/api/doctors', {}, authToken),
        request('/api/patients', {}, authToken),
        request(`/api/appointments?limit=200&sort=start_time&order=asc`, {}, authToken),
      ])

      const nextDoctors = doctorData.doctors || []
      const nextPatients = patientData.patients || []
      const nextAppointments = appointmentData.data || []

      setDoctors(nextDoctors)
      setPatients(nextPatients)
      setAppointments(nextAppointments)

      const activeDoctorId = selectedDoctorId || (nextDoctors[0]?.id ? String(nextDoctors[0].id) : '')
      if (activeDoctorId) {
        const slotData = await request(`/api/doctors/${activeDoctorId}/available-slots?date=${dateParam}`, {}, authToken)
        setSlots(slotData.slots || [])
      }
    } catch (error) {
      showToast(error.message)
    }
  }

  useEffect(() => {
    if (auth?.token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
      refreshDashboard()
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [auth, token])

  useEffect(() => {
    if (!token || !selectedDoctorId) return

    const loadAvailability = async () => {
      try {
        const slotData = await request(`/api/doctors/${selectedDoctorId}/available-slots?date=${bookingForm.date || todayIso}`)
        setSlots(slotData.slots || [])
      } catch {
        setSlots([])
      }
    }

    loadAvailability()
  }, [token, selectedDoctorId, bookingForm.date])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }

    const runSearch = async () => {
      try {
        const result = await request(`/api/patients/search?q=${encodeURIComponent(searchTerm)}`)
        setSearchResults(result.results || [])
      } catch {
        setSearchResults([])
      }
    }

    runSearch()
  }, [searchTerm, token])

  const login = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      let result
      try {
        result = await request('/api/auth/login', {
          method: 'POST',
          body: { email: loginForm.email, password: loginForm.password },
        })
      } catch (loginError) {
        if (!/invalid|not found|email/i.test(loginError.message)) {
          throw loginError
        }

        await request('/api/auth/register', {
          method: 'POST',
          body: {
            name: 'Clinic Staff',
            email: loginForm.email,
            password: loginForm.password,
          },
        })

        result = await request('/api/auth/login', {
          method: 'POST',
          body: { email: loginForm.email, password: loginForm.password },
        })
      }

      const nextAuth = { token: result.token, user: result.user }
      setAuth(nextAuth)
      showToast(`Welcome back, ${result.user?.name || 'Clinic Staff'}!`)
      await refreshDashboard(result.token)
    } catch (error) {
      showToast(error.message)
    } finally {
      setLoading(false)
    }
  }

  const createAppointment = async (event) => {
    event.preventDefault()
    setLoading(true)

    try {
      const payload = {
        doctor_id: Number(bookingForm.doctorId),
        patient_id: Number(bookingForm.patientId),
        start_time: isoSlot(bookingForm.date, bookingForm.startTime),
        end_time: isoSlot(bookingForm.date, bookingForm.endTime),
      }

      const response = await request('/api/appointments', {
        method: 'POST',
        body: payload,
      })

      setSelectedAppointment(response.appointment)
      showToast(`✓ Appointment booked for ${response.appointment.patient_name}.`)
      await refreshDashboard()
      setBookingForm((current) => ({ ...current, startTime: '09:00', endTime: '09:30' }))
    } catch (error) {
      showToast(error.message || 'Scheduling conflict.')
    } finally {
      setLoading(false)
    }
  }

  const cancelAppointment = async (appointmentId) => {
    try {
      const response = await request(`/api/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        body: { reason: 'Patient requested cancellation' },
      })

      showToast(`Cancelled appointment. Fee: ₹${response.fee || 0}`)
      await refreshDashboard()
    } catch (error) {
      showToast(error.message)
    }
  }

  const seedDemoData = async () => {
    if (!token) return

    setLoading(true)
    try {
      const doctorList = (await request('/api/doctors', {}, token)).doctors || []
      if (!doctorList.length) {
        const doctorSeeds = [
          { name: 'Dr. Ananya Sharma', specialization: 'General Medicine', start_time: '09:00', end_time: '17:00', break_start: '12:00', break_end: '12:30', appointment_duration: 30, buffer_minutes: 15 },
          { name: 'Dr. Raj Mehta', specialization: 'Cardiology', start_time: '09:00', end_time: '17:00', break_start: '12:00', break_end: '12:30', appointment_duration: 30, buffer_minutes: 15 },
          { name: 'Dr. Neha Kapoor', specialization: 'Dermatology', start_time: '10:00', end_time: '18:00', break_start: '14:00', break_end: '14:30', appointment_duration: 30, buffer_minutes: 10 },
        ]

        const createdDoctors = []
        for (const doctor of doctorSeeds) {
          const result = await request('/api/doctors', { method: 'POST', body: doctor }, token)
          createdDoctors.push(result.doctor)
        }

        const patientSeeds = [
          { name: 'Rahul Verma', phone: '9000000001', email: 'rahul@example.com' },
          { name: 'Priya Sharma', phone: '9000000002', email: 'priya@example.com' },
          { name: 'Amit Singh', phone: '9000000003', email: 'amit@example.com' },
          { name: 'Neha Jain', phone: '9000000004', email: 'neha@example.com' },
          { name: 'Rohan Gupta', phone: '9000000005', email: 'rohan@example.com' },
        ]

        const createdPatients = []
        for (const patient of patientSeeds) {
          const result = await request('/api/patients', { method: 'POST', body: patient }, token)
          createdPatients.push(result.patient)
        }

        const appointmentSeeds = [
          { doctorId: createdDoctors[0].id, patientId: createdPatients[0].id, start: '09:00', end: '09:30' },
          { doctorId: createdDoctors[0].id, patientId: createdPatients[1].id, start: '09:30', end: '10:00' },
          { doctorId: createdDoctors[1].id, patientId: createdPatients[2].id, start: '10:00', end: '10:30' },
          { doctorId: createdDoctors[0].id, patientId: createdPatients[3].id, start: '11:00', end: '11:30' },
          { doctorId: createdDoctors[2].id, patientId: createdPatients[4].id, start: '13:00', end: '13:30' },
        ]

        for (const seed of appointmentSeeds) {
          await request('/api/appointments', {
            method: 'POST',
            body: {
              doctor_id: Number(seed.doctorId),
              patient_id: Number(seed.patientId),
              start_time: isoSlot(todayIso, seed.start),
              end_time: isoSlot(todayIso, seed.end),
            },
          }, token)
        }

        const cancelled = await request('/api/appointments', {
          method: 'POST',
          body: {
            doctor_id: Number(createdDoctors[0].id),
            patient_id: Number(createdPatients[0].id),
            start_time: isoSlot(todayIso, '11:30'),
            end_time: isoSlot(todayIso, '12:00'),
          },
        }, token)

        await request(`/api/appointments/${cancelled.appointment.id}/cancel`, {
          method: 'POST',
          body: { reason: 'Clinic schedule change' },
        }, token)

        setSelectedDoctorId(String(createdDoctors[0].id))
        setBookingForm((current) => ({
          ...current,
          doctorId: String(createdDoctors[0].id),
          patientId: String(createdPatients[0].id),
        }))
      }

      await refreshDashboard()
      showToast('Demo data loaded successfully.')
    } catch (error) {
      showToast(error.message)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const todayList = appointments.filter((appointment) => new Date(appointment.start_time).toISOString().slice(0, 10) === todayIso)
    const confirmed = appointments.filter((appointment) => appointment.status === 'CONFIRMED').length
    const cancelled = appointments.filter((appointment) => appointment.status === 'CANCELLED').length
    const noShow = appointments.filter((appointment) => appointment.status === 'NO_SHOW').length
    const completed = appointments.filter((appointment) => appointment.status === 'COMPLETED').length
    const unavailable = cancelled + noShow

    return {
      todayCount: todayList.length,
      confirmed,
      cancelled,
      noShow,
      completed,
      unavailable,
      slots: slots.length,
    }
  }, [appointments, slots])

  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date()),
    [],
  )

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '◫' },
    { id: 'appointments', label: 'Appointments', icon: '📅' },
    { id: 'doctors', label: 'Doctors', icon: '🩺' },
    { id: 'patients', label: 'Patients', icon: '👥' },
    { id: 'doctor-day', label: 'Doctor Day', icon: '🕘' },
    { id: 'slot-rescue', label: 'Slot Rescue', icon: '⚡' },
    { id: 'automations', label: 'Automations', icon: '⚙' },
    { id: 'settings', label: 'Settings', icon: '⋯' },
  ]

  const scheduleRows = [...appointments]
    .filter((appointment) => appointment && appointment.start_time)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 8)

  const selectedDoctor = doctors.find((doctor) => String(doctor.id) === String(selectedDoctorId)) || doctors[0]

  const doctorCards = useMemo(() => {
    return doctors.map((doctor) => {
      const planned = appointments.filter((appointment) => appointment.doctor_name === doctor.name && new Date(appointment.start_time).toISOString().slice(0, 10) === todayIso)
      const booked = planned.filter((appointment) => appointment.status !== 'CANCELLED').length
      const utilization = Math.min(100, Math.round((booked / Math.max(1, booked + Math.max(1, slots.length || 3))) * 100))
      const available = Math.max(0, Math.min(12, 12 - booked))

      return {
        ...doctor,
        booked,
        available,
        utilization,
        status: booked >= 8 ? 'Busy' : booked >= 5 ? 'Steady' : 'Open',
      }
    })
  }, [appointments, doctors, slots])

  const rescueSlot = useMemo(() => {
    if (!selectedDoctor || !slots.length) return null
    const slot = slots[0]
    const startMinutes = getClockMinutes(slot)
    const endMinutes = startMinutes + 30

    return {
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      start: slot,
      end: toTimeString(endMinutes),
      startIso: `${bookingForm.date || todayIso}T${slot}:00`,
      endIso: `${bookingForm.date || todayIso}T${toTimeString(endMinutes)}:00`,
    }
  }, [bookingForm.date, selectedDoctor, slots])

  const handleSlotRescue = async () => {
    if (!rescueSlot || !patients.length) {
      showToast('No rescue slot available right now.')
      return
    }

    setLoading(true)
    try {
      await request('/api/appointments', {
        method: 'POST',
        body: {
          doctor_id: Number(rescueSlot.doctorId),
          patient_id: Number(patients[0].id),
          start_time: rescueSlot.startIso,
          end_time: rescueSlot.endIso,
        },
      })

      showToast('✓ Slot rescued successfully')
      await refreshDashboard()
    } catch (error) {
      showToast(error.message)
    } finally {
      setLoading(false)
    }
  }

  const runMorningReminders = async () => {
    if (!token) return
    setLoading(true)
    try {
      const result = await request('/api/notifications/clock', { method: 'POST', body: {} })
      setNotificationResult(result)
      showToast(`✓ Morning notification job completed. ${result.generated || 0} reminders generated.`)
      await refreshDashboard()
    } catch (error) {
      showToast(error.message)
    } finally {
      setLoading(false)
    }
  }

  const runNoShowAutomation = async () => {
    if (!token) return
    setLoading(true)
    try {
      const result = await request('/api/automation/clock', { method: 'POST', body: {} })
      setAutomationResult(result)
      showToast(`✓ Automation completed. ${result.changed?.length || 0} appointment(s) updated.`)
      await refreshDashboard()
    } catch (error) {
      showToast(error.message)
    } finally {
      setLoading(false)
    }
  }

  const openReschedule = (appointment) => {
    if (!appointment) {
      setSelectedAppointment(null)
      setRescheduleOpen(true)
      setRescheduleAlert('')
      return
    }

    const normalizedAppointment = normalizeAppointmentData(appointment, doctors, patients)
    const start = normalizedAppointment && normalizedAppointment.start_time ? new Date(normalizedAppointment.start_time) : null
    const end = normalizedAppointment && normalizedAppointment.end_time ? new Date(normalizedAppointment.end_time) : null

    setSelectedAppointment(normalizedAppointment)
    setRescheduleOpen(true)
    setRescheduleForm({
      date: start ? start.toISOString().slice(0, 10) : todayIso,
      startTime: start ? start.toTimeString().slice(0, 5) : '09:00',
      endTime: end ? end.toTimeString().slice(0, 5) : '09:30',
    })
    setRescheduleAlert('')
  }

  const onRescheduleSubmit = async (event) => {
    event.preventDefault()
    if (!selectedAppointment) return

    const nextStart = `${rescheduleForm.date}T${rescheduleForm.startTime}:00`
    const nextEnd = `${rescheduleForm.date}T${rescheduleForm.endTime}:00`

    if (new Date(nextEnd) <= new Date(nextStart)) {
      setRescheduleAlert('Please choose an end time later than the start time.')
      return
    }

    setLoading(true)
    try {
      const response = await request(`/api/appointments/${selectedAppointment.id}/reschedule`, {
        method: 'POST',
        body: {
          new_start_time: nextStart,
          new_end_time: nextEnd,
        },
      })

      setRescheduleOpen(false)
      setSelectedAppointment(response.appointment)
      showToast(`✓ Appointment rescheduled for ${response.appointment.patient_name}.`)
      await refreshDashboard()
    } catch (error) {
      const message = error.message || 'Scheduling conflict — this doctor is already booked.'
      if (/conflict|already booked|overlap/i.test(message)) {
        setRescheduleAlert('⚠ Scheduling conflict: this doctor is already booked during that window.')
      } else {
        setRescheduleAlert(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const selectionSuggestions = useMemo(() => {
    if (!slots.length) return []
    return slots.slice(0, 5)
  }, [slots])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">M</div>
          <div>
            <p className="eyebrow">Clinic Operations</p>
            <h1>MEDISLOT</h1>
          </div>
        </div>

        <div className="header-meta">
          <div className="date-chip">{todayLabel}</div>
          <div className="header-actions">
            <button type="button" className="ghost-button" onClick={seedDemoData} disabled={loading || !token}>Load Demo Data</button>
            {auth?.user ? (
              <div className="user-pill">
                <span>{auth.user.name}</span>
                <button type="button" onClick={() => { setAuth(null); showToast('You have been logged out.') }}>Logout</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {!auth?.token ? (
        <main className="auth-layout">
          <section className="panel hero-panel">
            <p className="eyebrow accent">Runtime-ready clinic intelligence</p>
            <h2>MEDISLOT</h2>
            <p className="hero-copy">
              Real-time scheduling, conflict-free operations, and patient flow visibility for modern clinics.
            </p>

            <div className="status-row">
              <span className="status-indicator online">● API Connected</span>
              <span className="status-indicator online">● Scheduling Engine Operational</span>
              <span className="status-indicator online">● Notification Service Ready</span>
              <span className="status-indicator online">● Automation Ready</span>
            </div>
          </section>

          <section className="panel auth-panel">
            <h3>Login</h3>
            <form onSubmit={login} className="stacked-form">
              <label>
                Email
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                />
              </label>
              <button type="submit" disabled={loading}>{loading ? 'Loading...' : 'Access dashboard'}</button>
            </form>
          </section>
        </main>
      ) : (
        <main className="dashboard-shell">
          <aside className="sidebar panel">
            <div className="nav-title">Overview</div>
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-button ${activeView === item.id ? 'active' : ''}`}
                onClick={() => setActiveView(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </aside>

          <div className="main-panel">
            <section className="hero-panel panel">
              <div className="hero-copy-row">
                <div>
                  <p className="eyebrow accent">Good afternoon, Clinic Staff</p>
                  <h2>Here's what's happening at your clinic today.</h2>
                </div>
                <div className="status-chip">
                  <span className="status-dot" />
                  System status: Operational
                </div>
              </div>
            </section>

            <section className="stats-grid">
              <article className="stat-card">
                <div className="stat-topline"><span className="stat-icon">🗓</span><span>Today's Appointments</span></div>
                <strong>{stats.todayCount}</strong>
                <small>{stats.confirmed} confirmed today</small>
              </article>
              <article className="stat-card">
                <div className="stat-topline"><span className="stat-icon">✅</span><span>Confirmed</span></div>
                <strong>{stats.confirmed}</strong>
                <small>Patient flow stable</small>
              </article>
              <article className="stat-card">
                <div className="stat-topline"><span className="stat-icon">🩺</span><span>Available Slots</span></div>
                <strong>{stats.slots}</strong>
                <small>Ready for booking</small>
              </article>
              <article className="stat-card">
                <div className="stat-topline"><span className="stat-icon">⏳</span><span>Cancelled / No-show</span></div>
                <strong>{stats.unavailable}</strong>
                <small>{stats.cancelled} cancelled · {stats.noShow} no-show</small>
              </article>
            </section>

            <section className="panel section-box twist-panel">
              <div className="section-header compact-header">
                <div>
                  <p className="eyebrow accent">⚡ TWIST ROUND AUTOMATION</p>
                  <h3>Smart workflows that keep clinic operations conflict-free.</h3>
                </div>
              </div>

              <div className="twist-grid">
                <article className="twist-card">
                  <div className="twist-icon">🧠</div>
                  <h4>Smart Reschedule</h4>
                  <p>Move an appointment without creating conflicts.</p>
                  <button type="button" onClick={() => { if (appointments[0]) openReschedule(appointments[0]); else showToast('No appointment to reschedule yet.'); }}>
                    Reschedule
                  </button>
                </article>

                <article className="twist-card">
                  <div className="twist-icon">🔔</div>
                  <h4>Morning Reminders</h4>
                  <p>Generate today's appointment notifications.</p>
                  <button type="button" className="secondary" onClick={runMorningReminders}>Run Morning Reminders</button>
                </article>

                <article className="twist-card">
                  <div className="twist-icon">⏱</div>
                  <h4>No-Show Automation</h4>
                  <p>Automatically handle incomplete appointments 30 minutes after start.</p>
                  <button type="button" className="secondary" onClick={runNoShowAutomation}>Run No-Show Clock</button>
                </article>

                <article className="twist-card accent-twist">
                  <div className="twist-icon">⚡</div>
                  <h4>Slot Rescue</h4>
                  <p>Release canceled time and turn it into a fast conversion opportunity.</p>
                  <button type="button" onClick={handleSlotRescue}>Book This Slot</button>
                </article>
              </div>

              {notificationResult && (
                <div className="twist-result">
                  <strong>✓ Morning notification job completed</strong>
                  <span>{notificationResult.generated || 0} reminders generated</span>
                </div>
              )}

              {automationResult && (
                <div className="twist-result warning">
                  <strong>✓ Automation completed</strong>
                  <span>{automationResult.changed?.length || 0} appointment(s) updated</span>
                </div>
              )}
            </section>

            <section className="panel section-box availability-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow accent">DOCTOR AVAILABILITY</p>
                  <h3>Clinic coverage</h3>
                </div>
              </div>
              <div className="doctor-grid">
                {doctorCards.map((doctor) => (
                  <div key={doctor.id} className="doctor-card">
                    <div className="doctor-card-head">
                      <div>
                        <h4>{doctor.name}</h4>
                        <p>{doctor.specialization || 'General practice'}</p>
                      </div>
                      <span className={`mini-tag ${doctor.status === 'Busy' ? 'busy' : doctor.status === 'Steady' ? 'steady' : 'open'}`}>{doctor.status}</span>
                    </div>
                    <div className="doctor-times">
                      <span>{doctor.start_time || '09:00'} - {doctor.end_time || '17:00'}</span>
                    </div>
                    <div className="doctor-metrics">
                      <div><strong>{doctor.booked}</strong><span>Booked</span></div>
                      <div><strong>{doctor.available}</strong><span>Available</span></div>
                    </div>
                    <div className="progress-bar"><span style={{ width: `${doctor.utilization}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel section-box action-panel">
              <div className="section-header compact-header">
                <div>
                  <p className="eyebrow accent">QUICK ACTIONS</p>
                  <h3>Front desk tools</h3>
                </div>
              </div>
              <div className="action-grid">
                <button type="button" className="action-button primary" onClick={() => setActiveView('appointments')}>+ Book Appointment</button>
                <button type="button" className="action-button" onClick={() => { if (appointments[0]) openReschedule(appointments[0]); else showToast('No appointment to reschedule yet.') }}>↻ Reschedule</button>
                <button type="button" className="action-button" onClick={() => setActiveView('doctor-day')}>🕘 Doctor Day</button>
                <button type="button" className="action-button" onClick={handleSlotRescue}>⚡ Slot Rescue</button>
              </div>
            </section>

            {rescueSlot && (
              <section className="panel section-box rescue-box">
                <div className="rescue-head">
                  <div>
                    <p className="eyebrow accent">⚡ SLOT RESCUE</p>
                    <h3>{rescueSlot.doctorName}</h3>
                  </div>
                  <button type="button" className="mini-button success" onClick={handleSlotRescue}>Book This Slot</button>
                </div>
                <div className="rescue-meta">
                  <div>
                    <span className="meta-label">Time</span>
                    <strong>{rescueSlot.start} – {rescueSlot.end}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Reason</span>
                    <strong>Released after cancellation</strong>
                  </div>
                </div>
              </section>
            )}

            <section className="panel section-box">
              <div className="section-header">
                <div>
                  <p className="eyebrow accent">TODAY'S SCHEDULE</p>
                  <h3>Today's appointments</h3>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Patient</th>
                      <th>Doctor</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.length === 0 ? (
                      <tr><td colSpan="5" className="empty-row"><span className="calendar-empty">📅</span> No appointments scheduled today.</td></tr>
                    ) : (
                      scheduleRows.map((appointment) => (
                        <tr key={appointment.id} onClick={() => setSelectedAppointment(appointment)} className={selectedAppointment?.id === appointment.id ? 'selected-row' : ''}>
                          <td>{new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>{appointment.patient_name}</td>
                          <td>{appointment.doctor_name}</td>
                          <td><span className={`status-badge ${String(appointment.status).toLowerCase()}`}>{appointment.status === 'NO_SHOW' ? 'NO_SHOW' : appointment.status}</span></td>
                          <td>
                            <div className="row-actions">
                              <button type="button" className="mini-button" onClick={(event) => { event.stopPropagation(); openReschedule(appointment) }}>Reschedule</button>
                              {appointment.status === 'CONFIRMED' && (
                                <button type="button" className="mini-button danger" onClick={(event) => { event.stopPropagation(); cancelAppointment(appointment.id) }}>Cancel</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel section-box activity-panel">
              <div className="section-header">
                <div>
                  <p className="eyebrow accent">CLINIC ACTIVITY</p>
                  <h3>Operations summary</h3>
                </div>
              </div>

              <div className="activity-grid">
                <article className="activity-card">
                  <span className="activity-label">Confirmed</span>
                  <strong>{stats.confirmed}</strong>
                  <small>Active bookings</small>
                </article>
                <article className="activity-card">
                  <span className="activity-label">Cancelled</span>
                  <strong>{stats.cancelled}</strong>
                  <small>Released slots</small>
                </article>
                <article className="activity-card">
                  <span className="activity-label">Available</span>
                  <strong>{stats.slots}</strong>
                  <small>Open this date</small>
                </article>
                <article className="activity-card accent">
                  <span className="activity-label">Status</span>
                  <strong>{selectedAppointment ? 'Selected' : 'Live'}</strong>
                  <small>{selectedAppointment ? selectedAppointment.patient_name : 'Operations running'}</small>
                </article>
              </div>
            </section>

            {selectedAppointment && (
              <section className="panel section-box detail-panel">
                <div className="section-header">
                  <div>
                    <p className="eyebrow accent">APPOINTMENT</p>
                    <h3>{selectedAppointment.patient_name}</h3>
                  </div>
                </div>
                <div className="detail-grid">
                  <div>
                    <span className="meta-label">Doctor</span>
                    <strong>{selectedAppointment.doctor_name}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Time</span>
                    <strong>{new Date(selectedAppointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(selectedAppointment.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Date</span>
                    <strong>{new Date(selectedAppointment.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Status</span>
                    <strong>{selectedAppointment.status}</strong>
                  </div>
                </div>

                <div className="timeline">
                  <div className="timeline-item positive">✓ Appointment booked</div>
                  {selectedAppointment.status === 'NO_SHOW' && <div className="timeline-item negative">○ No-show evaluation</div>}
                  {selectedAppointment.status === 'CANCELLED' && <div className="timeline-item negative">× Appointment cancelled</div>}
                  {selectedAppointment.status === 'CONFIRMED' && <div className="timeline-item neutral">○ Reminder</div>}
                </div>
              </section>
            )}

            <section className="panel section-box booking-box">
              <div className="section-header">
                <h3>Book an Appointment</h3>
              </div>

              <form onSubmit={createAppointment} className="stacked-form compact-form">
                <div className="inline-fields two-up">
                  <label>
                    Doctor
                    <select value={bookingForm.doctorId} onChange={(event) => { const value = event.target.value; setBookingForm((current) => ({ ...current, doctorId: value })); setSelectedDoctorId(value) }}>
                      <option value="">Select doctor</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Patient
                    <select value={bookingForm.patientId} onChange={(event) => setBookingForm((current) => ({ ...current, patientId: event.target.value }))}>
                      <option value="">Select patient</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>{patient.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="inline-fields two-up">
                  <label>
                    Date
                    <input type="date" value={bookingForm.date} onChange={(event) => setBookingForm((current) => ({ ...current, date: event.target.value }))} />
                  </label>
                </div>

                <div className="inline-fields two-up">
                  <label>
                    Start
                    <input type="time" value={bookingForm.startTime} onChange={(event) => setBookingForm((current) => ({ ...current, startTime: event.target.value }))} />
                  </label>
                  <label>
                    End
                    <input type="time" value={bookingForm.endTime} onChange={(event) => setBookingForm((current) => ({ ...current, endTime: event.target.value }))} />
                  </label>
                </div>

                <button type="submit" disabled={loading}>Book Visit</button>
              </form>

              <div className="slots-panel">
                <h4>Available Slots</h4>
                {slots.length === 0 ? <p className="empty-state small">No open slots on this date.</p> : (
                  <div className="slot-grid">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className="slot-pill"
                        onClick={() => {
                          const slotMinutes = getClockMinutes(slot)
                          const endMinutes = slotMinutes + 30
                          const endTime = toTimeString(endMinutes)
                          setBookingForm((current) => ({ ...current, startTime: slot, endTime }))
                        }}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      )}

      {rescheduleOpen && (
        <div className="modal-overlay" onClick={() => setRescheduleOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow accent">SMART RESCHEDULE</p>
                <h3>{selectedAppointment ? 'Move appointment' : 'No appointment selected'}</h3>
              </div>
              <button type="button" className="close-button" onClick={() => setRescheduleOpen(false)}>×</button>
            </div>

            {selectedAppointment ? (
              <>
                <div className="reschedule-summary">
                  <div>
                    <span className="meta-label">Patient</span>
                    <strong>{selectedAppointment.patient_name || 'No patient selected'}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Doctor</span>
                    <strong>{selectedAppointment.doctor_name || 'No doctor selected'}</strong>
                  </div>
                  <div>
                    <span className="meta-label">Current</span>
                    <strong>
                      {selectedAppointment.start_time && selectedAppointment.end_time
                        ? `${new Date(selectedAppointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(selectedAppointment.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'No appointment time'}
                    </strong>
                  </div>
                </div>

                <form onSubmit={onRescheduleSubmit} className="stacked-form modal-form">
                  <div className="inline-fields two-up">
                    <label>
                      New date
                      <input type="date" value={rescheduleForm.date} onChange={(event) => setRescheduleForm((current) => ({ ...current, date: event.target.value }))} />
                    </label>
                  </div>

                  <div className="inline-fields two-up">
                    <label>
                      New start
                      <input type="time" value={rescheduleForm.startTime} onChange={(event) => setRescheduleForm((current) => ({ ...current, startTime: event.target.value }))} />
                    </label>
                    <label>
                      New end
                      <input type="time" value={rescheduleForm.endTime} onChange={(event) => setRescheduleForm((current) => ({ ...current, endTime: event.target.value }))} />
                    </label>
                  </div>

                  {selectionSuggestions.length > 0 && (
                    <div className="suggestion-box">
                      <div className="suggestion-header">Suggested slots</div>
                      <div className="slot-grid small-grid">
                        {selectionSuggestions.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            className="slot-pill"
                            onClick={() => {
                              const slotMinutes = getClockMinutes(slot)
                              const endMinutes = slotMinutes + 30
                              const endTime = toTimeString(endMinutes)
                              setRescheduleForm((current) => ({ ...current, startTime: slot, endTime }))
                            }}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {rescheduleAlert && <div className="alert-box">{rescheduleAlert}</div>}

                  <button type="submit" disabled={loading}>Confirm Reschedule</button>
                </form>
              </>
            ) : (
              <div className="empty-state">
                <p>No appointment is selected for rescheduling.</p>
                <button type="button" className="secondary" onClick={() => setRescheduleOpen(false)} disabled={loading}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {message ? <div className="toast">{message}</div> : null}
    </div>
  )
}

export default App
