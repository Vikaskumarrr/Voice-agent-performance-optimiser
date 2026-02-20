// Core domain types from the design document

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
  agentId: string;
  goals: string[];
  conversationFlows: ConversationFlow[];
  expectedBehaviors: ExpectedBehavior[];
  rawPrompt: string;
}

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

export interface PromptChange {
  description: string;
  rationale: string;
}

export interface OptimizationResult {
  originalPrompt: string;
  revisedPrompt: string;
  changes: PromptChange[];
  targetedFailures: string[];
}
