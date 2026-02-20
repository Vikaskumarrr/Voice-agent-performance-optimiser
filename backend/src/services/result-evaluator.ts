import { LLMService } from './llm-service';
import { AgentResponse, CriterionResult, SuccessCriterion } from '../types';

export class ResultEvaluatorService {
  constructor(private llmService: LLMService) {}

  /**
   * Evaluate a single criterion against the agent's responses.
   * Ensures failed criteria always have non-empty explanations.
   */
  async evaluateCriterion(
    agentResponses: AgentResponse[],
    criterion: SuccessCriterion
  ): Promise<CriterionResult> {
    const responseText = agentResponses.map(r => `Turn ${r.turn}: ${r.utterance}`).join('\n');

    const result = await this.llmService.evaluateCriterion(responseText, criterion);

    // Ensure failed criteria always have non-empty explanations
    if (!result.passed && (!result.explanation || result.explanation.trim() === '')) {
      result.explanation = `Criterion "${criterion.description}" was not met by the agent response.`;
    }

    return result;
  }

  /**
   * Evaluate all criteria for a set of agent responses.
   */
  async evaluateAllCriteria(
    agentResponses: AgentResponse[],
    criteria: SuccessCriterion[]
  ): Promise<CriterionResult[]> {
    const results: CriterionResult[] = [];
    for (const criterion of criteria) {
      const result = await this.evaluateCriterion(agentResponses, criterion);
      results.push(result);
    }
    return results;
  }
}
