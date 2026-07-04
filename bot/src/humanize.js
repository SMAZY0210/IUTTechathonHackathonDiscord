// Optional LLM layer. If an API key is configured it rephrases the factual
// message into something warmer and more conversational; with no key (or on any
// error) it returns the original text unchanged, so the bot always works.
//
// Crucially, the LLM is only ever asked to *rephrase* — the numbers and device
// states are already baked into the text by the embed builders, so we never let the model
// invent or alter data.

const PROVIDER = (process.env.LLM_PROVIDER || 'none').toLowerCase();

const SYSTEM_PROMPT =
  'You are a friendly office-assistant bot in a Discord server. Rephrase the ' +
  "user's message into a short, warm, natural reply (1-3 sentences). A single " +
  'light emoji is fine. Do NOT invent, add, or change any numbers, device names, ' +
  'or on/off states — only rephrase what is given.';

export async function humanize(text) {
  try {
    if (PROVIDER === 'anthropic') return await viaAnthropic(text);
    if (PROVIDER === 'openai') return await viaOpenAI(text);
  } catch (err) {
    console.warn('[humanize] LLM call failed, using plain text:', err.message);
  }
  return text; // deterministic fallback
}

async function viaAnthropic(text) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'claude-3-5-haiku-latest',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || text;
}

async function viaOpenAI(text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || text;
}
