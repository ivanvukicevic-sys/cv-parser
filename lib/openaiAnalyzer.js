const OpenAI = require('openai');

function buildSystemPrompt(jobTitle) {
  const positionContext = jobTitle
    ? `Kandidat se prijavljuje za poziciju: "${jobTitle}". Ocijeni CV SPECIFIČNO u odnosu na ovu poziciju - koliko je kandidat dobar fit za taj posao.`
    : 'Ocijeni CV na temelju općenite kvalitete kandidata.';

  return `Ti si stručni HR recruiter za Starhunt, AI recruitment tvrtku. Analiziraj CV kandidata i pruži:

1. Ocjenu od 1-10 na temelju kvalitete kandidata za traženu poziciju
2. Sažetak kandidata u 2-3 rečenice
3. Kratko obrazloženje ocjene

${positionContext}

VODIČ ZA OCJENJIVANJE:
- 9-10: Izvanredan (savršen match za poziciju, 7+ godina relevantnog iskustva, snažna postignuća)
- 7-8: Jak (dobar fit za poziciju, 3-7 godina iskustva, solidna pozadina)
- 5-6: Potencijal (djelomičan match, možda treba obuku za ovu poziciju)
- 3-4: Slab (loš fit za poziciju, ograničeno relevantno iskustvo)
- 1-2: Nije prikladan (potpuno neodgovarajući profil za poziciju)

Kriteriji ocjenjivanja:
- Relevantno radno iskustvo za traženu poziciju (30%)
- Obrazovanje i kvalifikacije (25%)
- Vještine (skills) koje odgovaraju poziciji (25%)
- Struktura i prezentacija CV-a (10%)
- Kontakt podaci i dostupnost (10%)

OBAVEZNO vrati odgovor ISKLJUČIVO kao JSON objekt bez dodatnog teksta:
{
  "cv_score": <broj od 1 do 10>,
  "summary": "<sažetak kandidata u 2-3 rečenice>",
  "strengths": "<kratko što je dobro u kontekstu pozicije>",
  "weaknesses": "<kratko što nedostaje za ovu poziciju>",
  "recommendation": "<Pozovi na razgovor / Odbij / Dodatne informacije potrebne>",
  "score_reason": "<kratko obrazloženje ocjene u odnosu na poziciju>"
}`;
}

/**
 * Analyzes CV text using OpenAI and returns structured scoring data.
 * Uses GPT-4o-mini for cost efficiency.
 */
async function analyzeCv(cvText, jobTitle) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Truncate very long CVs to stay within token limits
  const maxChars = 15000;
  const truncatedText = cvText.length > maxChars
    ? cvText.substring(0, maxChars) + '\n\n[CV tekst skraćen zbog duljine]'
    : cvText;

  const positionLine = jobTitle
    ? `\nPozicija na koju se kandidat prijavljuje: ${jobTitle}\n`
    : '';

  const userPrompt = `Analiziraj ovaj životopis (CV) i ocijeni ga od 1 do 10.${positionLine}\nCV tekst:\n${truncatedText}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt(jobTitle) },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const result = JSON.parse(content);

    // Validate required fields
    if (typeof result.cv_score !== 'number' || result.cv_score < 1 || result.cv_score > 10) {
      throw new Error('Invalid cv_score in OpenAI response');
    }

    return {
      cv_score: Math.round(result.cv_score),
      summary: result.summary || '',
      strengths: result.strengths || '',
      weaknesses: result.weaknesses || '',
      recommendation: result.recommendation || '',
      score_reason: result.score_reason || '',
    };
  } catch (err) {
    if (err.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again later.');
    }
    if (err.status === 401) {
      throw new Error('Invalid OpenAI API key');
    }
    if (err instanceof SyntaxError) {
      throw new Error('Failed to parse OpenAI response as JSON');
    }
    throw new Error(`OpenAI analysis failed: ${err.message}`);
  }
}

module.exports = { analyzeCv };
