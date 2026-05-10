const axios = require("axios");
const FormData = require("form-data");

const CATBOX_API = "https://catbox.moe/user/api.php";
const CATBOX_BASE = "https://files.catbox.moe";

/**
 * Upload a file buffer/stream to Catbox
 * @param {Buffer} fileBuffer
 * @param {string} originalName
 * @param {string} mimeType
 * @returns {Promise<string>} Catbox URL
 */
async function uploadFile(fileBuffer, originalName, mimeType) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", fileBuffer, {
    filename: originalName,
    contentType: mimeType,
  });

  const response = await axios.post(CATBOX_API, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 120000, // 2 min timeout
  });

  const url = response.data.trim();
  if (!url.startsWith("https://")) {
    throw new Error(`Catbox error: ${url}`);
  }

  return url;
}

/**
 * Upload a file from URL to Catbox
 * @param {string} fileUrl
 * @returns {Promise<string>} Catbox URL
 */
async function uploadFromUrl(fileUrl) {
  const form = new FormData();
  form.append("reqtype", "urlupload");
  form.append("url", fileUrl);

  const response = await axios.post(CATBOX_API, form, {
    headers: form.getHeaders(),
    timeout: 120000,
  });

  const url = response.data.trim();
  if (!url.startsWith("https://")) {
    throw new Error(`Catbox error: ${url}`);
  }

  return url;
}

/**
 * Extract filename from Catbox URL
 * @param {string} catboxUrl
 * @returns {string}
 */
function extractFilename(catboxUrl) {
  return catboxUrl.replace(`${CATBOX_BASE}/`, "");
}

/**
 * Build CDN proxy URL
 * @param {string} filename
 * @returns {string}
 */
function buildCdnUrl(filename) {
  const base = process.env.BASE_URL || "http://localhost:3000";
  return `${base}/file/${filename}`;
}

module.exports = { uploadFile, uploadFromUrl, extractFilename, buildCdnUrl, CATBOX_BASE };
