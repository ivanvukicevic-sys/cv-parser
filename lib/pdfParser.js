const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extracts text from a file buffer based on its type.
 * Supports PDF, DOCX, and DOC formats.
 */
async function extractText(fileBuffer, fileType) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Empty file buffer provided');
  }

  switch (fileType) {
    case 'pdf':
      return extractFromPdf(fileBuffer);
    case 'docx':
      return extractFromDocx(fileBuffer);
    case 'doc':
      // Try mammoth first (it can handle some .doc files)
      return extractFromDocx(fileBuffer);
    default:
      return extractFromPdf(fileBuffer);
  }
}

async function extractFromPdf(buffer) {
  try {
    const data = await pdfParse(buffer);
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

async function extractFromDocx(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value ? result.value.trim() : '';

    if (!text) {
      throw new Error('No text could be extracted from the document. The file may be empty or corrupted.');
    }

    return {
      fullText: text,
      preview: text.substring(0, 500),
      pageCount: 0, // mammoth doesn't provide page count
    };
  } catch (err) {
    if (err.message.includes('No text could be extracted')) {
      throw err;
    }
    throw new Error(`Document parsing failed: ${err.message}`);
  }
}

module.exports = { extractText };
