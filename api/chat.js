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
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { apiKey, model, messages, temperature, max_completion_tokens } = body;

    if (!apiKey || typeof apiKey !== "string") {
      return res.status(400).json({ error: "Missing API key" });
    }

    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: "Missing messages" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: model || "llama-3.1-8b-instant",
        messages,
        temperature: typeof temperature === "number" ? temperature : 0.35,
        max_completion_tokens: Number.isFinite(max_completion_tokens) ? max_completion_tokens : 1200,
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
      content,
      usage: data?.usage || null
    });
  } catch (err) {
    console.error("chat api error:", err);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
