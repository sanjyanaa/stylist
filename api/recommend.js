// Imported directly as a JS module (not read at runtime via fs) so
// Vercel's bundler reliably includes it in the deployed function.
import embeddedProducts from './embedded-products.js';

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-4';

// ─── Cosine similarity (same logic as retrieval.js) ───────────────
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0, magnitudeA = 0, magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

async function embedQuery(queryText) {
  const res = await fetch(VOYAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: [queryText],
      model: MODEL,
      input_type: 'query',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Voyage API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

function retrieveTopProducts(queryEmbedding, topN = 3) {
  const scored = embeddedProducts.map(product => ({
    ...product,
    similarity: cosineSimilarity(queryEmbedding, product.embedding),
  }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topN);
}

// Maps each product category to its real collection page on the live site.
// Confirmed via direct fetch against sriganeshjewellery.com for all 5 categories.
const CATEGORY_LINKS = {
  'Bangle': 'https://sriganeshjewellery.com/bangle/',
  'Earrings': 'https://sriganeshjewellery.com/earrings/',
  'Necklace': 'https://sriganeshjewellery.com/necklaces/',
  'Ring': 'https://sriganeshjewellery.com/rings/',
  'Thali': 'https://sriganeshjewellery.com/thali/',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { occasion, style, extra } = req.body;

    // Step 1: combine quiz answers into one natural-language query
    const queryText = `${occasion}. ${style}. ${extra || ''}`.trim();

    // Step 2: embed the query and retrieve the real top 3 matches via RAG
    const queryEmbedding = await embedQuery(queryText);
    const topProducts = retrieveTopProducts(queryEmbedding, 3);

    // Step 3: ask Claude to explain (not pick) — selection is already done
    const productListForPrompt = topProducts.map((p, i) => `
Piece ${i + 1}: ${p.name}
Type: ${p.type}
Metal: ${p.metal}
Gemstone: ${p.gemstone}
Occasion tags: ${p.occasion}
Style tags: ${p.style}
`).join('\n');

    const prompt = `Customer:
- Occasion: ${occasion}
- Style: ${style}
- Extra notes: ${extra || 'None'}

These 3 pieces have already been selected as the best matches from our catalogue:
${productListForPrompt}

For each piece, write a warm, specific 2-sentence explanation of why it suits this customer, referencing their occasion/style/notes. Use this exact format:

PIECE 1
Name: ${topProducts[0].name}
Why: [2 warm specific sentences]

PIECE 2
Name: ${topProducts[1].name}
Why: [2 warm specific sentences]

PIECE 3
Name: ${topProducts[2].name}
Why: [2 warm specific sentences]

CLOSING
[One sentence styling tip for wearing all 3 together]`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 900,
        system: "You are a warm expert jewellery stylist for Sri Ganesh Jewellery & Gem Corner. The pieces have already been selected for you — only write the explanations, do not choose different pieces.",
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    // Step 4: send back the styled text AND the real product data
    // (image, link, etc.) so the frontend doesn't need to look anything
    // up locally anymore.
    res.status(200).json({
      result: data.content[0].text,
      products: topProducts.map(p => ({
        name: p.name,
        image: p.image,
        link: CATEGORY_LINKS[p.type] || null,
        type: p.type,
      })),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}