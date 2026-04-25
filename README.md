# AI Study Buddy v2

A compact public-ready study app with:
- 3 learning modes: Meaning / Memory / Logic
- multilingual UI
- hidden Groq-backed helper modal
- chat-sized layout that works on desktop and mobile
- spaced repetition / review deck / streak
- easy-explanation and summary tools

## Files
- `index.html` — frontend
- `api/chat.js` — study flow (analyze, judge, final, explain, summarize)
- `api/help.js` — helper modal
- `vercel.json` — Vercel function config
- `package.json` — marks ESM for the API files

## Setup on Vercel
1. Push this folder to GitHub
2. Import into Vercel
3. Add environment variable:
   - `GROQ_API_KEY`
4. Optional variables:
   - `GROQ_MODEL`
   - `GROQ_HELP_MODEL`
5. Deploy

## Local usage
- Open `index.html` with Live Server for UI testing
- The API routes need Vercel or another Node server to run
