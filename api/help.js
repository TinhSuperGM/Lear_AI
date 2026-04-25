const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_HELP_MODEL || process.env.GROQ_MODEL || "llama-3.1-8b-instant";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, data) {
  cors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

function safeParse(text) {
  try { return JSON.parse(extractJson(text)); } catch { return null; }
}

async function callGroq(messages) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 600
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data?.error?.message || `Groq HTTP ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }

  const content = data?.choices?.[0]?.message?.content || "";
  if (!content.trim()) throw new Error("Groq returned empty content");
  return content;
}

function promptFor(language, question) {
  const lang = language || "vi";
  const ask = String(question || "");
  const languageLabel = ({ vi: "Vietnamese", en: "English", es: "Spanish", ja: "Japanese" }[lang] || "Vietnamese");
  return [
    { role: "system", content: `You are a tiny study helper. Reply in ${languageLabel}. Return strict JSON only.` },
    { role: "user", content: `
Answer this question briefly, clearly, and helpfully.

Rules:
- If the user asks about Groq API keys, explain step-by-step how to get one.
- If the user asks which mode to use, recommend meaning/memory/logic based on the task.
- If the user asks about studying, give concise but useful psychological learning advice.
- If the user asks about deployment, explain the shortest working path.
- Keep the answer short and practical.
- Do not be verbose.

Return JSON only:
{
  "answer": "short answer",
  "step": "concrete next step",
  "tip": "short extra tip"
}

Question:
${ask}
`.trim() }
  ];
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!GROQ_KEY) return json(res, 500, { error: "GROQ_API_KEY is missing" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const raw = await callGroq(promptFor(body.language, body.question));
    const parsed = safeParse(raw);
    if (parsed) return json(res, 200, parsed);
    return json(res, 200, { answer: raw, step: "", tip: "" });
  } catch (err) {
    return json(res, 500, { error: err.message || "Unknown error" });
  }
}
