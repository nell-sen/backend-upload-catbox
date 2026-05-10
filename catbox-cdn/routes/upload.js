const express = require("express");
const multer = require("multer");
const router = express.Router();

const auth = require("../middleware/auth");
const { uploadLimiter } = require("../middleware/rateLimit");
const { uploadFiles, uploadUrl } = require("../controllers/uploadController");

// ─── Multer Config ─────────────────────────────────────────────────────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = /^(image|video|audio)\//;
  const isZip =
    file.mimetype === "application/zip" ||
    file.mimetype === "application/x-zip-compressed";

  if (allowed.test(file.mimetype) || isZip) {
    cb(null, true);
  } else {
    cb(
      Object.assign(new Error(`File type not allowed: ${file.mimetype}`), {
        status: 400,
      }),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
    files: 10, // max 10 files at once
  },
});

// ─── Error handler for multer ─────────────────────────────────────────────────
function multerError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        status: false,
        error: "File too large. Maximum size is 200MB.",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        status: false,
        error: "Too many files. Maximum is 10 files per request.",
      });
    }
    return res.status(400).json({ status: false, error: err.message });
  }
  next(err);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/upload — file upload
router.post(
  "/",
  uploadLimiter,
  auth,
  (req, res, next) => {
    upload.array("file", 10)(req, res, (err) => {
      if (err) return multerError(err, req, res, next);
      next();
    });
  },
  uploadFiles
);

// POST /api/upload/url — upload from URL
router.post("/url", uploadLimiter, auth, uploadUrl);

module.exports = router;
