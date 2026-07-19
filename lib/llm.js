// LLM fallback chain: multiple Gemini keys (each its own daily quota) then
// OpenRouter free models. Any provider that 429s/503s is skipped automatically.
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
].filter(Boolean);

const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODELS = [
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
];

async function callGemini(key, modelName, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw Object.assign(new Error(`Gemini ${res.status}`), { status: res.status });
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw Object.assign(new Error('Gemini empty'), { status: 500 });
  return { text: text.trim(), provider: `gemini:${modelName}` };
}

async function callOpenRouter(modelName, prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw Object.assign(new Error(`OpenRouter ${res.status}`), { status: res.status });
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw Object.assign(new Error('OpenRouter empty'), { status: 500 });
  return { text: text.trim(), provider: `openrouter:${modelName}` };
}

// Returns { text, provider }. Throws only if every provider fails.
export async function generate(prompt) {
  let lastErr;
  for (let k = 0; k < GEMINI_KEYS.length; k++) {
    for (const modelName of GEMINI_MODELS) {
      try {
        return await callGemini(GEMINI_KEYS[k], modelName, prompt);
      } catch (err) {
        lastErr = err;
        console.log(`Gemini key#${k + 1} ${modelName} failed (${err.status}), next...`);
      }
    }
  }
  if (OPENROUTER_KEY) {
    for (const modelName of OPENROUTER_MODELS) {
      try {
        return await callOpenRouter(modelName, prompt);
      } catch (err) {
        lastErr = err;
        console.log(`OpenRouter ${modelName} failed (${err.status}), next...`);
      }
    }
  }
  throw lastErr || new Error('No LLM provider available');
}
