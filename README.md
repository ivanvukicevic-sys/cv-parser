# CV Parser API

Serverless API that parses CV/resume PDFs and returns AI-powered scoring and analysis. Built for GoHighLevel (GHL) webhook integration across 100+ sub-accounts.

## How It Works

1. GHL sends a webhook with a PDF URL
2. The API downloads the PDF
3. Extracts text using `pdf-parse`
4. Analyzes the CV using OpenAI GPT-4o-mini (Croatian language)
5. Returns a score (1-10), summary, and score reason as 3 separate fields for GHL custom fields

## API Endpoint

**POST** `/api/parse-cv`

### Request Body

```json
{
  "cvUrl": "https://services.leadconnectorhq.com/documents/download/IM72kOv0vA...",
  "contactId": "optional-ghl-contact-id",
  "locationId": "optional-ghl-location-id"
}
```

### Success Response

```json
{
  "success": true,
  "cv_score": 8,
  "summary": "Kandidat ima 5 godina iskustva u IT sektoru...",
  "score_reason": "Jak kandidat s relevantnim iskustvom i solidnim vještinama",
  "analysis": {
    "strengths": "Detaljno opisano radno iskustvo, relevantne vještine",
    "weaknesses": "Nedostaje obrazovanje, nepotpuni kontakt podaci",
    "recommendation": "Pozovi na razgovor"
  },
  "cv_text": "extracted text preview (first 500 chars)",
  "metadata": {
    "contactId": "ghl-contact-id",
    "locationId": "ghl-location-id",
    "processingTimeMs": 3200,
    "pageCount": 2
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Failed to download PDF",
  "details": "PDF download failed with status 404: Not Found"
}
```

## GHL Custom Field Mapping

The response provides 3 key fields for GHL custom fields:

| Response Field | GHL Custom Field | Description |
|---|---|---|
| `cv_score` | CV Score | Number 1-10 |
| `summary` | CV Summary | 2-3 sentence summary |
| `score_reason` | CV Score Reason | Why this score was given |

## Setup

### 1. Clone and Install

```bash
git clone <repo-url>
cd cv-parser
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### 3. Local Development

```bash
npx vercel dev
```

### 4. Deploy to Vercel

```bash
# Login to Vercel
npx vercel login

# Link project
npx vercel link

# Add environment variable
npx vercel env add OPENAI_API_KEY

# Deploy
npx vercel --prod
```

Your API will be available at: `https://your-project.vercel.app/api/parse-cv`

## GHL Integration

In each GHL sub-account workflow:

1. Add a **Send Outbound Webhook** action
2. Set **URL** to: `https://your-project.vercel.app/api/parse-cv`
3. Set **Method** to: `POST`
4. Set **Body** to:
   ```json
   {
     "cvUrl": "{{custom_fields.cv_url}}",
     "contactId": "{{contact.id}}",
     "locationId": "{{location.id}}"
   }
   ```
5. Map the response fields to GHL custom fields:
   - `cv_score` -> CV Score custom field
   - `summary` -> CV Summary custom field
   - `score_reason` -> CV Score Reason custom field

## Testing

```bash
# Run validation tests against your deployed API
node test/test-parse-cv.js https://your-project.vercel.app/api/parse-cv

# Full test with a real PDF URL
node test/test-parse-cv.js https://your-project.vercel.app/api/parse-cv https://example.com/sample-cv.pdf
```

## Scoring Guide

| Score | Level | Criteria |
|-------|-------|----------|
| 9-10 | Izvanredan | Perfect match, 7+ years relevant experience, strong achievements |
| 7-8 | Jak | Good fit, 3-7 years experience, solid background |
| 5-6 | Potencijal | Partial match, may need training |
| 3-4 | Slab | Poor fit, limited experience |
| 1-2 | Nije prikladan | Not suitable |

## Limits

- Max PDF size: 10MB
- Download timeout: 15 seconds
- Function timeout: 30 seconds
- CV text truncated at 15,000 characters for OpenAI

## Cost

Uses GPT-4o-mini: approximately $0.01 per CV analysis.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Missing required field` | Ensure the webhook body contains `"cvUrl"` |
| `Failed to download PDF` | Check the PDF URL is publicly accessible |
| `Failed to parse PDF` | The PDF might be image-based (scanned) - text extraction requires selectable text |
| `CV analysis failed` | Check your `OPENAI_API_KEY` is valid and has credits |
| `rate limit exceeded` | OpenAI rate limit hit - requests will succeed on retry |
| Timeout errors | The PDF might be too large or the URL might be slow to respond |

## File Structure

```
/
├── api/
│   └── parse-cv.js          # Main serverless function
├── lib/
│   ├── pdfDownloader.js     # PDF download logic (10MB limit, 15s timeout)
│   ├── pdfParser.js         # PDF text extraction via pdf-parse
│   └── openaiAnalyzer.js    # OpenAI GPT-4o-mini integration
├── test/
│   └── test-parse-cv.js     # Test script
├── package.json
├── vercel.json              # Vercel config (30s max duration)
├── .env.example             # Environment variable template
└── README.md
```
