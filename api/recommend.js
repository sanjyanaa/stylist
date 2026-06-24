export default async function handler(req, res) {
  // Allow cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { occasion, style, extra, catalogueList } = req.body;

    const prompt = `Customer:
- Occasion: ${occasion}
- Style: ${style}
- Extra notes: ${extra || 'None'}

Sri Ganesh pieces available:
${catalogueList}

Recommend exactly 3 pieces. Use this exact format:

PIECE 1
Name: [exact name from list]
Why: [2 warm specific sentences on why this suits them]

PIECE 2
Name: [exact name]
Why: [explanation]

PIECE 3
Name: [exact name]
Why: [explanation]

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
        system: "You are a warm expert jewellery stylist for Sri Ganesh Jewellery & Gem Corner. Only recommend pieces from the provided list. Be personal and specific. Never invent pieces.",
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    res.status(200).json({ result: data.content[0].text });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}