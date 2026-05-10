const axios = require("axios");
const cache = require("../utils/cache");
const { CATBOX_BASE } = require("../utils/catbox");

const ALLOWED_REFERER_HOSTS = (() => {
  try {
    const base = process.env.BASE_URL || "http://localhost:3000";
    return [new URL(base).hostname];
  } catch {
    return ["localhost"];
  }
})();

/**
 * Check anti-hotlink: allow if no referer OR referer is own domain
 */
function isAllowedReferer(req) {
  const referer = req.headers["referer"] || req.headers["referer"];
  if (!referer) return true; // Direct access allowed

  try {
    const refHost = new URL(referer).hostname;
    return ALLOWED_REFERER_HOSTS.includes(refHost) || refHost === "localhost";
  } catch {
    return false;
  }
}

/**
 * GET /file/:filename
 * Stream file from Catbox with caching, range support, and anti-hotlink
 */
async function proxyFile(req, res, next) {
  try {
    const { filename } = req.params;

    // Validate filename
    if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return res.status(400).json({ status: false, error: "Invalid filename" });
    }

    // Anti-hotlink check
    if (!isAllowedReferer(req)) {
      return res.status(403).json({
        status: false,
        error: "Hotlinking not allowed. Use the CDN URL directly.",
      });
    }

    const catboxUrl = `${CATBOX_BASE}/${filename}`;
    const rangeHeader = req.headers["range"];

    // Build request headers for Catbox
    const upstreamHeaders = {
      "User-Agent": "Mozilla/5.0 (compatible; CatboxCDNProxy/1.0)",
    };
    if (rangeHeader) {
      upstreamHeaders["Range"] = rangeHeader;
    }

    // Check metadata cache (stores content-type & content-length)
    const metaCacheKey = `meta:${filename}`;
    const cachedMeta = cache.get(metaCacheKey);

    let response;
    try {
      response = await axios.get(catboxUrl, {
        responseType: "stream",
        headers: upstreamHeaders,
        timeout: 30000,
        validateStatus: (status) => status < 500,
      });
    } catch (err) {
      if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
        return res.status(502).json({ status: false, error: "Unable to reach Catbox upstream" });
      }
      throw err;
    }

    // Handle upstream errors
    if (response.status === 404) {
      return res.status(404).json({ status: false, error: `File not found: ${filename}` });
    }
    if (response.status === 403) {
      return res.status(403).json({ status: false, error: "Access denied by upstream" });
    }
    if (response.status >= 400) {
      return res.status(response.status).json({
        status: false,
        error: `Upstream returned ${response.status}`,
      });
    }

    // Extract and cache metadata
    const contentType = response.headers["content-type"] || "application/octet-stream";
    const contentLength = response.headers["content-length"];
    const lastModified = response.headers["last-modified"];
    const etag = response.headers["etag"] || `"${filename}"`;

    if (!cachedMeta) {
      cache.set(metaCacheKey, { contentType, contentLength, lastModified, etag });
    }

    // Handle ETag conditional requests
    const ifNoneMatch = req.headers["if-none-match"];
    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(304).end();
    }

    // Set response headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=1800"); // 30 min browser cache
    res.setHeader("X-CDN-Proxy", "CatboxCDN/1.0");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }
    if (lastModified) {
      res.setHeader("Last-Modified", lastModified);
    }

    // Range request support (video streaming)
    if (rangeHeader && response.status === 206) {
      res.setHeader("Accept-Ranges", "bytes");
      if (response.headers["content-range"]) {
        res.setHeader("Content-Range", response.headers["content-range"]);
      }
      if (response.headers["content-length"]) {
        res.setHeader("Content-Length", response.headers["content-length"]);
      }
      res.status(206);
    } else {
      res.setHeader("Accept-Ranges", "bytes");
      res.status(200);
    }

    // Stream file to client
    response.data.on("error", (streamErr) => {
      console.error(`[CDN] Stream error for ${filename}: ${streamErr.message}`);
      if (!res.headersSent) {
        res.status(500).json({ status: false, error: "Stream interrupted" });
      }
    });

    response.data.pipe(res);
  } catch (err) {
    console.error(`[CDN] Error: ${err.message}`);
    next(err);
  }
}

module.exports = { proxyFile };
