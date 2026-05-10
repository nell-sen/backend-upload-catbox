require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

const uploadRoutes = require("./routes/upload");
const cdnRoutes = require("./routes/cdn");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security & Middleware ─────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Morgan Custom Logging ─────────────────────────────────────────────────────
morgan.token("custom", (req, res) => {
  const method = req.method.padEnd(6);
  const endpoint = req.originalUrl.padEnd(30);
  const status = res.statusCode;
  const time = res.getHeader("X-Response-Time") || "-";
  return `${method} | ${endpoint} | ${status} | ${time}`;
});
app.use(morgan(":custom"));

// ─── Response Time Header ──────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    res.setHeader("X-Response-Time", `${Date.now() - start}ms`);
  });
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/upload", uploadRoutes);
app.use("/file", cdnRoutes);

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: true,
    message: "Catbox CDN Proxy API",
    version: "1.0.0",
    endpoints: {
      upload: "POST /api/upload",
      uploadUrl: "POST /api/upload/url",
      cdn: "GET /file/:filename",
    },
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: false, error: "Endpoint not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  const status = err.status || 500;
  res.status(status).json({
    status: false,
    error: err.message || "Internal server error",
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📦 Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
  console.log(`🔑 API Key: ${process.env.API_KEY}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
