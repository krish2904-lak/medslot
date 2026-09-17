require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

require("./database/schema");
const authRoutes = require("./routes/authRoutes");
const clinicRoutes = require("./routes/clinicRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "MediSlot API is running",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api", clinicRoutes);
app.use("/api/clinic", clinicRoutes);

function startServer(port = process.env.PORT || 5000) {
  return app.listen(port, () => {
    console.log(`🚀 MediSlot API running on port ${port}`);
  });
}

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  startServer(PORT);
}

module.exports = { app, startServer };