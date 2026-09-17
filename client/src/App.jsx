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
  const [doctorForm, setDoctorForm] = useState({
    name: 'Dr. Ananya Sharma',
    specialization: 'General Medicine',
    start_time: '09:00',
    end_time: '17:00',
    break_start: '12:00',
    break_end: '12:30',
    appointment_duration: 30,
    buffer_minutes: 15,
  })
  const [patientForm, setPatientForm] = useState({
    name: 'Rahul Verma',
    phone: '9876543210',
    email: 'rahul@example.com',
  })
  const [bookingForm, setBookingForm] = useState({
    doctorId: '',
    patientId: '',
    date: todayIso,
    startTime: '09:00',
    endTime: '09:30',
  })

  const token = auth?.token

  const request = async (path, options = {}, authToken = token) => {
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) : {}

    if (!response.ok) {
      throw new Error(data?.message || 'Request failed')
    }

    return data
  }

  const refreshDashboard = async (authToken = token) => {
    if (!authToken) return

    try {
      const [doctorData, patientData, appointmentData] = await Promise.all([
        request('/api/doctors', {}, authToken),
        request('/api/patients', {}, authToken),
        request('/api/appointments?limit=50&sort=start_time&order=asc', {}, authToken),
      ])

      const nextDoctors = doctorData.doctors || []
      const nextPatients = patientData.patients || []
      const nextAppointments = appointmentData.data || []

      setDoctors(nextDoctors)
      setPatients(nextPatients)
      setAppointments(nextAppointments)

      if (!selectedDoctorId && nextDoctors.length > 0) {
        const firstDoctorId = String(nextDoctors[0].id)
        setSelectedDoctorId(firstDoctorId)
        setBookingForm((current) => ({ ...current, doctorId: firstDoctorId }))
      }

      if (selectedDoctorId) {
        const slotData = await request(`/api/doctors/${selectedDoctorId}/available-slots?date=${bookingForm.date}`)
        setSlots(slotData.slots || [])
      }
    } catch (error) {
      setMessage(error.message)
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
        const slotData = await request(`/api/doctors/${selectedDoctorId}/available-slots?date=${bookingForm.date}`)
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
      setMessage(`Welcome back, ${result.user?.name || 'Clinic Staff'}!`)
      await refreshDashboard(result.token)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const createDoctor = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      const response = await request('/api/doctors', {
        method: 'POST',
        body: doctorForm,
      })

      setDoctors((current) => [...current, response.doctor])
      setSelectedDoctorId(String(response.doctor.id))
      setBookingForm((current) => ({ ...current, doctorId: String(response.doctor.id) }))
      setMessage(`Doctor ${response.doctor.name} added.`)
      await refreshDashboard()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const createPatient = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      const response = await request('/api/patients', {
        method: 'POST',
        body: patientForm,
      })

      setPatients((current) => [response.patient, ...current])
      setBookingForm((current) => ({ ...current, patientId: String(response.patient.id) }))
      setMessage(`Patient ${response.patient.name} saved.`)
      await refreshDashboard()
    } catch (error) {
      setMessage(error.message)
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

      setMessage(`Appointment booked for ${response.appointment.patient_name}.`)
      await refreshDashboard()
      setBookingForm((current) => ({ ...current, startTime: '09:00', endTime: '09:30' }))
    } catch (error) {
      const messageText = error.message || 'Scheduling conflict.'
      setMessage(messageText)
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

      setMessage(`Cancelled appointment. Fee: ₹${response.fee || 0}`)
      await refreshDashboard()
    } catch (error) {
      setMessage(error.message)
    }
  }

  const seedDemoData = async () => {
    if (!token) return

    setLoading(true)
    try {
      let doctorList = []
      try {
        doctorList = (await request('/api/doctors')).doctors || []
      } catch {
        doctorList = []
      }

      if (!doctorList.length) {
        const doctorsToCreate = [
          { name: 'Dr. Ananya Sharma', specialization: 'General Medicine', start_time: '09:00', end_time: '17:00', break_start: '12:00', break_end: '12:30', appointment_duration: 30, buffer_minutes: 15 },
          { name: 'Dr. Raj Mehta', specialization: 'Cardiology', start_time: '09:00', end_time: '17:00', break_start: '12:00', break_end: '12:30', appointment_duration: 30, buffer_minutes: 15 },
          { name: 'Dr. Neha Kapoor', specialization: 'Dermatology', start_time: '10:00', end_time: '18:00', break_start: '14:00', break_end: '14:30', appointment_duration: 30, buffer_minutes: 10 },
        ]

        const createdDoctors = []
        for (const doctor of doctorsToCreate) {
          const result = await request('/api/doctors', { method: 'POST', body: doctor })
          createdDoctors.push(result.doctor)
        }

        const patientsToCreate = [
          { name: 'Rahul Verma', phone: '9000000001', email: 'rahul@example.com' },
          { name: 'Priya Sharma', phone: '9000000002', email: 'priya@example.com' },
          { name: 'Amit Singh', phone: '9000000003', email: 'amit@example.com' },
          { name: 'Neha Jain', phone: '9000000004', email: 'neha@example.com' },
          { name: 'Rohan Gupta', phone: '9000000005', email: 'rohan@example.com' },
        ]

        const createdPatients = []
        for (const patient of patientsToCreate) {
          const result = await request('/api/patients', { method: 'POST', body: patient })
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
          })
        }

        const cancelled = await request('/api/appointments', {
          method: 'POST',
          body: {
            doctor_id: Number(createdDoctors[0].id),
            patient_id: Number(createdPatients[0].id),
            start_time: isoSlot(todayIso, '11:30'),
            end_time: isoSlot(todayIso, '12:00'),
          },
        })

        await request(`/api/appointments/${cancelled.appointment.id}/cancel`, {
          method: 'POST',
          body: { reason: 'Clinic schedule change' },
        })

        setSelectedDoctorId(String(createdDoctors[0].id))
        setBookingForm((current) => ({ ...current, doctorId: String(createdDoctors[0].id), patientId: String(createdPatients[0].id) }))
      }

      await refreshDashboard()
      setMessage('Demo data loaded successfully.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const confirmed = appointments.filter((appointment) => appointment.status === 'CONFIRMED').length
    const cancelled = appointments.filter((appointment) => appointment.status === 'CANCELLED').length
    const lateFeeTotal = appointments.reduce((total, appointment) => total + Number(appointment.cancellation_fee || 0), 0)

    return {
      confirmed,
      cancelled,
      fee: lateFeeTotal,
      todayCount: appointments.length,
      slots: slots.length,
    }
  }, [appointments, slots])

  const scheduleRows = [...appointments]
    .filter((appointment) => appointment && appointment.start_time)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 8)

  const searchMatch = patients.find((patient) => patient.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const logout = () => {
    setAuth(null)
    setMessage('You have been logged out.')
  }

  const selectedDoctor = doctors.find((doctor) => String(doctor.id) === String(selectedDoctorId)) || doctors[0]
  const doctorDay = appointments.filter((appointment) => String(appointment.doctor_id) === String(selectedDoctor?.id || ''))

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Front Desk Command Center</p>
          <h1>MediSlot</h1>
        </div>
        {auth?.user ? (
          <div className="user-chip">
            <span>{auth.user.name}</span>
            <button type="button" onClick={logout}>Logout</button>
          </div>
        ) : null}
      </header>

      {!auth?.token ? (
        <main className="auth-layout">
          <section className="panel hero-panel">
            <p className="eyebrow accent">Zero conflicts. Fair cancellations. Smarter clinic days.</p>
            <h2>Built for front-desk teams.</h2>
            <p>
              MediSlot helps clinics keep schedules clean, cancellations fair, and patient flow predictable.
            </p>
            <div className="hero-grid">
              <div>
                <strong>Problem</strong>
                <span>Overbooked clinics and payment confusion slow care teams down.</span>
              </div>
              <div>
                <strong>Solution</strong>
                <span>Real-time doctor availability, clear conflict rules, and fast rescheduling.</span>
              </div>
            </div>
            <div className="cta-row">
              <button type="button" onClick={() => setLoginForm({ email: 'staff@example.com', password: 'secret123' })}>Get Started</button>
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
            <div className="nav-title">Navigation</div>
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'appointments', label: 'Appointments' },
              { id: 'doctors', label: 'Doctors' },
              { id: 'patients', label: 'Patients' },
              { id: 'doctor-day', label: 'Doctor Day' },
              { id: 'slot-rescue', label: 'Slot Rescue' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-button ${activeView === item.id ? 'active' : ''}`}
                onClick={() => setActiveView(item.id)}
              >
                {item.label}
              </button>
            ))}
            <button type="button" className="nav-button logout-button" onClick={logout}>Logout</button>
          </aside>

          <div className="main-panel">
            <section className="stats-grid">
              <article className="stat-card">
                <span>Today's Appointments</span>
                <strong>{stats.todayCount}</strong>
              </article>
              <article className="stat-card">
                <span>Confirmed</span>
                <strong>{stats.confirmed}</strong>
              </article>
              <article className="stat-card">
                <span>Available Slots</span>
                <strong>{slots.length}</strong>
              </article>
              <article className="stat-card">
                <span>Cancelled</span>
                <strong>{stats.cancelled}</strong>
              </article>
              <article className="stat-card accent-card">
                <span>Late Cancellation Fees</span>
                <strong>₹{stats.fee}</strong>
              </article>
            </section>

            {activeView === 'dashboard' && (
              <>
                <section className="panel section-box">
                  <div className="section-header">
                    <h3>TODAY'S SCHEDULE</h3>
                    <button type="button" onClick={seedDemoData}>Load Demo Data</button>
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
                          <tr><td colSpan="5">No appointments yet.</td></tr>
                        ) : (
                          scheduleRows.map((appointment) => (
                            <tr key={appointment.id}>
                              <td>{new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td>{appointment.patient_name || '—'}</td>
                              <td>{appointment.doctor_name || '—'}</td>
                              <td><span className={`status-badge ${appointment.status.toLowerCase()}`}>{appointment.status}</span></td>
                              <td>
                                {appointment.status === 'CONFIRMED' ? (
                                  <button type="button" className="mini-button danger" onClick={() => cancelAppointment(appointment.id)}>Cancel</button>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="panel section-box rescue-box">
                  <div className="rescue-head">
                    <div>
                      <div className="eyebrow accent">⚡ SLOT RESCUE</div>
                      <h3>Dr. Ananya Sharma has an unexpected 11:30 AM opening.</h3>
                    </div>
                    <button type="button" className="mini-button success">Book this slot</button>
                  </div>
                  <p>Created after a cancellation.</p>
                </section>
              </>
            )}

            {activeView === 'appointments' && (
              <section className="panel section-box">
                <div className="section-header">
                  <h3>APPOINTMENTS TABLE</h3>
                </div>
                <div className="toolbar">
                  <input
                    type="search"
                    placeholder="Search patient or doctor"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Doctor</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Fee</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.length === 0 ? (
                        <tr><td colSpan="7">No appointments yet.</td></tr>
                      ) : (
                        appointments.map((appointment) => (
                          <tr key={appointment.id}>
                            <td>{appointment.patient_name}</td>
                            <td>{appointment.doctor_name}</td>
                            <td>{new Date(appointment.start_time).toLocaleDateString()}</td>
                            <td>{new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td><span className={`status-badge ${appointment.status.toLowerCase()}`}>{appointment.status}</span></td>
                            <td>₹{appointment.cancellation_fee || 0}</td>
                            <td>
                              {appointment.status === 'CONFIRMED' ? (
                                <button type="button" className="mini-button danger" onClick={() => cancelAppointment(appointment.id)}>Cancel</button>
                              ) : <span className="muted">Cancelled</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeView === 'doctors' && (
              <section className="panel section-box">
                <div className="section-header">
                  <h3>Doctors</h3>
                </div>
                <div className="stacked-list">
                  {doctors.map((doctor) => (
                    <div key={doctor.id} className="row-card">
                      <div>
                        <strong>{doctor.name}</strong>
                        <p>{doctor.specialization}</p>
                      </div>
                      <span>{doctor.start_time}–{doctor.end_time}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeView === 'patients' && (
              <section className="panel section-box">
                <div className="section-header">
                  <h3>Patients</h3>
                </div>
                <div className="toolbar">
                  <input
                    type="search"
                    placeholder="Search Rahul"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <div className="stacked-list">
                  {(searchResults.length ? searchResults : patients).slice(0, 6).map((patient) => {
                    const patientAppointments = appointments.filter((appointment) => Number(appointment.patient_id) === Number(patient.id))
                    const upcoming = patientAppointments.find((appointment) => appointment.status === 'CONFIRMED')

                    return (
                      <div key={patient.id} className="row-card patient-card">
                        <div>
                          <strong>{patient.name}</strong>
                          <p>{patient.phone}</p>
                          <small>{upcoming ? `Upcoming: ${formatDate(upcoming.start_time)}` : 'No upcoming appointment'}</small>
                        </div>
                        <div className="chip-stack">
                          <span className="mini-tag">{patientAppointments.length} visits</span>
                          {upcoming && <span className="mini-tag success">Upcoming</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {activeView === 'doctor-day' && (
              <section className="panel section-box">
                <div className="section-header">
                  <h3>{selectedDoctor ? `Dr. ${selectedDoctor.name}` : 'Doctor day'}</h3>
                </div>
                <div className="day-view list-wrap">
                  {selectedDoctor ? (
                    <>
                      <div className="doctor-header-row">
                        <strong>{selectedDoctor.name}</strong>
                        <span>{todayIso}</span>
                      </div>
                      {[{ time: '09:00', label: 'Rahul Verma', status: 'CONFIRMED' }, { time: '09:30', label: 'Priya Sharma', status: 'CONFIRMED' }, { time: '10:00', label: 'AVAILABLE', status: 'AVAILABLE' }, { time: '10:30', label: 'Amit Singh', status: 'CONFIRMED' }, { time: '11:00', label: 'AVAILABLE', status: 'AVAILABLE' }, { time: '13:00', label: 'BREAK', status: 'BREAK' }, { time: '14:00', label: 'Rohan Gupta', status: 'CONFIRMED' }].map((row) => (
                        <div key={row.time} className="day-row">
                          <span>{row.time}</span>
                          <strong>{row.label}</strong>
                          <span className={`status-badge ${row.status.toLowerCase()}`}>{row.status}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p>No doctor selected.</p>
                  )}
                </div>
              </section>
            )}

            {activeView === 'slot-rescue' && (
              <section className="panel section-box">
                <div className="section-header">
                  <h3>Slot Rescue</h3>
                </div>
                <div className="rescue-panel">
                  <div className="eyebrow accent">⚡ SLOT RESCUE</div>
                  <h4>Dr. Ananya Sharma has an unexpected 11:30 AM opening.</h4>
                  <p>Created after a cancellation.</p>
                  <button type="button" onClick={() => setActiveView('dashboard')}>Book this slot</button>
                </div>
              </section>
            )}

            <section className="panel section-box booking-box">
              <div className="section-header">
                <h3>Book an appointment</h3>
              </div>
              <form onSubmit={createAppointment} className="stacked-form compact-form">
                <label>
                  Doctor
                  <select
                    value={bookingForm.doctorId}
                    onChange={(event) => {
                      const value = event.target.value
                      setBookingForm((current) => ({ ...current, doctorId: value }))
                      setSelectedDoctorId(value)
                    }}
                  >
                    <option value="">Select doctor</option>
                    {doctors.map((doctor) => (<option key={doctor.id} value={doctor.id}>{doctor.name}</option>))}
                  </select>
                </label>
                <label>
                  Patient
                  <select
                    value={bookingForm.patientId}
                    onChange={(event) => setBookingForm({ ...bookingForm, patientId: event.target.value })}
                  >
                    <option value="">Select patient</option>
                    {patients.map((patient) => (<option key={patient.id} value={patient.id}>{patient.name}</option>))}
                  </select>
                </label>
                <div className="inline-fields two-up">
                  <label>
                    Date
                    <input
                      type="date"
                      value={bookingForm.date}
                      onChange={(event) => setBookingForm({ ...bookingForm, date: event.target.value })}
                    />
                  </label>
                </div>
                <div className="inline-fields two-up">
                  <label>
                    Start
                    <input
                      type="time"
                      value={bookingForm.startTime}
                      onChange={(event) => setBookingForm({ ...bookingForm, startTime: event.target.value })}
                    />
                  </label>
                  <label>
                    End
                    <input
                      type="time"
                      value={bookingForm.endTime}
                      onChange={(event) => setBookingForm({ ...bookingForm, endTime: event.target.value })}
                    />
                  </label>
                </div>
                <button type="submit" disabled={loading}>Book visit</button>
              </form>

              <div className="slots-panel">
                <h4>Available slots</h4>
                {slots.length === 0 ? <p className="empty-state small">No open slots on this date.</p> : (
                  <div className="slot-grid">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className="slot-pill"
                        onClick={() => setBookingForm((current) => ({ ...current, startTime: slot, endTime: slot }))}
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

      {message ? <div className="toast">{message}</div> : null}
    </div>
  )
}

export default App
