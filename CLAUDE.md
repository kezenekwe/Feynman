# Feynman — Claude Code Guide

## What This App Is

**Feynman** is a study app built on the Feynman Technique: the user explains a topic in plain language to Claude, who plays a curious 12-year-old. At the end of each session, the app generates a review report identifying gaps, unexplained jargon, and areas to revisit.

Target users: high school and university students.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend + Backend | Next.js (App Router) | API Route Handlers keep Claude and ElevenLabs keys server-side. One repo, one deployment, native streaming support. Vercel has first-class Next.js support. |
| Auth + Database | Supabase (Postgres + Auth) | Postgres is right for this relational data shape. Auth, DB, dashboard, and RLS in one product. Manual plan upgrades work directly in the table editor. |
| LLM | Claude API (Anthropic) | Called server-side via Next.js Route Handlers only — key never exposed to the browser. |
| Voice | ElevenLabs API (TTS) + Web Speech API (STT) | ElevenLabs for Claude's realistic 12-year-old voice output; Web Speech API for user mic input (browser-native, no cost). Both streamed where possible. |
| Hosting | Vercel | Zero-config deploys from GitHub, first-class Next.js support, streaming responses work out of the box. |
| Language | TypeScript throughout | Single language across the stack. |

### What not to use (and why)
- **Separate Express/Fastify backend** — Next.js Route Handlers replace this. Two deployments for no benefit.
- **Firebase/Firestore** — NoSQL is wrong for this data shape. Querying ordered messages per session is trivial in Postgres, painful in Firestore.
- **GraphQL / tRPC** — 4 tables and ~6 endpoints. REST route handlers are the right fit.
- **Redux** — Use React Context or Zustand if needed. Redux is overkill.
- **Prisma** — Supabase already provides a typed client. The ORM abstraction adds complexity without payoff here.
- **Docker / Kubernetes** — Vercel removes the need entirely.

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
users          — id, email, plan ('free'|'pro'), sessions_this_month, created_at
sessions       — id, user_id, topic, started_at, ended_at
messages       — id, session_id, role (user|assistant), content, created_at
reviews        — id, session_id, report_json, created_at
```

The `plan` and `sessions_this_month` fields are set manually via Supabase for MVP — no Stripe integration yet. Design supports tiered billing without requiring it at launch.

## MVP Scope

### In scope
- Email/password auth
- Start a session with a topic
- Chat UI — text input + voice input (STT), Claude responds in text + ElevenLabs audio
- End session → trigger review generation
- Review report: gaps, jargon, unanswered questions, suggestions
- Session history with past reviews
- Usage limits enforced server-side (3 sessions/month on free tier)
- `plan` field in DB, manually upgradeable to 'pro' via Supabase dashboard

### Explicitly out of scope (do not add)
- Stripe integration or any automated billing
- Pricing / upgrade page (post-MVP)
- Billing portal or invoice emails
- Spaced repetition or study scheduling
- Topic suggestions or curriculum maps
- Scoring, grades, or gamification
- Social / collaborative sessions
- Native mobile app
- OAuth / SSO (add post-MVP)
- External resource recommendations

## Monetization

### MVP approach — manual tier management
- All users start on `free` plan: **3 sessions/month** hard cap
- Cap is enforced server-side before a session starts (check `sessions_this_month` against plan limit)
- To upgrade a user to `pro`: flip `plan = 'pro'` directly in Supabase — no code change needed
- Reset `sessions_this_month` to 0 at the start of each calendar month (cron job or Supabase scheduled function)

### Tier limits
| Plan | Sessions/month | Notes |
|------|---------------|-------|
| free | 3 | Default for all new users |
| pro | Unlimited | Manual upgrade for MVP; Stripe in v1.1 |

### Post-MVP — add Stripe in v1.1
Build Stripe integration only after users start hitting the free limit and requesting more. That usage signal validates pricing before you invest in billing infrastructure.

Do not add a pricing page, upgrade flow, or Stripe webhooks until v1.1.

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
