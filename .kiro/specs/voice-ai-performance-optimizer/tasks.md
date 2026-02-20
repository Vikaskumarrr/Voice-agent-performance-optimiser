# Implementation Plan: Voice AI Performance Optimizer

## Overview

Implement the Agent Performance Copilot as an Express.js backend (TypeScript) with a React frontend widget. The backend orchestrates prompt analysis, test generation, test execution, result evaluation, and prompt optimization via an LLM service. The frontend embeds into the HighLevel interface via custom JS injection. Uses TypeScript throughout, SQLite for persistence, Vitest + fast-check for testing, and React Testing Library for component tests.

## Tasks

- [x] 1. Project scaffolding and core setup
  - [x] 1.1 Initialize Node.js backend with TypeScript, Express, SQLite (better-sqlite3), and project structure
    - Create `backend/` directory with `src/`, `tests/` structure
    - Set up `package.json` with dependencies: express, better-sqlite3, openai, uuid, cors
    - Set up `tsconfig.json` and Vitest config
    - _Requirements: 8.1_

  - [x] 1.2 Initialize React frontend with TypeScript and Vite
    - Create `frontend/` directory with React 18 + TypeScript + Vite
    - Set up `package.json` with react, react-dom, @vitejs/plugin-react
    - Configure Vite with React plugin and API proxy to backend
    - Set up Vitest with jsdom environment and React Testing Library
    - _Requirements: 8.3_

  - [x] 1.3 Create SQLite database schema and migration
    - Implement all tables from the data model: Agent, PromptAnalysis, TestSuite, TestCase, SuccessCriterion, TestRun, TestCaseResult, CriterionResult, OptimizationRecord, CycleRecord
    - Create initialization script that runs migrations on startup
    - _Requirements: 2.3, 3.1, 4.1_

- [x] 2. LLM Service layer and Prompt Analyzer
  - [x] 2.1 Implement LLM Service abstraction
    - Create `LLMService` interface and OpenAI implementation
    - Implement retry logic with exponential backoff, timeout handling, and JSON response parsing
    - Create structured prompt templates as constants
    - _Requirements: 1.2_

  - [x] 2.2 Implement Prompt Analyzer Service
    - Implement `analyzePrompt()` that sends base prompt to LLM and parses structured analysis
    - Return `PromptAnalysis` with goals, conversationFlows, expectedBehaviors
    - Store analysis in SQLite
    - _Requirements: 1.2, 1.3_

  - [x] 2.3 Write property test for prompt analysis structure (Property 1)
    - **Property 1: Prompt analysis produces valid structured output**
    - **Validates: Requirements 1.2, 1.3**

  - [x] 2.4 Implement `/api/agents` and `/api/agents/:id/prompt` endpoints
    - GET agents list from HighLevel API (with mock fallback)
    - GET/PUT agent base prompt
    - Implement error handling for API failures with descriptive messages
    - _Requirements: 1.1, 1.4_

  - [x] 2.5 Implement `/api/analysis` POST endpoint
    - Wire prompt analyzer service to the API
    - Return structured analysis response
    - _Requirements: 1.2, 1.3_

- [x] 3. Test Generation and Success Criteria
  - [x] 3.1 Implement Test Generator Service
    - Implement `generateTestCases()` that takes a PromptAnalysis and produces TestCase[] via LLM
    - Ensure minimum 5 test cases, mix of happy-path and adversarial
    - Each test case includes userInputSequence, scenarioDescription, and successCriteria
    - Each criterion has category (behavioral/functional/compliance) and evaluationPrompt
    - Store generated test suite in SQLite
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.4_

  - [ ]* 3.2 Write property tests for test generation (Properties 2, 3, 4)
    - **Property 2: Generated test cases cover identified goals and flows**
    - **Property 3: Generated test suite contains both scenario types**
    - **Property 4: Generated test suite structural validity**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.1, 3.4**

  - [x] 3.3 Implement `/api/test-suites` CRUD endpoints
    - POST to create test suite (triggers generation)
    - GET to retrieve test suite with test cases and criteria
    - PUT to update test cases and criteria (add, edit, remove)
    - _Requirements: 2.5, 3.3_

  - [ ]* 3.4 Write property test for CRUD data integrity (Property 5)
    - **Property 5: Test suite CRUD operations preserve data integrity**
    - **Validates: Requirements 2.5, 3.3**

- [x] 4. Checkpoint - Core generation pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Test Execution and Result Evaluation
  - [x] 5.1 Implement Test Executor and Result Evaluator Services
    - Implement `executeTestCase()` that simulates user inputs against Voice AI agent via HighLevel API
    - Implement `evaluateCriterion()` that sends agent response + criterion to LLM for pass/fail
    - Implement pass rate calculator utility
    - Handle timeouts and API errors, marking status as 'error'
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.3_

  - [ ]* 5.2 Write property tests for test execution (Properties 6, 7, 8)
    - **Property 6: Test execution produces complete results**
    - **Property 7: Pass rate calculation correctness**
    - **Property 8: Failed criterion results include explanations**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 5.3**

  - [x] 5.3 Implement `/api/test-runs` endpoints
    - POST to execute a test run
    - GET to retrieve test run results
    - POST retry for individual test case
    - _Requirements: 4.1, 4.5_

- [x] 6. Prompt Optimization
  - [x] 6.1 Implement Prompt Optimizer Service and diff utility
    - Implement `optimizePrompt()` that generates revised prompt via LLM from test failures
    - Implement line-level diff utility between two prompt strings
    - Implement optimization status state machine (generated → accepted/rejected)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.2 Write property tests for optimization (Properties 11, 12, 13)
    - **Property 11: Optimization produces a different revised prompt**
    - **Property 12: Diff computation correctness**
    - **Property 13: Optimization record status transitions**
    - **Validates: Requirements 6.1, 6.3, 6.4**

  - [x] 6.3 Implement `/api/optimize` endpoints
    - POST to generate optimized prompt
    - POST to apply (accept) optimized prompt to agent via HighLevel API
    - Handle API failure: retain prompt locally, return error with retry
    - _Requirements: 6.1, 6.4, 6.5, 6.6_

- [x] 7. Checkpoint - Full test-optimize pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Auto-Cycle Orchestration
  - [x] 8.1 Implement Cycle Orchestrator
    - Implement the test → evaluate → optimize loop
    - Track cycle count, pass rate, termination conditions (threshold or max cycles)
    - Support pause and cancel via state flags
    - Implement cycle state machine: running → paused/cancelled/completed, paused → running/cancelled
    - Store CycleRecord with all test run and optimization references
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 8.2 Write property tests for cycle orchestration (Properties 14, 15, 16)
    - **Property 14: Auto-cycle termination conditions**
    - **Property 15: Cycle records contain complete data**
    - **Property 16: Cycle state transitions are valid**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

  - [x] 8.3 Implement `/api/cycles` endpoints with SSE
    - POST to start auto-cycle
    - GET cycle status
    - POST to cancel cycle
    - GET SSE endpoint for real-time progress events
    - _Requirements: 7.1, 7.2, 7.4_

- [x] 9. Comparison and Dashboard Data
  - [x] 9.1 Implement comparison and dashboard data builders
    - Build before/after comparison from agent's original prompt, current prompt, and test run history
    - Compute improvements (fail → pass) and regressions (pass → fail)
    - Aggregate test run data for dashboard rendering
    - _Requirements: 5.1, 5.2, 5.4, 9.1, 9.2, 9.3_

  - [ ]* 9.2 Write property tests for dashboard and comparison (Properties 9, 10)
    - **Property 9: Dashboard renders all test run data**
    - **Property 10: Comparison view contains complete before/after data**
    - **Validates: Requirements 5.1, 5.2, 5.4, 9.1, 9.2, 9.3**

  - [x] 9.3 Implement `/api/agents/:id/comparison` endpoint
    - Return complete before/after comparison data
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 10. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Frontend - React App Shell and Core Components
  - [x] 11.1 Set up React app with widget injector and state persistence
    - Create `App.tsx` with tab navigation: Analyze → Test → Optimize → Dashboard
    - Create `widget-injector.js` that loads React app in shadow DOM container
    - Implement widget state persistence to localStorage (save/restore on navigation)
    - Create `api.ts` client module using fetch for all backend endpoints
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 11.2 Write property test for widget state round-trip (Property 17)
    - **Property 17: Widget state round-trip persistence**
    - **Validates: Requirements 8.4**

  - [x] 11.3 Implement AgentSelector and PromptAnalysisView components
    - `AgentSelector`: fetch and display agents, allow selection
    - `PromptAnalysisView`: display structured analysis (goals, flows, behaviors), trigger analysis
    - _Requirements: 1.1, 1.3_

  - [x] 11.4 Implement TestSuiteEditor and TestRunView components
    - `TestSuiteEditor`: CRUD for test cases and success criteria, scenario type badges, criterion categories
    - `TestRunView`: execution progress, per-test-case results with agent responses, per-criterion pass/fail with explanations, retry for errored cases
    - _Requirements: 2.5, 3.3, 4.1, 4.5, 5.1, 5.2, 5.3_

- [x] 12. Frontend - Optimization and Dashboard Components
  - [x] 12.1 Implement PromptDiffView and ResultsDashboard components
    - `PromptDiffView`: side-by-side diff, accept/reject/edit controls
    - `ResultsDashboard`: overall pass rate, per-criterion breakdown, trend across runs
    - _Requirements: 5.1, 5.2, 5.4, 6.3, 6.4_

  - [x] 12.2 Implement BeforeAfterView and CycleControlPanel components
    - `BeforeAfterView`: side-by-side prompt comparison, metrics with improvement/regression highlights
    - `CycleControlPanel`: threshold/max config, start/pause/cancel, real-time progress via SSE
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 9.1, 9.2, 9.3_

- [x] 13. Integration and wiring
  - [x] 13.1 Wire all frontend components and create HighLevel API mock layer
    - Connect all components to backend API via shared API client
    - Implement loading states, error toasts, and retry flows
    - Create mock responses for HighLevel agent listing, prompt retrieval, prompt update, and voice interaction
    - _Requirements: 1.1, 1.4, 4.5, 6.6_

- [x] 14. Final checkpoint - Full system integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check with Vitest
- Unit tests validate specific examples and edge cases
- The HighLevel API integration uses a mock layer that can be swapped for real API calls
- Frontend uses React 18+ with functional components and hooks — no external state management library
- Backend uses Express.js with TypeScript — same architecture as existing implementation
