<div align="center">

# 🧠 LifeOS

### Your Personal Operating System

A personal productivity system that brings tasks, projects, notes, journals, habits, finance, learning, ideas, media, analytics, and AI-powered insights into one place.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38BDF8?logo=tailwindcss)
![Status](https://img.shields.io/badge/Status-Active%20Development-success)

</div>

---

## 🌌 About

**LifeOS** is a personal operating system designed to bring different areas of everyday life into a single connected workspace.

Instead of managing tasks, projects, notes, journals, habits, finances, learning, ideas, and media across multiple applications, LifeOS puts them together in one system.

The long-term goal is simple:

> **LifeOS doesn't just store your life. It helps you understand it.**

---

## ✨ Core Idea

LifeOS is built around three principles:

1. **Build the system first.**
2. **Keep every module useful on its own.**
3. **Use AI to make the system smarter, not more complicated.**

AI is an assistant layer on top of the core system.

It helps with searching, summarizing, prioritizing, and discovering patterns while keeping the user in control.

---

# 🚧 Current Status

LifeOS is actively under development.

### Core Platform

- [x] Dashboard
- [x] Projects
- [x] Tasks
- [x] Calendar
- [x] Notes
- [x] Journal
- [x] Habits
- [x] Finance
- [x] Learning
- [x] Media Vault
- [x] Idea Vault
- [x] Analytics
- [x] Settings
- [x] Responsive / Mobile Design

### Authentication

- [x] Login page
- [x] Supabase authentication
- [x] Single-user account
- [ ] Complete RLS hardening
- [ ] Full authentication/security testing

### AI Assistant

- [x] Morning Brief
- [x] Natural Search
- [x] Task Prioritization
- [x] Journal Insights
- [x] Weekly Review
- [ ] Project Plan Suggestions
- [ ] Deeper cross-module AI context

---

# 🧩 Modules

## 🏠 Dashboard

The central overview of LifeOS.

The dashboard currently brings together:

- Today's priorities
- Active projects
- Habit progress
- Finance summary
- Project progress
- Weekly overview
- Recent notes
- AI Morning Brief

The goal is to make the dashboard the first place to understand what needs attention.

---

## 📁 Projects

Manage personal, academic, and professional projects.

Features include:

- Project creation
- Project descriptions
- Progress tracking
- Status
- Search
- Active/completed projects
- GitHub/project references

Example project states can include:

- Active
- Completed
- Archived

---

## ✅ Tasks

A task management system with both Kanban and List views.

Features include:

- Task creation
- Status
- Priority
- Due dates
- Search
- Subtasks
- Completion tracking
- Kanban board
- List view

AI-powered task prioritization is also available through the AI Assistant.

---

## 📅 Calendar

A dedicated calendar for managing events and important dates.

Features include:

- Monthly calendar
- Event creation
- Scheduled tasks
- Project-related events
- Deadlines
- Navigation between months

---

## 📝 Notes

A personal note-taking and knowledge area.

Features include:

- Create notes
- Edit notes
- Search
- Tags
- Pinning
- Note organization

Notes can also be searched using LifeOS Natural Search.

---

## 📔 Journal

A structured daily reflection system.

Journal entries can contain:

- Mood
- Energy
- Stress
- Today's wins
- Today's failures
- Lessons learned
- Tomorrow's goals
- Gratitude

The journal also provides data for AI-powered insights and weekly reviews.

---

## 🔥 Habits

Track recurring habits and consistency.

Features include:

- Habit creation
- Daily tracking
- Streaks
- Longest streak
- Completion rate
- Historical visualization

---

## 💰 Finance

A personal finance management module.

Track:

- Income
- Expenses
- Savings
- Investments
- Debts
- Loans
- Categories
- Transactions

Finance analytics provide visual summaries of spending and income.

---

## 📚 Learning

Track courses, skills, and learning progress.

Features include:

- Learning items
- Categories
- Progress
- Study hours
- Completion status

---

## 🎬 Media Vault

A personal media library for storing and organizing files.

Supports:

- Images
- Videos
- Documents
- Other files
- Tags
- Search

The Media Vault can be used for personal assets, project materials, references, and inspiration.

---

## 💡 Idea Vault

A dedicated place for capturing and developing ideas.

Ideas can move through different stages:

```text
💭 Spark
   ↓
🛠️ Developing
   ↓
✅ Validated
   ↓
📦 Archived
```

Ideas can contain:

- Title
- Description
- Rating
- Tags
- Category
- Status

The goal is to turn random thoughts into actionable projects.

---

# 🤖 AI Assistant

The AI Assistant is one of the major features of LifeOS.

It is designed to work with the user's existing LifeOS data rather than functioning as a generic chatbot.

Current AI capabilities include:

---

## 🌅 Morning Brief

Generates a personalized overview based on available LifeOS information.

It can consider:

- Tasks
- Projects
- Habits
- Recent activity
- Journal information
- Other relevant data

The goal is to answer:

> **What actually matters today?**

---

## 🔎 Natural Search

Natural Search allows users to search LifeOS using normal language instead of exact keywords.

Examples:

```text
Show me my active projects.

What did I write about productivity recently?

Find my unfinished tasks.

What was I working on yesterday?

Show me everything related to LifeOS.
```

The goal is to make the user's own data accessible through natural conversation.

---

## 🎯 Task Prioritization

AI can analyze existing tasks and suggest which tasks deserve attention first.

Instead of simply sorting tasks by date, the system can consider available task context and provide a more meaningful priority recommendation.

---

## 🔍 Journal Insights

AI Journal Insights analyze journal information to identify recurring themes and patterns.

Potential insights include:

- Recurring topics
- Productivity patterns
- Common challenges
- Positive progress
- Reflection patterns
- Changes over time

The goal is to help the user understand their own history.

---

## 📊 Weekly Review

The Weekly Review summarizes the user's week using information from LifeOS.

It can bring together:

- Tasks
- Projects
- Habits
- Journal
- Learning
- Finance
- Activity

The goal is to answer:

> **What happened this week?**

> **What went well?**

> **What didn't?**

> **What should I focus on next?**

---

# 📊 Analytics

LifeOS includes an analytics module for turning activity data into visual information.

Current analytics include:

- Task completion
- Habit performance
- Finance
- Mood
- Energy
- Stress
- Project activity
- Idea Vault pipeline

The long-term purpose of Analytics is to help answer:

> **How am I actually doing?**

rather than simply showing raw data.

---

# 📱 Responsive Design

LifeOS is designed to work across different screen sizes.

Supported layouts include:

- Desktop
- Laptop
- Tablet
- Mobile

The interface adapts:

- Navigation
- Cards
- Grids
- Forms
- Charts
- Tables
- Module layouts

while maintaining the overall LifeOS visual identity.

---

# 🔐 Authentication

LifeOS currently uses a **single-user authentication model**.

A personal account is stored through Supabase Authentication and the application includes a dedicated login page.

The current flow is:

```text
Login Page
    ↓
Supabase Authentication
    ↓
Authenticated Session
    ↓
LifeOS
```

The project is currently designed primarily for personal use.

Multi-user functionality is not currently the goal.

---

# 🛡️ Security

LifeOS uses Supabase and PostgreSQL as its backend infrastructure.

Security work includes:

- Supabase Authentication
- PostgreSQL
- Row Level Security
- User ownership
- Protected routes
- Environment variables
- Server-side operations

The intended ownership model is:

```text
Authenticated User
       ↓
   auth.uid()
       ↓
    user_id
       ↓
User-owned data
```

Security and RLS hardening remain part of the ongoing development process.

---

# 🏗️ Architecture

LifeOS follows a modular architecture.

```text
LifeOS
│
├── Dashboard
│
├── Productivity
│   ├── Tasks
│   ├── Projects
│   └── Calendar
│
├── Personal
│   ├── Notes
│   ├── Journal
│   └── Habits
│
├── Growth
│   └── Learning
│
├── Finance
│   └── Finance
│
├── Creativity
│   ├── Idea Vault
│   └── Media Vault
│
├── Intelligence
│   ├── Morning Brief
│   ├── Natural Search
│   ├── Task Prioritization
│   ├── Journal Insights
│   └── Weekly Review
│
└── Analytics
```

The general data flow is:

```text
User
 ↓
LifeOS UI
 ↓
Components
 ↓
Hooks / Application Logic
 ↓
Supabase
 ↓
PostgreSQL
```

AI functionality operates through server-side application logic.

---

# 🛠️ Tech Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Lucide Icons

## Backend

- Supabase
- PostgreSQL
- Supabase Authentication
- Supabase Storage

## Data & State

- Supabase Client
- Zustand
- SWR
- React Hook Form
- Zod

## Visualization

- Recharts

## AI

- LLM-powered server-side AI
- Structured prompts
- Application-aware context
- AI-generated summaries and recommendations

---

# ⚙️ Getting Started

## Requirements

Before running LifeOS, make sure you have:

- Node.js 18+
- npm
- A Supabase project
- Required AI API credentials

---

## Clone the Repository

```bash
git clone https://github.com/franklingeezer/lifeos.git
cd lifeos
```

---

## Install Dependencies

```bash
npm install
```

---

## Environment Variables

Create a `.env.local` file in the project root.

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

AI_API_KEY=your_ai_provider_key
```

Never commit `.env.local` or private API keys to GitHub.

---

## Run the Development Server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

# 🗄️ Database

LifeOS uses PostgreSQL through Supabase.

The database supports the major LifeOS modules including:

- Users / Authentication
- Projects
- Tasks
- Subtasks
- Calendar
- Notes
- Journal
- Habits
- Habit Logs
- Finance
- Learning
- Media
- Ideas
- AI outputs
- Reviews
- Settings

Database structure and security are continuously being refined as development progresses.

---

# 🗺️ Roadmap

## Core System

- [x] Dashboard
- [x] Projects
- [x] Tasks
- [x] Calendar
- [x] Notes
- [x] Journal
- [x] Habits
- [x] Finance
- [x] Learning
- [x] Media Vault
- [x] Idea Vault
- [x] Analytics
- [x] Settings
- [x] Mobile responsiveness

## Authentication

- [x] Login page
- [x] Supabase authentication
- [x] Single-user account
- [ ] RLS hardening
- [ ] Security testing

## AI

- [x] Morning Brief
- [x] Natural Search
- [x] Task Prioritization
- [x] Journal Insights
- [x] Weekly Review
- [ ] Project Plan Suggestions
- [ ] More contextual AI

## Connected LifeOS

- [ ] Project ↔ Tasks
- [ ] Project ↔ Notes
- [ ] Project ↔ Calendar
- [ ] Project ↔ Media
- [ ] Project ↔ Finance
- [ ] Journal ↔ Projects
- [ ] Learning ↔ Projects
- [ ] Ideas ↔ Projects

## Future Intelligence

- [ ] Personal AI memory
- [ ] Cross-module insights
- [ ] Semantic search improvements
- [ ] Life Timeline
- [ ] Knowledge Graph

## Future Experience

- [ ] Command Palette
- [ ] Keyboard shortcuts
- [ ] Dashboard customization
- [ ] Focus Mode
- [ ] Offline support

---

# 🧭 Long-Term Vision

The ultimate goal of LifeOS is to create a system where different parts of life can understand and relate to one another.

For example:

```text
Projects
   +
Tasks
   +
Calendar
   +
Notes
   +
Journal
   +
Habits
   +
Learning
   +
Finance
```

could eventually become one connected personal context.

Instead of asking:

> "Where did I write that?"

you could ask:

> "What was I working on before my exams?"

Instead of looking at individual statistics, you could ask:

> "Why was I less productive last week?"

And instead of simply storing journal entries:

> "What patterns have I developed over the last few months?"

That is the direction LifeOS is heading.

---

# 🎯 Development Philosophy

LifeOS follows a simple principle:

> **Build the foundation first. Make it intelligent second.**

The core application should remain useful without AI.

AI should enhance the system rather than become a gimmick.

The focus is therefore:

**Useful → Connected → Intelligent**

rather than:

**AI → Everything**

---

# 📌 Current Focus

The current development focus is:

### 🔐 Authentication & Security

The login system and single-user authentication flow are already implemented.

The next layer is strengthening:

- User ownership
- RLS policies
- Protected data
- Authentication edge cases
- Session handling

After that, development will move toward deeper connections between existing LifeOS modules.

---

# 🤝 Project

LifeOS is currently a personal development project.

It is being built as an exploration of:

- Full-stack development
- Personal productivity systems
- AI integration
- Data visualization
- Database architecture
- Authentication
- Modern UI/UX

The project is continuously evolving.

---

# 📄 License

MIT License

---

<div align="center">

# 🧠 LifeOS

### A Personal Operating System for your life.

**Built with Next.js, TypeScript, Supabase, PostgreSQL, Tailwind CSS, and AI.**

⭐ If you find the project interesting, consider starring the repository.

</div>
