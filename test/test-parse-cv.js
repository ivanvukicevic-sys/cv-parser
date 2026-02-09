/**
 * Test script for the CV Parser API.
 *
 * Usage:
 *   node test/test-parse-cv.js <api-url> <cv-pdf-url>
 *
 * Examples:
 *   # Test against local dev server
 *   node test/test-parse-cv.js http://localhost:3000/api/parse-cv https://example.com/sample-cv.pdf
 *
 *   # Test against deployed Vercel function
 *   node test/test-parse-cv.js https://your-project.vercel.app/api/parse-cv https://example.com/sample-cv.pdf
 */

const fetch = require('node-fetch');

const API_URL = process.argv[2] || 'http://localhost:3000/api/parse-cv';
const CV_URL = process.argv[3];

async function testParseCv() {
  console.log('=== CV Parser API Test ===\n');

  // Test 1: Missing cvUrl
  console.log('--- Test 1: Missing cvUrl ---');
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${JSON.stringify(data, null, 2)}`);
    console.log(`Result: ${res.status === 400 && data.success === false ? 'PASS' : 'FAIL'}\n`);
  } catch (err) {
    console.log(`Error: ${err.message}\n`);
  }

  // Test 2: Invalid URL
  console.log('--- Test 2: Invalid URL ---');
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvUrl: 'not-a-valid-url' }),
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${JSON.stringify(data, null, 2)}`);
    console.log(`Result: ${data.success === false ? 'PASS' : 'FAIL'}\n`);
  } catch (err) {
    console.log(`Error: ${err.message}\n`);
  }

  // Test 3: Wrong HTTP method
  console.log('--- Test 3: GET request (should fail) ---');
  try {
    const res = await fetch(API_URL, { method: 'GET' });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${JSON.stringify(data, null, 2)}`);
    console.log(`Result: ${res.status === 405 ? 'PASS' : 'FAIL'}\n`);
  } catch (err) {
    console.log(`Error: ${err.message}\n`);
  }

  // Test 4: Full flow with real CV URL (only if provided)
  if (CV_URL) {
    console.log('--- Test 4: Full CV parsing flow ---');
    console.log(`CV URL: ${CV_URL}`);
    const startTime = Date.now();
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvUrl: CV_URL,
          contactId: 'test-contact-123',
          locationId: 'test-location-456',
        }),
      });
      const data = await res.json();
      const elapsed = Date.now() - startTime;
      console.log(`Status: ${res.status}`);
      console.log(`Processing time: ${elapsed}ms`);
      console.log(`Response: ${JSON.stringify(data, null, 2)}`);

      if (data.success) {
        console.log('\n--- Parsed Results ---');
        console.log(`CV Score: ${data.cv_score}/10`);
        console.log(`Summary: ${data.summary}`);
        console.log(`Score Reason: ${data.score_reason}`);
        console.log(`Strengths: ${data.analysis.strengths}`);
        console.log(`Weaknesses: ${data.analysis.weaknesses}`);
        console.log(`Recommendation: ${data.analysis.recommendation}`);
        console.log(`CV Text Preview: ${data.cv_text?.substring(0, 200)}...`);
      }
      console.log(`Result: ${data.success === true && data.cv_score >= 1 ? 'PASS' : 'FAIL'}\n`);
    } catch (err) {
      console.log(`Error: ${err.message}\n`);
    }
  } else {
    console.log('--- Test 4: Skipped (no CV URL provided) ---');
    console.log('Provide a PDF URL as the second argument to run the full flow test.\n');
  }

  console.log('=== Tests Complete ===');
}

testParseCv().catch(console.error);
