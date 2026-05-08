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

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Auth Pages  │  │  Dashboard   │  │   Session Page   │  │
│  │  (login /   │  │  (history +  │  │  (active chat)   │  │
│  │   signup)   │  │   reviews)   │  │                  │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│                                             │               │
│                          ┌──────────────────┤               │
│                          │                  │               │
│                   ┌──────▼──────┐  ┌───────▼───────┐      │
│                   │VoiceRecorder│  │  AudioPlayer  │      │
│                   │(Web Speech  │  │ (ElevenLabs   │      │
│                   │    API)     │  │  audio stream)│      │
│                   └─────────────┘  └───────────────┘      │
│                                                             │
│  State: React local state + Supabase client (auth only)    │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────┐
│                  NEXT.JS SERVER (Vercel)                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Route Handlers                      │  │
│  │                                                       │  │
│  │  POST /api/sessions          — create session         │  │
│  │  POST /api/sessions/[id]/end — end session            │  │
│  │  POST /api/chat              — stream Claude reply    │  │
│  │  POST /api/audio             — proxy ElevenLabs TTS  │  │
│  │  GET  /api/sessions          — list user sessions     │  │
│  │  GET  /api/sessions/[id]     — session + messages     │  │
│  │  GET  /api/sessions/[id]/review — fetch review        │  │
│  └───────┬────────────────┬─────────────────┬────────────┘  │
│          │                │                 │               │
│   Business logic lives here — never in the browser          │
└──────────┼────────────────┼─────────────────┼───────────────┘
           │                │                 │
     ┌─────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
     │  Supabase  │  │ Claude API  │  │ ElevenLabs  │
     │  Postgres  │  │ (Anthropic) │  │    API      │
     │  + Auth    │  │             │  │             │
     └────────────┘  └─────────────┘  └─────────────┘
```

### Data Flow

**1. Auth**
```
Browser → Supabase Auth (email/password)
       ← JWT stored in httpOnly cookie
```

**2. Start a session**
```
Browser  →  POST /api/sessions { topic }
Server   →  check users.sessions_this_month < plan limit
         →  INSERT into sessions
         →  increment sessions_this_month
Browser  ←  { session_id }
```

**3. Chat turn**
```
Browser  →  POST /api/chat { session_id, message }
Server   →  INSERT message (role: user) into messages
         →  fetch full message history for session
         →  call Claude API (stream) → stream chunks to browser
         →  INSERT complete response (role: assistant) into messages

Browser  →  POST /api/audio { text } (parallel, once text starts)
Server   →  call ElevenLabs API (stream)
Browser  ←  audio stream (plays as it arrives)
```

**4. End session + review**
```
Browser  →  POST /api/sessions/[id]/end
Server   →  UPDATE sessions SET ended_at = now()
         →  fetch all messages for session
         →  call Claude API (not streamed) with analytical reviewer prompt
         →  INSERT result into reviews
Browser  ←  { review_id }
```

**5. View review**
```
Browser  →  GET /api/sessions/[id]/review
Server   →  fetch review (RLS verifies ownership)
Browser  ←  review JSON → rendered as report
```

### API Boundaries

**Server-side only — never expose to browser:**
- `ANTHROPIC_API_KEY` — all Claude calls go through Route Handlers
- `ELEVENLABS_API_KEY` — all TTS calls proxied through Route Handlers
- `SUPABASE_SERVICE_ROLE_KEY` — all writes use service role
- Session limit enforcement — checked before any session is created
- Prompt construction — persona and reviewer prompts live in server code

**Client-side (Supabase anon key + RLS):**
- Auth state and session token management
- Read-only queries for own data, protected by Row Level Security
- No writes — all mutations go through Route Handlers

**The rule:** if it touches an API key or enforces a business rule, it runs on the server.

### Where State Lives

| State | Lives In |
|-------|----------|
| Auth / user identity | Supabase client (httpOnly cookie) |
| Active chat messages | React local state (loaded from DB on mount, accumulated during session) |
| Is-recording / is-playing | React local state (component level) |
| Session history | Server-fetched on dashboard mount |
| Review report | Server-fetched on review page mount |
| Usage counter | Supabase DB (`sessions_this_month`) — source of truth is always the DB |

No global state manager. React Context for auth propagation only. Add Zustand only if prop drilling becomes painful.

### Business Logic Placement

```
Route Handlers (server)          React components (client)
─────────────────────────        ─────────────────────────
Session limit enforcement        Form validation (UX only)
Prompt construction              Voice recording state
Message persistence              Audio playback state
Review generation trigger        Loading / error states
Usage counter increments         Navigation
Auth token verification          Rendering
```

### Two-Prompt Design

Do not collapse these into one system prompt — they are separate Claude calls with different roles:

**Call 1 — Chat (streaming, called per user message)**
```
System:   "You are a curious, enthusiastic 12-year-old named Felix..."
Messages: full conversation history
Stream:   yes
```

**Call 2 — Review (not streamed, called once at session end)**
```
System:   "You are an expert learning coach. Analyse this teaching transcript..."
Messages: full session transcript
Stream:   no — wait for complete structured JSON response
Output:   { gaps: [], jargon: [], unclear: [], suggestions: [] }
```

Define the review JSON schema upfront so the review page renders predictably.

### Voice

- **User input (STT):** Web Speech API (browser-native, no cost)
- **Claude output (TTS):** ElevenLabs API — stream audio, start playback as bytes arrive, kick off the request as soon as the first Claude text chunk lands to minimise latency

### Scaling Notes (MVP)

Vercel handles horizontal scaling; Supabase handles connection pooling and auth at scale. Two real risks to watch:

1. **API costs** — session limit (3/month free) is the primary control. Add a soft per-session message cap (e.g. 50 messages) at pro tier to prevent runaway costs.
2. **ElevenLabs latency** — TTS generation adds ~500ms–1s. Mitigate with streaming playback and early request dispatch.

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
