const GIT_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const GROQ_KEY = process.env.GROQ_API_KEY;

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
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1);
  }
  return text.trim();
}

function safeParse(text) {
  try {
    return JSON.parse(extractJson(text));
  } catch {
    return null;
  }
}

function languageName(code) {
  return ({ vi: "Vietnamese", en: "English", es: "Spanish", ja: "Japanese" }[code] || "Vietnamese");
}

function modeStyle(mode, language) {
  const map = {
    meaning: {
      vi: "Giải thích bản chất, ý nghĩa, ví dụ gần gũi, liên hệ thực tế.",
      en: "Explain the meaning, core idea, and a practical example.",
      es: "Explica el significado, la idea central y un ejemplo práctico.",
      ja: "意味、核心、実例をわかりやすく説明する。"
    },
    memory: {
      vi: "Dùng active recall, chunking, mnemonic, và lặp lại cách quãng.",
      en: "Use active recall, chunking, mnemonics, and spaced repetition.",
      es: "Usa active recall, chunking, mnemotecnias y repetición espaciada.",
      ja: "アクティブリコール、チャンク化、語呂合わせ、間隔反復を使う。"
    },
    logic: {
      vi: "Chia nhỏ bước giải, kiểm tra suy luận, không nhảy cóc kết quả.",
      en: "Break into steps, verify reasoning, do not jump to the answer.",
      es: "Divide en pasos, verifica el razonamiento y no saltes al resultado.",
      ja: "手順を分け、推論を確認し、答えに飛びつかない。"
    }
  };
  return map[mode]?.[language] || map.meaning.vi;
}

function buildMessages(action, body) {
  const language = body.language || "vi";
  const mode = body.mode || "meaning";
  const langName = languageName(language);
  const style = modeStyle(mode, language);
  const text = String(body.text || body.question || "");
  const summary = String(body.summary || "");
  const keyPoints = Array.isArray(body.keyPoints) ? body.keyPoints : [];
  const questions = Array.isArray(body.questions) ? body.questions : [];
  const answers = Array.isArray(body.answers) ? body.answers : [];
  const qCount = Number(body.questionCount || 5);
  const question = String(body.question || "");
  const answer = String(body.answer || "");
  const answerKey = String(body.answerKey || "");
  const expectedFocus = String(body.expectedFocus || "");

  if (action === "analyze") {
    return [
      { role: "system", content: `You are an AI tutor. Reply in ${langName}. Return strict JSON only.` },
      { role: "user", content: `
Analyze the learning content for a student.

Mode: ${mode}
Teaching style: ${style}
Language: ${langName}

Goals:
1) Summarize briefly.
2) Extract the most important key points.
3) Create ${qCount} questions from easy to hard.
4) If the input is a question, infer the real learning goal and turn it into a clear study goal.
5) Use psychological learning methods:
   - active recall
   - chunking
   - spaced repetition
   - dual coding
   - gentle reward / motivation
6) Keep it concise and focused.

Return JSON only:
{
  "summary": "short summary",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "questions": [
    {"level": 1, "question": "question 1", "expectedFocus": "focus"},
    {"level": 2, "question": "question 2", "expectedFocus": "focus"}
  ],
  "goal": "learning goal",
  "motivation": "short motivating line",
  "psychTips": ["tip 1", "tip 2"],
  "restSuggestion": { "enabled": true, "seconds": 600, "reason": "short reason" }
}

Content:
"""
${text}
"""
`.trim() }
    ];
  }

  if (action === "judge") {
    return [
      { role: "system", content: `You are a strict-but-kind tutor. Reply in ${langName}. Return strict JSON only.` },
      { role: "user", content: `
Evaluate a learner answer.

Question:
${question}

Expected focus:
${expectedFocus || "n/a"}

Learner answer:
${answer}

Mode: ${mode}
Style: ${style}

Criteria:
- Accept equivalent meaning as correct.
- In memory mode, prefer recall of the key idea.
- In logic mode, require step-by-step reasoning.
- In meaning mode, require the core concept.
- Keep feedback short.

Return JSON only:
{
  "correct": true/false,
  "feedback": "short feedback",
  "hint": "short hint if wrong",
  "confidence": 0-100
}
`.trim() }
    ];
  }

  if (action === "final" || action === "evaluate_final") {
    return [
      { role: "system", content: `You are an AI tutor. Reply in ${langName}. Return strict JSON only.` },
      { role: "user", content: `
Judge whether the learner truly understood the material.

Mode: ${mode}
Teaching style: ${style}

Original content:
"""
${text}
"""

Summary:
${summary}

Key points:
${JSON.stringify(keyPoints)}

Questions asked:
${JSON.stringify(questions, null, 2)}

Learner answers:
${JSON.stringify(answers, null, 2)}

Final question:
${question}

Answer key:
${answerKey}

Rules:
- learnedWell = true only if the learner clearly understands the core target.
- Final question should feel like the real thing the learner wanted to know.
- If weak, list specific weak points.
- Return concise, useful feedback.
- Include review cards for wrong or weak areas.

Return JSON only:
{
  "learnedWell": true/false,
  "overallScore": 0-100,
  "strengths": ["strength 1", "strength 2"],
  "weakPoints": ["weak point 1", "weak point 2"],
  "finalQuestion": "one final check question",
  "finalAnswerKey": "short answer key",
  "encouragement": { "good": "short praise", "bad": "short correction" },
  "nextStep": "short next step",
  "reviewCards": [
    { "question": "review question", "answerKey": "short answer" }
  ]
}
`.trim() }
    ];
  }

  if (action === "explain") {
    return [
      { role: "system", content: `You are an AI tutor. Reply in ${langName}. Return strict JSON only.` },
      { role: "user", content: `
Explain the learning material in a much easier way for a ${langName} learner.

Mode: ${mode}
Style: ${style}

Topic:
${body.topic || "n/a"}

Question:
${question || "n/a"}

Content:
"""
${text}
"""

Summary:
${summary}

Return JSON only:
{
  "easyExplanation": "very easy explanation",
  "example": "simple example",
  "miniMnemonic": "short memory aid"
}
`.trim() }
    ];
  }

  if (action === "summarize") {
    return [
      { role: "system", content: `You are an AI tutor. Reply in ${langName}. Return strict JSON only.` },
      { role: "user", content: `
Summarize the learning content in a helpful way.

Mode: ${mode}
Style: ${style}

Content:
"""
${text}
"""

Return JSON only:
{
  "summary": "short summary",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "studyTip": "short study tip"
}
`.trim() }
    ];
  }

  throw new Error("Unknown action");
}

async function callGroq(messages) {
  const body = {
    model: GIT_MODEL,
    messages,
    temperature: 0.35,
    max_tokens: 1200
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
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

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }
  if (!GROQ_KEY) {
    return json(res, 500, { error: "GROQ_API_KEY is missing" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const action = body.action || "analyze";
    const messages = buildMessages(action, body);
    const raw = await callGroq(messages);
    const parsed = safeParse(raw);

    if (parsed) {
      return json(res, 200, parsed);
    }

    // fallback plain wrapper
    return json(res, 200, {
      summary: raw,
      keyPoints: [],
      questions: [],
      content: raw
    });
  } catch (err) {
    return json(res, 500, { error: err.message || "Unknown error" });
  }
}
