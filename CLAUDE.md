# Feynman — Claude Code Guide

## What This App Is

**Feynman** is a study app built on the Feynman Technique: the user explains a topic in plain language to Claude, who plays a curious 12-year-old. At the end of each session, the app generates a review report identifying gaps, unexplained jargon, and areas to revisit.

Target users: high school and university students.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React (web, responsive) |
| Auth + Database | Supabase (email/password auth, Postgres) |
| LLM | Claude API (Anthropic) |
| Voice | ElevenLabs API (realistic TTS for Claude's 12-year-old voice) + Web Speech API (user mic input / STT) |
| Hosting | Vercel |

## Architecture Notes

### Two-Prompt Design
Claude is used in two distinct modes — do not collapse these into one system prompt:

1. **Chat prompt** — Claude plays a curious, enthusiastic 12-year-old. Asks follow-up questions that probe gaps without being annoying. Never breaks character during the session.
2. **Review prompt** — A separate analytical call over the full session transcript at session end. Identifies: concepts explained clearly, jargon used without simplification, questions the user couldn't answer, and suggested areas to revisit.

### Voice
- **User input (STT):** Web Speech API (browser-native, no cost)
- **Claude output (TTS):** ElevenLabs API — choose a young, curious-sounding voice. Stream audio responses where possible to reduce perceived latency.

### Data Model (Supabase / Postgres)
```
users          — id, email, created_at
sessions       — id, user_id, topic, started_at, ended_at
messages       — id, session_id, role (user|assistant), content, created_at
reviews        — id, session_id, report_json, created_at
```

## MVP Scope

### In scope
- Email/password auth
- Start a session with a topic
- Chat UI — text input + voice input (STT), Claude responds in text + ElevenLabs audio
- End session → trigger review generation
- Review report: gaps, jargon, unanswered questions, suggestions
- Session history with past reviews

### Explicitly out of scope (do not add)
- Spaced repetition or study scheduling
- Topic suggestions or curriculum maps
- Scoring, grades, or gamification
- Social / collaborative sessions
- Native mobile app
- OAuth / SSO (add post-MVP)
- External resource recommendations

## Key Commands

> Add build/dev/test commands here once the project is scaffolded.

```bash
# placeholder — update after init
npm run dev
npm run build
npm run test
```

## Environment Variables

```bash
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
