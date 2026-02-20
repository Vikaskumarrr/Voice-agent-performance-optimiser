// API client module using fetch for all backend endpoints

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(body.error?.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Agent types ---
export interface Agent {
  id: string;
  name: string;
  highlevelAgentId: string;
}

export interface AgentPrompt {
  id: string;
  prompt: string;
}

// --- Analysis types ---
export interface ConversationFlow {
  name: string;
  description: string;
  steps: string[];
}

export interface ExpectedBehavior {
  description: string;
  category: 'behavioral' | 'functional' | 'compliance';
}

export interface PromptAnalysis {
  id: string;
  agentId: string;
  goals: string[];
  conversationFlows: ConversationFlow[];
  expectedBehaviors: ExpectedBehavior[];
  rawPrompt: string;
}

// --- Test Suite types ---
export interface UserInput {
  turn: number;
  utterance: string;
  context?: string;
}

export interface SuccessCriterion {
  id: string;
  description: string;
  category: 'behavioral' | 'functional' | 'compliance';
  evaluationPrompt: string;
}

export interface TestCase {
  id: string;
  scenarioDescription: string;
  scenarioType: 'happy-path' | 'adversarial';
  userInputSequence: UserInput[];
  successCriteria: SuccessCriterion[];
}

export interface TestSuite {
  id: string;
  agentId: string;
  analysisId: string;
  testCases: TestCase[];
}

// --- Test Run types ---
export interface AgentResponse {
  turn: number;
  utterance: string;
}

export interface CriterionResult {
  criterionId: string;
  passed: boolean;
  explanation: string;
}

export interface TestCaseResult {
  testCaseId: string;
  agentResponses: AgentResponse[];
  criterionResults: CriterionResult[];
  status: 'completed' | 'error';
  errorMessage?: string;
}

export interface TestRun {
  id: string;
  testSuiteId: string;
  agentId: string;
  promptSnapshot: string;
  overallPassRate: number;
  status: string;
  results: TestCaseResult[];
  startedAt: string;
  completedAt?: string;
}

// --- Optimization types ---
export interface PromptChange {
  description: string;
  rationale: string;
}

export interface OptimizationRecord {
  id: string;
  testRunId: string;
  agentId: string;
  originalPrompt: string;
  revisedPrompt: string;
  changes: PromptChange[];
  targetedFailures: string[];
  status: 'generated' | 'accepted' | 'rejected';
}

// --- Cycle types ---
export interface CycleRecord {
  id: string;
  agentId: string;
  cycleCount: number;
  startingPassRate: number;
  endingPassRate: number;
  targetThreshold: number;
  maxCycles: number;
  status: 'running' | 'paused' | 'completed' | 'cancelled';
  testRunIds: string[];
  optimizationIds: string[];
}

// --- Comparison types ---
export interface ComparisonData {
  agentId: string;
  originalPrompt: string;
  currentPrompt: string;
  originalMetrics: { passRate: number; criterionResults: CriterionResult[] };
  currentMetrics: { passRate: number; criterionResults: CriterionResult[] };
  improvements: string[];
  regressions: string[];
  runs: TestRun[];
}

// --- API functions ---

export async function fetchAgents(): Promise<Agent[]> {
  return request<Agent[]>('/agents');
}

export async function fetchAgentPrompt(agentId: string): Promise<AgentPrompt> {
  return request<AgentPrompt>(`/agents/${agentId}/prompt`);
}

export async function updateAgentPrompt(agentId: string, prompt: string): Promise<AgentPrompt> {
  return request<AgentPrompt>(`/agents/${agentId}/prompt`, {
    method: 'PUT',
    body: JSON.stringify({ prompt }),
  });
}

export async function triggerAnalysis(agentId: string): Promise<PromptAnalysis> {
  return request<PromptAnalysis>('/analysis', {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  });
}

export async function createTestSuite(agentId: string, analysisId: string): Promise<TestSuite> {
  return request<TestSuite>('/test-suites', {
    method: 'POST',
    body: JSON.stringify({ agentId, analysisId }),
  });
}

export async function fetchTestSuite(id: string): Promise<TestSuite> {
  return request<TestSuite>(`/test-suites/${id}`);
}

export async function updateTestSuite(id: string, testCases: TestCase[]): Promise<TestSuite> {
  return request<TestSuite>(`/test-suites/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ testCases }),
  });
}

export async function startTestRun(testSuiteId: string, agentId: string): Promise<TestRun> {
  return request<TestRun>('/test-runs', {
    method: 'POST',
    body: JSON.stringify({ testSuiteId, agentId }),
  });
}

export async function fetchTestRun(id: string): Promise<TestRun> {
  return request<TestRun>(`/test-runs/${id}`);
}

export async function retryTestCase(testRunId: string, caseId: string): Promise<TestCaseResult> {
  return request<TestCaseResult>(`/test-runs/${testRunId}/retry/${caseId}`, {
    method: 'POST',
  });
}

export async function generateOptimization(testRunId: string, agentId: string): Promise<OptimizationRecord> {
  return request<OptimizationRecord>('/optimize', {
    method: 'POST',
    body: JSON.stringify({ testRunId, agentId }),
  });
}

export async function applyOptimization(optimizationId: string): Promise<OptimizationRecord> {
  return request<OptimizationRecord>(`/optimize/${optimizationId}/apply`, {
    method: 'POST',
  });
}

export async function startCycle(
  agentId: string,
  testSuiteId: string,
  targetThreshold: number,
  maxCycles: number
): Promise<CycleRecord> {
  return request<CycleRecord>('/cycles', {
    method: 'POST',
    body: JSON.stringify({ agentId, testSuiteId, targetThreshold, maxCycles }),
  });
}

export async function fetchCycle(id: string): Promise<CycleRecord> {
  return request<CycleRecord>(`/cycles/${id}`);
}

export async function cancelCycle(id: string): Promise<CycleRecord> {
  return request<CycleRecord>(`/cycles/${id}/cancel`, { method: 'POST' });
}

export function subscribeCycleEvents(
  cycleId: string,
  onEvent: (event: { type: string; data: unknown }) => void
): () => void {
  const es = new EventSource(`${BASE}/cycles/${cycleId}/events`);
  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      // ignore parse errors
    }
  };
  return () => es.close();
}

export async function fetchComparison(agentId: string): Promise<ComparisonData> {
  return request<ComparisonData>(`/agents/${agentId}/comparison`);
}
