// convert-embeddings.js
// Run once locally: node convert-embeddings.js
// Converts api/embedded-products.json into api/embedded-products.js
// (a plain JS module export), which Vercel's bundler includes reliably —
// unlike a JSON file only referenced via a runtime fs.readFileSync path,
// which may get left out of the deployment bundle.

const fs = require('fs');

const inputPath = 'api/embedded-products.json';
const outputPath = 'api/embedded-products.js';

if (!fs.existsSync(inputPath)) {
  console.error(`Could not find ${inputPath}. Run this from your stylist project root.`);
  process.exit(1);
}

const jsonText = fs.readFileSync(inputPath, 'utf-8');

// JSON array/object syntax is valid JS syntax, so we can just wrap it
// in an export statement directly.
const jsModule = `export default ${jsonText};\n`;

fs.writeFileSync(outputPath, jsModule);
console.log(`Done. Wrote ${outputPath}`);
