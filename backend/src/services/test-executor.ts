import { v4 as uuidv4 } from 'uuid';
import { AppDatabase } from '../database';
import { TestCase, TestCaseResult, AgentResponse } from '../types';

const MOCK_TIMEOUT_MS = 100;

/**
 * Simulates executing a test case against a Voice AI agent.
 * Uses a mock HighLevel API interaction for now.
 */
export class TestExecutorService {
  constructor(private database: AppDatabase) {}

  async executeTestCase(testCase: TestCase, agentPrompt: string): Promise<TestCaseResult> {
    try {
      const agentResponses: AgentResponse[] = [];

      for (const input of testCase.userInputSequence) {
        const response = await this.simulateAgentResponse(input.utterance, agentPrompt, input.turn);
        agentResponses.push(response);
      }

      return {
        testCaseId: testCase.id,
        agentResponses,
        criterionResults: [], // filled by ResultEvaluator
        status: 'completed',
      };
    } catch (err: any) {
      return {
        testCaseId: testCase.id,
        agentResponses: [],
        criterionResults: [],
        status: 'error',
        errorMessage: err.message || 'Unknown execution error',
      };
    }
  }

  /**
   * Mock HighLevel API call — simulates the agent responding to a user utterance.
   */
  private async simulateAgentResponse(utterance: string, agentPrompt: string, turn: number): Promise<AgentResponse> {
    await new Promise(resolve => setTimeout(resolve, MOCK_TIMEOUT_MS));

    return {
      turn,
      utterance: `[Mock agent response to "${utterance}" based on prompt]`,
    };
  }
}
