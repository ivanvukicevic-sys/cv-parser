const fetch = require('node-fetch');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DOWNLOAD_TIMEOUT = 15000; // 15 seconds

// GHL stores files on these domains
const GHL_DOWNLOAD_BASE = 'https://services.leadconnectorhq.com/documents/download/';

/**
 * Resolves a cvUrl value into a proper download URL.
 * GHL may provide:
 *   - A full URL (https://...)
 *   - A GHL file ID (e.g. "IM72kOv0vAixOfxp2F1t")
 *   - A relative path (e.g. "/documents/download/...")
 */
function resolveUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid or missing CV URL');
  }

  const trimmed = input.trim();

  // Already a full URL
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Relative path starting with /
  if (trimmed.startsWith('/')) {
    return 'https://services.leadconnectorhq.com' + trimmed;
  }

  // Assume it's a GHL file ID - construct download URL
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return GHL_DOWNLOAD_BASE + trimmed;
  }

  throw new Error(`Cannot resolve CV URL: "${trimmed.substring(0, 50)}"`);
}

/**
 * Downloads a file from a given URL and returns the buffer.
 * Handles GHL file IDs, full URLs, and relative paths.
 * Enforces a 10MB file size limit and 15s timeout.
 */
async function downloadFile(input) {
  const url = resolveUrl(input);

  console.log(`[Downloader] Resolved URL: ${url.substring(0, 100)}...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CV-Parser-API/1.0',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`File download failed with status ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${Math.round(parseInt(contentLength, 10) / 1024 / 1024)}MB exceeds 10MB limit`);
    }

    const buffer = await response.buffer();

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${Math.round(buffer.length / 1024 / 1024)}MB exceeds 10MB limit`);
    }

    if (buffer.length === 0) {
      throw new Error('Downloaded file is empty');
    }

    // Detect file type from content-type header or URL
    const contentType = response.headers.get('content-type') || '';
    const finalUrl = response.url || url; // after redirects
    const fileType = detectFileType(contentType, finalUrl, buffer);

    console.log(`[Downloader] File type detected: ${fileType}, size: ${Math.round(buffer.length / 1024)}KB`);

    return { buffer, fileType };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('File download timed out after 15 seconds');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Detects whether the file is a PDF, DOCX, or DOC based on
 * content-type, URL extension, and file magic bytes.
 */
function detectFileType(contentType, url, buffer) {
  // Check content-type header
  const ct = contentType.toLowerCase();
  if (ct.includes('pdf')) return 'pdf';
  if (ct.includes('wordprocessingml') || ct.includes('docx')) return 'docx';
  if (ct.includes('msword') || ct.includes('.doc')) return 'doc';

  // Check URL extension
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.pdf')) return 'pdf';
  if (urlLower.includes('.docx')) return 'docx';
  if (urlLower.includes('.doc')) return 'doc';

  // Check magic bytes
  if (buffer.length >= 4) {
    // PDF: starts with %PDF
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return 'pdf';
    }
    // DOCX/ZIP: starts with PK (ZIP archive)
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
      return 'docx';
    }
    // DOC: starts with D0 CF 11 E0 (OLE compound document)
    if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
      return 'doc';
    }
  }

  // Default to PDF
  return 'pdf';
}

module.exports = { downloadFile };
