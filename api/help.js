const buckets = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 12;

  const arr = (buckets.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(ip, arr);
    return false;
  }
  arr.push(now);
  buckets.set(ip, arr);
  return true;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").toString().split(",")[0].trim();
    if (!rateLimit(ip)) {
      return res.status(429).json({ error: "Too many requests" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { messages } = body;

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: "Missing GROQ_API_KEY" });
    }

    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: "Missing messages" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages,
        temperature: 0.2,
        max_completion_tokens: 700,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Groq request failed"
      });
    }

    const content = data?.choices?.[0]?.message?.content || "";
    return res.status(200).json({
      ok: true,
      content
    });
  } catch (err) {
    console.error("help api error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
