// test-retrieval.js
// Manually test the retrieval function with a sample query.
// Run with: node test-retrieval.js "your test query here"
//
// Example: node test-retrieval.js "something festive for Deepavali with red stones"

const { retrieveTopProducts } = require('./retrieval');

async function main() {
  const query = process.argv[2];

  if (!query) {
    console.error('Please provide a query. Example:');
    console.error('  node test-retrieval.js "something for a Tamil wedding"');
    process.exit(1);
  }

  console.log(`\nQuery: "${query}"\n`);
  console.log('Searching...\n');

  const results = await retrieveTopProducts(query, 3);

  results.forEach((product, i) => {
    console.log(`${i + 1}. ${product.name} (similarity: ${product.similarity.toFixed(4)})`);
    console.log(`   Type: ${product.type} | Metal: ${product.metal} | Gemstone: ${product.gemstone}`);
    console.log(`   Occasion: ${product.occasion} | Style: ${product.style}`);
    console.log('');
  });
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
