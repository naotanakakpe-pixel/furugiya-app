export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType, hints = {} } = req.body;
  if (!imageBase64 || !mediaType) return res.status(400).json({ error: 'Missing image data' });

  const hintsText = [
    hints.brand ? `ブランド：${hints.brand}` : '',
    hints.size ? `サイズ：${hints.size}` : '',
    hints.era ? `年代：${hints.era}` : '',
    hints.extra ? `その他：${hints.extra}` : ''
  ].filter(Boolean).join('、');

  const hintsPrompt = hintsText ? `\n\n補足情報（ユーザーが入力）：${hintsText}。これを優先的に参考にしてください。` : '';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 }
            },
            {
              type: 'text',
              text: `この古着の画像を分析して、JSONのみで回答してください。マークダウンや余分なテキストは不要です。${hintsPrompt}

{
  "brand": "ブランド名（例: Levi's）。不明なら「不明」",
  "item_type": "アイテム名（できるだけ具体的に。例: 900シリーズ ハイウエスト テーパードデニム）",
  "color": "色（例: ライトブルー）",
  "condition": "良好 or 普通 or やや傷みあり",
  "era": "年代（例: 90s。不明なら「不明」）",
  "search_ja": "ヤフオク検索用キーワード（日本語、スペース区切り5〜7語、具体的に）",
  "search_mercari": "メルカリ検索用キーワード（英語ブランド名+日本語、例: Levis 900 ハイウエスト テーパード）",
  "advice": "このアイテムをメルカリ・ヤフオクで売る際の価格設定と出品のコツ（2〜3文）",
  "title_example": "出品タイトルの例文（60文字以内）",
  "tags": ["特徴タグ1", "特徴タグ2", "特徴タグ3", "特徴タグ4"]
}`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'API Error' });
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Parse error' });

    const result = JSON.parse(match[0]);
    return res.status(200).json(result);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
