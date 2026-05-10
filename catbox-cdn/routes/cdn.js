const express = require("express");
const router = express.Router();

const { cdnLimiter } = require("../middleware/rateLimit");
const { proxyFile } = require("../controllers/cdnController");

// GET /file/:filename
router.get("/:filename", cdnLimiter, proxyFile);

module.exports = router;
