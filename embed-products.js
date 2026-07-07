// embed-products.js
// Reads products.json, generates an embedding for each product, saves the
// result (product data + embedding vector) into embedded-products.json.
//
// Run with: node embed-products.js
// Requires: VOYAGE_API_KEY environment variable set
//   (get a free key at https://www.voyageai.com/ — sign up, no card needed
//   for the free tier as of when I checked, but please confirm this yourself
//   during signup since pricing pages can change)

const fs = require('fs');

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-4'; // Voyage's general-purpose model as of when I checked their docs

if (!VOYAGE_API_KEY) {
  console.error('Missing VOYAGE_API_KEY environment variable.');
  console.error('Set it with: export VOYAGE_API_KEY=your_key_here');
  process.exit(1);
}

// Combine the fields that actually carry meaning for search.
// Just using "description" alone would lose useful signal from
// occasion/style/gemstone, so we build one rich text block per product.
function buildEmbeddingText(product) {
  return [
    product.name,
    product.type,
    `Metal: ${product.metal}`,
    `Gemstone: ${product.gemstone}`,
    `Occasion: ${product.occasion}`,
    `Style: ${product.style}`,
    product.description,
  ].join('. ');
}

async function getEmbeddings(texts) {
  const res = await fetch(VOYAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model: MODEL,
      input_type: 'document', // tells Voyage these are documents to be searched, not queries
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Voyage API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  // Expecting data.data to be an array of { embedding, index }
  // If Voyage's response shape has changed since I checked, this line
  // is the first place to look — log `data` to see the real structure.
  return data.data.map(item => item.embedding);
}

// Without a payment method on file, Voyage limits accounts to 3 requests
// per minute. To stay safely under that, we wait between each batch call.
// 60 seconds / 3 requests = 20 seconds minimum gap — using 25s for a safety margin.
const DELAY_BETWEEN_BATCHES_MS = 25000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const products = JSON.parse(fs.readFileSync('products.json', 'utf-8'));
  console.log(`Loaded ${products.length} products.`);

  const BATCH_SIZE = 20; // keep batches small and safe, well under Voyage's list limits
  const embeddedProducts = [];
  const totalBatches = Math.ceil(products.length / BATCH_SIZE);
  let batchNum = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    batchNum++;
    const batch = products.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);

    console.log(`Embedding products ${i + 1}-${i + batch.length} of ${products.length} (batch ${batchNum}/${totalBatches})...`);

    const embeddings = await getEmbeddings(texts);

    batch.forEach((product, idx) => {
      embeddedProducts.push({
        ...product,
        embedding: embeddings[idx],
      });
    });

    // Wait before the next batch, unless this was the last one
    if (i + BATCH_SIZE < products.length) {
      console.log(`Waiting ${DELAY_BETWEEN_BATCHES_MS / 1000}s before next batch (rate limit)...`);
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }


  fs.writeFileSync(
    'embedded-products.json',
    JSON.stringify(embeddedProducts, null, 2)
  );

  console.log(`Done. Saved ${embeddedProducts.length} embedded products to embedded-products.json`);
  console.log(`Each embedding has ${embeddedProducts[0].embedding.length} dimensions.`);
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
