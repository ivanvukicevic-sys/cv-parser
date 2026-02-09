const pdfParse = require('pdf-parse');

/**
 * Extracts text content from a PDF buffer.
 * Returns the full text and a preview (first 500 chars).
 */
async function extractText(pdfBuffer) {
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('Empty PDF buffer provided');
  }

  try {
    const data = await pdfParse(pdfBuffer);

    const text = data.text ? data.text.trim() : '';

    if (!text) {
      throw new Error('No text could be extracted from the PDF. The file may be image-based or corrupted.');
    }

    return {
      fullText: text,
      preview: text.substring(0, 500),
      pageCount: data.numpages || 0,
    };
  } catch (err) {
    if (err.message.includes('No text could be extracted')) {
      throw err;
    }
    throw new Error(`PDF parsing failed: ${err.message}`);
  }
}

module.exports = { extractText };
