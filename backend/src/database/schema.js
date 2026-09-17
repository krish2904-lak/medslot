const db = require("./db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'receptionist',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    specialization TEXT,
    start_time TEXT NOT NULL DEFAULT '09:00',
    end_time TEXT NOT NULL DEFAULT '17:00',
    break_start TEXT,
    break_end TEXT,
    appointment_duration INTEGER NOT NULL DEFAULT 30,
    buffer_minutes INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cancellation_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    free_cancellation_hours INTEGER NOT NULL DEFAULT 4,
    late_cancellation_fee REAL NOT NULL DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id INTEGER NOT NULL,
    patient_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    cancellation_time DATETIME,
    cancellation_fee REAL NOT NULL DEFAULT 0,
    cancellation_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id)
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_doctor_time
  ON appointments(doctor_id, start_time, end_time);

  CREATE INDEX IF NOT EXISTS idx_patients_name
  ON patients(name);

  CREATE INDEX IF NOT EXISTS idx_patients_phone
  ON patients(phone);
`);

const existingPolicy = db
  .prepare("SELECT COUNT(*) AS count FROM cancellation_policies")
  .get();

if (existingPolicy.count === 0) {
  db.prepare(`
    INSERT INTO cancellation_policies
    (free_cancellation_hours, late_cancellation_fee)
    VALUES (?, ?)
  `).run(4, 100);
}

console.log("✅ Database schema initialized");