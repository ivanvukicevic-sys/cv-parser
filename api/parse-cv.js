const { downloadFile } = require('../lib/pdfDownloader');
const { extractText } = require('../lib/pdfParser');
const { analyzeCv } = require('../lib/openaiAnalyzer');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://services.leadconnectorhq.com')
  .split(',')
  .map(o => o.trim());

function getCorsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else {
    // Allow all origins for GHL webhook compatibility
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  const corsHeaders = getCorsHeaders(origin);

  // Set CORS headers on all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.setHeader('Content-Type', 'application/json');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      details: 'Only POST requests are accepted',
    });
  }

  const startTime = Date.now();

  try {
    const body = req.body;

    if (!body || !body.cvUrl) {
      // Return sample success response so GHL can save/map response fields
      return res.status(200).json({
        success: true,
        cv_score: 0,
        summary: "Nema CV-a za analizu",
        score_reason: "CV URL nije dostavljen",
        analysis: {
          strengths: "",
          weaknesses: "",
          recommendation: "",
        },
        cv_text: "",
        metadata: {
          contactId: (body && body.contactId) || null,
          locationId: (body && body.locationId) || null,
          processingTimeMs: 0,
          pageCount: 0,
        },
      });
    }

    const { cvUrl, contactId, locationId, jobTitle } = body;

    console.log(`[CV Parser] Processing request - contactId: ${contactId || 'N/A'}, locationId: ${locationId || 'N/A'}, jobTitle: ${jobTitle || 'N/A'}`);

    // Step 1: Download file (handles file IDs, full URLs, PDF/DOCX/DOC)
    console.log(`[CV Parser] Downloading file: ${cvUrl.substring(0, 80)}...`);
    const { buffer: fileBuffer, fileType } = await downloadFile(cvUrl);
    console.log(`[CV Parser] File downloaded: ${Math.round(fileBuffer.length / 1024)}KB, type: ${fileType}`);

    // Step 2: Extract text (supports PDF, DOCX, DOC)
    console.log(`[CV Parser] Extracting text from ${fileType.toUpperCase()}...`);
    const { fullText, preview, pageCount } = await extractText(fileBuffer, fileType);
    console.log(`[CV Parser] Text extracted: ${fullText.length} chars, ${pageCount} pages`);

    // Step 3: Analyze with OpenAI
    console.log(`[CV Parser] Analyzing CV with OpenAI${jobTitle ? ` for position: ${jobTitle}` : ''}...`);
    const analysis = await analyzeCv(fullText, jobTitle);
    console.log(`[CV Parser] Analysis complete - Score: ${analysis.cv_score}/10`);

    const elapsed = Date.now() - startTime;
    console.log(`[CV Parser] Total processing time: ${elapsed}ms`);

    // Return response with 3 separate pieces of information for GHL custom fields:
    // 1. cv_score - the numeric score
    // 2. summary - short summary of the CV
    // 3. score_reason - reason for the score
    return res.status(200).json({
      success: true,
      cv_score: analysis.cv_score,
      summary: analysis.summary,
      score_reason: analysis.score_reason,
      analysis: {
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        recommendation: analysis.recommendation,
      },
      cv_text: preview,
      metadata: {
        contactId: contactId || null,
        locationId: locationId || null,
        processingTimeMs: elapsed,
        pageCount,
      },
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`[CV Parser] Error after ${elapsed}ms: ${err.message}`);

    // Determine appropriate status code based on error
    let statusCode = 500;
    if (err.message.includes('Invalid or missing') || err.message.includes('Malformed URL')) {
      statusCode = 400;
    } else if (err.message.includes('download failed with status 404')) {
      statusCode = 404;
    } else if (err.message.includes('rate limit')) {
      statusCode = 429;
    } else if (err.message.includes('timed out')) {
      statusCode = 504;
    } else if (err.message.includes('too large')) {
      statusCode = 413;
    }

    return res.status(statusCode).json({
      success: false,
      error: categorizeError(err.message),
      details: err.message,
    });
  }
};

function categorizeError(message) {
  if (message.includes('download') || message.includes('URL') || message.includes('timed out')) {
    return 'Failed to download PDF';
  }
  if (message.includes('pars') || message.includes('extract') || message.includes('text')) {
    return 'Failed to parse PDF';
  }
  if (message.includes('OpenAI') || message.includes('rate limit') || message.includes('API key')) {
    return 'CV analysis failed';
  }
  return 'Internal server error';
}
