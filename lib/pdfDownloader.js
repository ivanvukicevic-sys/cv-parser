const fetch = require('node-fetch');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DOWNLOAD_TIMEOUT = 15000; // 15 seconds

/**
 * Downloads a PDF from a given URL and returns the buffer.
 * Enforces a 10MB file size limit and 15s timeout.
 */
async function downloadPdf(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid or missing CV URL');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Malformed URL provided');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('URL must use HTTP or HTTPS protocol');
  }

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
      throw new Error(`PDF download failed with status ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      throw new Error(`PDF file too large: ${Math.round(parseInt(contentLength, 10) / 1024 / 1024)}MB exceeds 10MB limit`);
    }

    const buffer = await response.buffer();

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`PDF file too large: ${Math.round(buffer.length / 1024 / 1024)}MB exceeds 10MB limit`);
    }

    if (buffer.length === 0) {
      throw new Error('Downloaded file is empty');
    }

    return buffer;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('PDF download timed out after 15 seconds');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { downloadPdf };
