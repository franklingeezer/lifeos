<div align="center">

# 🧠 LifeOS

### Your Personal Operating System

*A single-user, AI-assisted productivity app that connects tasks, projects, notes, journals, habits, finance, learning, media, and ideas into one workspace instead of a pile of disconnected tools.*

---

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![SWR](https://img.shields.io/badge/Data%20layer-SWR-orange)
![Status](https://img.shields.io/badge/Status-Active%20Development-success)

</div>

---

# ✨ Vision

LifeOS isn't another to-do app.

It's a personal, single-user operating system that combines productivity, journaling, habits, finance, learning, and AI into one connected workspace — built for one person, running on infrastructure that person actually controls.

Every module works on its own. The goal is for them to increasingly understand each other too, so the system reflects real life instead of a dozen isolated spreadsheets.

---

# 🔐 Security

LifeOS is single-user by design — no public sign-up. Every table is locked down with Postgres Row-Level Security scoped to `auth.uid()`, so even the public API key can't touch another account's data (not that there's meant to be one).

- Real Supabase Auth login, with session-refresh middleware
- Full forgot-password flow (email reset link → callback → set new password)
- Rate limiting on every AI route (15 requests / 10 min, shared across all five) so a stray loop can't burn through the Groq quota

---

# 🚀 Features

## Dashboard
Daily priorities, AI Morning Brief, habit progress, active projects, this week's calendar, finance snapshot, and recent notes — all live data, no mock content.

## Projects
Project management with status, priority, deadlines, and progress. Linked tasks show up on the project itself, with a live "X of Y done" count alongside the manual progress slider — informational, never overriding your own control.

## Tasks
Kanban board (swipeable on mobile) and list view, priorities, due dates, subtasks, full-text search, and optional project linking. Command Palette (`Ctrl/Cmd+K`) can create a task instantly from anywhere with `task: ___`.

## Calendar
Monthly view, event management, color coding.

## Notes
Markdown notes with folders, tags, pinning, and full-text search. Mobile gets a proper master-detail layout (list → tap → editor, with a back button) instead of squeezing both panes together. Quick-create from the Command Palette with `note: ___`.

## Journal
Daily entries — Mood, Energy, Stress (custom gradient-track scale, not emoji), Wins, Failures, Lessons, Tomorrow's Goals, Gratitude.

## Habits
Daily check-in tracking, streaks, longest streak, 30-day success rate, color-coded.

## Finance
Income, expenses, savings, investments, monthly breakdown, category charts, and a separate Debts & Loans panel (who owes who, settle tracking). Currency symbol is a real Settings-driven value used consistently everywhere, not hard-coded.

## Learning
Track courses, study hours, completion status, certificates.

## Media Vault
Store images, videos, and documents via Supabase Storage, with tags and captions.

## Idea Vault
Capture ideas through a real pipeline — **Spark → Developing → Validated → Archived** — with potential rating and tags. A **validated** idea can be converted into a real Project in one click, carrying its title and description over and staying linked to the original idea.

## AI Assistant
Five focused tools, not one AI dumped into a chat box:
- **Morning Brief** — a short daily summary with history you can browse
- **Ask LifeOS** — natural-language search across your own data
- **Review** — weekly/monthly summaries of what actually happened
- **Prioritize** — suggests task priority changes you review and apply (or don't)
- **Journal Insights** — finds real patterns across entries, including habit-mood correlations *only* when there's genuinely enough data to say so honestly

## Analytics
Live charts across tasks, finance, habits, projects, and ideas — including a **habit ↔ mood correlation** card that compares average mood on days a habit was done vs. skipped, gated behind a minimum sample size so it never shows a misleading pattern from too little data.

## Command Palette
Global `Ctrl/Cmd+K` search across Tasks, Notes, Projects, Habits, Learning, Idea Vault, and Calendar events — full keyboard navigation, plus inline quick-create commands (`task:`, `note:`) that create something instantly without leaving wherever you are.

## Data Export
One-click JSON backup of everything — Tasks, Projects, Notes, Habits, Finance, Debts, Calendar, Journal, Learning, Media metadata, and Ideas — independent of Supabase, from Settings.

---

# 🧠 AI Philosophy

> **AI should reduce busywork, not replace thinking — and it should never invent what it doesn't actually know.**

Every LifeOS feature works completely without AI. Where AI is used (Groq, `llama-3.3-70b-versatile`), it's held to a strict grounding standard — Journal Insights, for example, is explicitly forbidden from attributing a mood shift to any cause that isn't literally present in the entry text or habit data for that date. No invented causal stories, no forced patterns from thin data.

---

# 🔗 Deep Module Relationships

LifeOS is gradually moving from "a set of connected pages" toward modules that actually understand each other:

- **Project ↔ Tasks** — link tasks to a project; see linked-task progress on the project itself
- **Idea Vault → Project** — convert a validated idea into a real project in one click
- **Journal ↔ Habits ↔ Analytics** — habit completion data feeds both the Analytics correlation chart and the AI's Journal Insights, with matching sample-size honesty between the two

More relationships (Notes ↔ Projects, Calendar ↔ Projects, Tasks ↔ Calendar) are on the roadmap.

---

# 📱 Mobile

Every page works properly at phone width — not just "doesn't break," but actually designed for it: a slide-in nav drawer replaces the desktop rail, Tasks' kanban becomes swipeable with tappable column tabs, Notes/Journal use a real mobile master-detail pattern, and every modal/drawer fits within a narrow screen without overflowing.

---

# 🔔 PWA & Push Notifications

LifeOS installs like a real app — on Android via Chrome's install prompt, on iOS via Safari's "Add to Home Screen" (Apple requires the app to actually be installed before it'll grant push permission, so on iOS notifications only work once it's on your home screen).

- **Offline app shell** — a hand-rolled service worker (not `next-pwa`, kept consistent with the rest of the codebase's "own the code" approach) caches the static shell and shows a proper offline page instead of a browser error when you lose connection. Your actual data is deliberately never cached this way — Supabase reads/writes always go live, so you never see stale personal data offline.
- **Web Push** — reminders and overdue-task alerts reach you even when LifeOS is closed, via VAPID-signed push and a `push_subscriptions` table (RLS-scoped like everything else). Each browser/device gets its own subscription, manageable from Settings.
- **Delivery** — a cron-triggered route checks for anything due and pushes it. Vercel's free Hobby plan only allows once-daily cron jobs, so the actual every-few-minutes trigger runs via a free GitHub Actions workflow instead, with Vercel's own cron kept as a once-a-day fallback.

---

# 🏗 Architecture

```
LifeOS
├── Dashboard
├── Projects        ←→ Tasks
├── Tasks
├── Calendar
├── Notes
├── Journal          ←→ Habits ←→ Analytics
├── Habits
├── Finance
│   └── Debts & Loans
├── Learning
├── Media Vault
├── Idea Vault       → Projects
├── Analytics
├── Settings
└── AI Assistant
    ├── Morning Brief
    ├── Ask LifeOS
    ├── Review
    ├── Prioritize
    └── Journal Insights
```

---

# 🛠 Tech Stack

**Frontend** — Next.js 14 (App Router), TypeScript, React 18. Styling is mostly inline styles driven by CSS custom properties (theme tokens for dark/light), not a component library — deliberately, for full control over the look.

**Data layer** — [SWR](https://swr.vercel.app/) with one dedicated hook per resource (`useTasks`, `useFinance`, `useHabits`, etc.), typed data, optimistic updates with rollback on failure, and shared caching so navigating between pages doesn't refetch from scratch.

**Backend** — Supabase (Postgres + Auth + Storage), Row-Level Security on every table.

**AI** — Groq (`llama-3.3-70b-versatile`) via direct API calls from Next.js Route Handlers, with server-side rate limiting.

**Charts** — Recharts. **Icons** — Lucide.

---

# ▶️ Getting Started

```bash
git clone https://github.com/franklingeezer/lifeos.git
cd lifeos
npm install
cp .env.example .env.local   # fill in your Supabase + Groq keys
npm run dev
```

For Web Push (optional — the app works fully without it), also generate a VAPID keypair with `npx web-push generate-vapid-keys` and add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`. Push notifications only work on a real HTTPS deployment, and delivery needs `CRON_SECRET` plus a scheduled trigger — see `.github/workflows/push-cron.yml`.

Run the SQL files in `supabase/` (in numeric/phase order) against your Supabase project before first use — they set up every table, RLS policy, and the auth lockdown. You'll also need to create your one Supabase Auth user manually under Authentication → Users, since there's no public sign-up.

---

# 📈 Roadmap

## Completed
Dashboard · Projects · Tasks · Calendar · Notes · Journal · Habits · Finance · Debts & Loans · Learning · Media Vault · Idea Vault · Analytics · Settings · full Auth/RLS lockdown · forgot-password flow · SWR data-layer migration (all 11 core modules) · Command Palette with quick-create actions · AI Assistant (all 5 tools) · full mobile responsiveness pass · currency symbol wired app-wide · AI route rate limiting · data export · Project ↔ Tasks · Idea Vault → Project · Journal ↔ Habits ↔ Analytics · deployed to Vercel · installable PWA with offline app-shell caching · Web Push notifications for due reminders and overdue tasks (VAPID + service worker, delivered via a free GitHub Actions cron since Vercel Hobby caps cron to once daily)

## In Progress
Ironing out remaining mobile-width overflow on a couple of pages (Calendar month grid, Notes editor)

## Planned
More deep module relationships (Notes ↔ Projects, Calendar ↔ Projects, Tasks ↔ Calendar, Learning ↔ Projects) · context-aware AI reasoning across the full connected graph

---

# 🎯 Long-Term Vision

The end goal isn't more modules — it's modules that understand each other, so LifeOS can eventually answer something like *"what should I focus on today?"* by actually reasoning over deadlines, project state, habits, and recent journal context together, instead of showing isolated charts per module.

---

# 🤝 Contributing

This is a personal, single-user project — but suggestions and feedback are always welcome via issues.

---

# 📄 License

MIT License

---

<div align="center">

**Built with Next.js, Supabase, TypeScript, and Claude.**

</div>
