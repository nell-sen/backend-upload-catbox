const { uploadFile, uploadFromUrl, extractFilename, buildCdnUrl } = require("../utils/catbox");
const cache = require("../utils/cache");
const axios = require("axios");

const ALLOWED_MIMES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "image/bmp", "image/tiff", "image/avif",
  "video/mp4", "video/webm", "video/avi", "video/mkv", "video/mov",
  "video/mpeg", "video/3gpp",
  "audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/flac",
  "audio/aac", "audio/webm",
  "application/zip", "application/x-zip-compressed",
];

function isAllowedMime(mime) {
  if (!mime) return false;
  return (
    ALLOWED_MIMES.includes(mime) ||
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/")
  );
}

/**
 * POST /api/upload
 * Upload one or multiple files via multipart/form-data
 */
async function uploadFiles(req, res, next) {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        status: false,
        error: "No file(s) provided. Use field name: file",
      });
    }

    const results = await Promise.all(
      files.map(async (file) => {
        if (!isAllowedMime(file.mimetype)) {
          return {
            status: false,
            name: file.originalname,
            error: `File type not allowed: ${file.mimetype}`,
          };
        }

        const catboxUrl = await uploadFile(file.buffer, file.originalname, file.mimetype);
        const filename = extractFilename(catboxUrl);
        const cdnUrl = buildCdnUrl(filename);

        // Cache the mapping
        cache.set(filename, catboxUrl);

        return {
          status: true,
          name: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          original: catboxUrl,
          cdn: cdnUrl,
        };
      })
    );

    const allSuccess = results.every((r) => r.status);
    const httpStatus = allSuccess ? 200 : 207; // 207 Multi-Status if partial failure

    // Single file → unwrap for cleaner response
    if (results.length === 1) {
      const r = results[0];
      return res.status(r.status ? 200 : 400).json(r);
    }

    return res.status(httpStatus).json({
      status: allSuccess,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error(`[UPLOAD] Error: ${err.message}`);
    next(err);
  }
}

/**
 * POST /api/upload/url
 * Upload file from remote URL
 */
async function uploadUrl(req, res, next) {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        status: false,
        error: "Missing 'url' in request body",
      });
    }

    // Validate URL format
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({
        status: false,
        error: "Invalid URL format",
      });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).json({
        status: false,
        error: "URL must use HTTP or HTTPS protocol",
      });
    }

    // Check if already cached
    const cacheKey = `url:${url}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        status: true,
        cached: true,
        original: cached.catboxUrl,
        cdn: cached.cdnUrl,
      });
    }

    const catboxUrl = await uploadFromUrl(url);
    const filename = extractFilename(catboxUrl);
    const cdnUrl = buildCdnUrl(filename);

    // Cache result
    cache.set(filename, catboxUrl);
    cache.set(cacheKey, { catboxUrl, cdnUrl });

    return res.json({
      status: true,
      source: url,
      original: catboxUrl,
      cdn: cdnUrl,
    });
  } catch (err) {
    console.error(`[UPLOAD URL] Error: ${err.message}`);
    if (err.response?.status === 404) {
      return res.status(400).json({ status: false, error: "Source URL returned 404" });
    }
    next(err);
  }
}

module.exports = { uploadFiles, uploadUrl };
