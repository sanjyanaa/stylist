// retrieval.js
// Core RAG retrieval logic: embed a user query, compare it against all
// product embeddings using cosine similarity, return the top matches.
//
// This file exports functions to be used by other scripts (like the
// test script, and later the actual API endpoint).

const fs = require('fs');

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-4';

// ─── Cosine similarity ───────────────────────────────────────────
// Measures the angle between two vectors. Returns a value from -1 to 1,
// where 1 means identical direction (very similar meaning), 0 means
// unrelated, and -1 means opposite meaning. For text embeddings, scores
// are usually between 0 and 1 in practice.
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error(
      `Vector length mismatch: ${vecA.length} vs ${vecB.length}. ` +
      `Query and product embeddings must come from the same model.`
    );
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

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

// ─── Embed a single query string ─────────────────────────────────
// Note: input_type is "query" here, not "document" — Voyage's docs
// (as I read them) distinguish between the two for better matching.
// I have not verified this distinction changes results in practice,
// only that it's what Voyage's documentation recommends.
async function embedQuery(queryText) {
  if (!VOYAGE_API_KEY) {
    throw new Error('Missing VOYAGE_API_KEY environment variable.');
  }

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

// ─── Main retrieval function ─────────────────────────────────────
// Takes a user's query text, embeds it, compares against every product
// in embedded-products.json, and returns the top N matches sorted by
// similarity score (highest first).
async function retrieveTopProducts(queryText, topN = 3) {
  const embeddedProducts = JSON.parse(
    fs.readFileSync('embedded-products.json', 'utf-8')
  );

  const queryEmbedding = await embedQuery(queryText);

  const scored = embeddedProducts.map(product => ({
    ...product,
    similarity: cosineSimilarity(queryEmbedding, product.embedding),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, topN);
}

module.exports = { cosineSimilarity, embedQuery, retrieveTopProducts };
