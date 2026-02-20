# Voice AI Performance Optimizer

A full-stack application that implements a **Validation Flywheel** for optimizing Voice AI agent prompts. It analyzes prompts, generates test cases, executes tests, evaluates results, and refines prompts using an LLM — all in an automated loop.

Built with **Express.js + TypeScript** (backend) and **React 18 + TypeScript + Vite** (frontend).

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Running the Application](#running-the-application)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Frontend Components](#frontend-components)
- [Backend Services](#backend-services)
- [How It Works — The Validation Flywheel](#how-it-works--the-validation-flywheel)
- [Widget Embedding](#widget-embedding)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  HighLevel Platform                  │
│  ┌──────────────┐          ┌──────────────────────┐ │
│  │ HighLevel UI │          │   HighLevel API      │ │
│  └──────┬───────┘          └──────────▲───────────┘ │
└─────────┼─────────────────────────────┼─────────────┘
          │ widget-injector.js          │
          ▼                             │
┌─────────────────────┐    ┌────────────┴──────────────┐
│   React Frontend    │    │    Express.js Backend      │
│                     │    │                            │
│  AgentSelector      │    │  PromptAnalyzer            │
│  PromptAnalysisView │◄──►│  TestGenerator             │
│  TestSuiteEditor    │REST│  TestExecutor ─────────────┼──► HighLevel API
│  TestRunView        │    │  ResultEvaluator            │
│  PromptDiffView     │    │  PromptOptimizer            │
│  ResultsDashboard   │    │  CycleOrchestrator          │
│  BeforeAfterView    │SSE │                            │
│  CycleControlPanel  │◄───│  SQLite Database           │
└─────────────────────┘    │                            │
                           │  LLM Service (OpenAI)      │
                           └────────────────────────────┘
```

Communication: REST for request-response, SSE (Server-Sent Events) for real-time cycle progress.

---

## Tech Stack

| Layer    | Technology                                      |
|----------|------------------------------------------------|
| Frontend | React 18, TypeScript, Vite                      |
| Backend  | Express.js, TypeScript, Node.js                 |
| Database | SQLite (better-sqlite3)                         |
| LLM      | OpenAI API (GPT-4) with mock fallback           |
| Styling  | Plain CSS (no frameworks)                       |
| Testing  | Vitest, fast-check, React Testing Library       |

---

## Project Structure

```
voice-ai-performance-optimizer/
├── backend/
│   ├── src/
│   │   ├── index.ts                    # Express app entry point
│   │   ├── database.ts                 # SQLite schema & migrations
│   │   ├── types.ts                    # Domain interfaces
│   │   ├── routes/
│   │   │   ├── agents.ts              # Agent CRUD + comparison
│   │   │   ├── analysis.ts            # Prompt analysis endpoint
│   │   │   ├── test-suites.ts         # Test suite CRUD
│   │   │   ├── test-runs.ts           # Test execution endpoints
│   │   │   ├── optimize.ts            # Optimization endpoints
│   │   │   └── cycles.ts             # Auto-cycle + SSE endpoints
│   │   ├── services/
│   │   │   ├── llm-service.ts         # LLM interface + OpenAI impl
│   │   │   ├── llm-service-factory.ts # Mock LLM + factory
│   │   │   ├── prompt-templates.ts    # Structured LLM prompts
│   │   │   ├── prompt-analyzer.ts     # Prompt analysis service
│   │   │   ├── test-generator.ts      # Test case generation
│   │   │   ├── test-executor.ts       # Test execution (mock HighLevel)
│   │   │   ├── result-evaluator.ts    # LLM-based criterion evaluation
│   │   │   ├── prompt-optimizer.ts    # Prompt optimization
│   │   │   ├── comparison-builder.ts  # Before/after comparison
│   │   │   ├── dashboard-builder.ts   # Dashboard data aggregation
│   │   │   └── cycle-orchestrator.ts  # Auto-cycle loop + SSE
│   │   └── utils/
│   │       ├── pass-rate.ts           # Pass rate calculation
│   │       ├── diff.ts               # LCS-based line diff
│   │       └── state-machine.ts       # Status state machines
│   ├── data/                          # SQLite database files
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx                   # React entry point
│   │   ├── App.tsx                    # Tab navigation shell
│   │   ├── api.ts                     # Fetch-based API client
│   │   ├── index.css                  # Global styles
│   │   ├── utils/
│   │   │   └── state.ts              # localStorage persistence
│   │   └── components/
│   │       ├── AgentSelector.tsx
│   │       ├── PromptAnalysisView.tsx
│   │       ├── TestSuiteEditor.tsx
│   │       ├── TestRunView.tsx
│   │       ├── PromptDiffView.tsx
│   │       ├── ResultsDashboard.tsx
│   │       ├── BeforeAfterView.tsx
│   │       └── CycleControlPanel.tsx
│   ├── public/
│   │   └── widget-injector.js         # Shadow DOM widget loader
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

---

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **OpenAI API key** (optional — the app includes a mock LLM service for development)

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd voice-ai-performance-optimizer
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
```

### 4. Configure environment (optional)

Create a `.env` file in the `backend/` directory if you want to use a real OpenAI API:

```bash
# backend/.env
OPENAI_API_KEY=sk-your-api-key-here
LLM_PROVIDER=openai
PORT=3000
```

If no `OPENAI_API_KEY` is set, the app automatically uses the **mock LLM service** which returns realistic fake responses — perfect for development and demos.

---

## Running the Application

### Start the backend

```bash
cd backend
npm run dev
```

The backend starts on `http://localhost:3000`. The SQLite database is auto-created at `backend/data/optimizer.db` on first run.

### Start the frontend

```bash
cd frontend
npm run dev
```

The frontend starts on `http://localhost:5173` with a Vite proxy forwarding `/api/*` requests to the backend at `localhost:3000`.

### Build for production

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm run preview
```

---

## Environment Variables

| Variable         | Default     | Description                                      |
|-----------------|-------------|--------------------------------------------------|
| `PORT`          | `3000`      | Backend server port                              |
| `DATABASE_PATH` | `./data/optimizer.db` | SQLite database file path              |
| `OPENAI_API_KEY`| _(none)_    | OpenAI API key. If unset, uses mock LLM service  |
| `LLM_PROVIDER`  | `mock`      | LLM provider: `openai` or `mock`                 |

---

## API Endpoints

| Method | Endpoint                          | Description                              |
|--------|-----------------------------------|------------------------------------------|
| GET    | `/api/health`                     | Health check                             |
| GET    | `/api/agents`                     | List available Voice AI agents           |
| GET    | `/api/agents/:id/prompt`          | Get agent's base prompt                  |
| PUT    | `/api/agents/:id/prompt`          | Update agent's base prompt               |
| GET    | `/api/agents/:id/comparison`      | Get before/after comparison data         |
| POST   | `/api/analysis`                   | Trigger prompt analysis for an agent     |
| POST   | `/api/test-suites`                | Create test suite (generates test cases) |
| GET    | `/api/test-suites/:id`            | Retrieve a test suite                    |
| PUT    | `/api/test-suites/:id`            | Update test cases / criteria             |
| POST   | `/api/test-runs`                  | Execute a test run                       |
| GET    | `/api/test-runs/:id`              | Get test run results                     |
| POST   | `/api/test-runs/:id/retry/:caseId`| Retry a failed test case                |
| POST   | `/api/optimize`                   | Generate optimized prompt                |
| POST   | `/api/optimize/:id/apply`         | Apply optimized prompt to agent          |
| POST   | `/api/cycles`                     | Start an auto-optimization cycle         |
| GET    | `/api/cycles/:id`                 | Get cycle status                         |
| POST   | `/api/cycles/:id/cancel`          | Cancel a running cycle                   |
| GET    | `/api/cycles/:id/events`          | SSE stream for real-time cycle progress  |

---

## Database Schema

SQLite with 10 tables, auto-created on startup:

| Table              | Purpose                                           |
|--------------------|---------------------------------------------------|
| `Agent`            | Voice AI agents with current and original prompts  |
| `PromptAnalysis`   | Structured analysis results (goals, flows, behaviors) |
| `TestSuite`        | Groups of test cases linked to an analysis         |
| `TestCase`         | Individual test scenarios (happy-path / adversarial) |
| `SuccessCriterion` | Pass/fail criteria for each test case              |
| `TestRun`          | Execution records with overall pass rate           |
| `TestCaseResult`   | Per-test-case results with agent responses         |
| `CriterionResult`  | Per-criterion pass/fail with explanations          |
| `OptimizationRecord` | Generated prompt revisions with accept/reject status |
| `CycleRecord`      | Auto-cycle execution history and metrics           |

Key relationships:
- `Agent` → has many `PromptAnalysis`, `TestSuite`, `TestRun`, `CycleRecord`
- `TestSuite` → has many `TestCase` → each has many `SuccessCriterion`
- `TestRun` → has many `TestCaseResult` → each has many `CriterionResult`

---

## Frontend Components

| Component            | Tab       | Responsibility                                                |
|---------------------|-----------|---------------------------------------------------------------|
| `AgentSelector`      | Analyze   | Lists agents, allows selection                                |
| `PromptAnalysisView` | Analyze   | Displays goals, conversation flows, expected behaviors        |
| `TestSuiteEditor`    | Test      | CRUD for test cases and success criteria                      |
| `TestRunView`        | Test      | Execution progress, per-case results, retry for errors        |
| `PromptDiffView`     | Optimize  | Side-by-side diff with accept/reject/edit controls            |
| `CycleControlPanel`  | Optimize  | Auto-cycle config (threshold, max), start/pause/cancel, SSE   |
| `ResultsDashboard`   | Dashboard | Overall pass rate, per-criterion breakdown, trend across runs |
| `BeforeAfterView`    | Dashboard | Side-by-side prompt comparison with improvement highlights    |

State management: React hooks only (`useState`, `useEffect`, `useCallback`). Widget state persisted to `localStorage`.

---

## Backend Services

| Service               | Responsibility                                                    |
|-----------------------|-------------------------------------------------------------------|
| `PromptAnalyzer`      | Sends base prompt to LLM, extracts goals/flows/behaviors         |
| `TestGenerator`       | Generates test cases from analysis (min 5, mixed scenario types)  |
| `TestExecutor`        | Simulates conversations against Voice AI agent via HighLevel API  |
| `ResultEvaluator`     | LLM-based pass/fail evaluation for each success criterion         |
| `PromptOptimizer`     | Generates revised prompt targeting test failures                  |
| `CycleOrchestrator`   | Runs test→evaluate→optimize loop with SSE progress events         |
| `ComparisonBuilder`   | Builds before/after comparison with improvements/regressions      |
| `DashboardBuilder`    | Aggregates test run data for dashboard rendering                  |
| `LLMService`          | Abstraction over OpenAI with retry, backoff, JSON parsing         |
| `MockLLMService`      | Deterministic fake responses for development                      |

---

## How It Works — The Validation Flywheel

The core optimization loop follows these steps:

```
1. ANALYZE  →  Extract goals, flows, and behaviors from the agent's base prompt
       │
2. GENERATE →  Create test cases (happy-path + adversarial) with success criteria
       │
3. EXECUTE  →  Run test cases against the Voice AI agent, capture responses
       │
4. EVALUATE →  LLM judges each criterion as pass/fail with explanations
       │
5. OPTIMIZE →  LLM generates a revised prompt targeting failures
       │
6. REPEAT   →  Auto-cycle until pass rate meets threshold or max cycles reached
```

### Manual Flow
1. Select an agent in the **Analyze** tab
2. Run prompt analysis to see extracted goals and behaviors
3. Switch to **Test** tab — generate or edit test cases
4. Execute a test run and review results
5. Switch to **Optimize** tab — generate an optimized prompt
6. Review the diff, accept or reject changes
7. Check the **Dashboard** for metrics and before/after comparison

### Auto-Cycle Flow
1. Configure target pass rate threshold and max cycles in the **Optimize** tab
2. Click "Start Cycle" — the system runs the full loop automatically
3. Monitor real-time progress via SSE events
4. Pause or cancel at any time

---

## Widget Embedding

The frontend can be embedded into the HighLevel platform using the widget injector:

```html
<!-- Add to HighLevel custom code injection -->
<script src="https://your-domain.com/widget-injector.js"></script>
```

The injector creates a Shadow DOM container to isolate styles and loads the React app inside it. It passes HighLevel session context (auth token, location ID) to the app.

---

## Scripts Reference

### Backend

| Command           | Description                    |
|-------------------|--------------------------------|
| `npm run dev`     | Start dev server with ts-node  |
| `npm run build`   | Compile TypeScript to `dist/`  |
| `npm start`       | Run compiled production build  |
| `npm test`        | Run tests with Vitest          |

### Frontend

| Command           | Description                    |
|-------------------|--------------------------------|
| `npm run dev`     | Start Vite dev server          |
| `npm run build`   | Type-check + production build  |
| `npm run preview` | Preview production build       |
| `npm test`        | Run tests with Vitest          |

---

## License

MIT
