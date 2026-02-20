import OpenAI from 'openai';
import {
  PromptAnalysis,
  TestCase,
  SuccessCriterion,
  CriterionResult,
  OptimizationResult,
} from '../types';
import { PROMPT_TEMPLATES } from './prompt-templates';

// --- LLM Service Interface ---

export interface LLMService {
  analyzePrompt(prompt: string): Promise<PromptAnalysis>;
  generateTestCases(analysis: PromptAnalysis): Promise<TestCase[]>;
  evaluateCriterion(response: string, criterion: SuccessCriterion): Promise<CriterionResult>;
  optimizePrompt(
    original: string,
    failures: CriterionResult[],
    passes: CriterionResult[]
  ): Promise<OptimizationResult>;
}

// --- Configuration ---

export interface LLMServiceConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  initialRetryDelayMs?: number;
  timeoutMs?: number;
}

const DEFAULT_CONFIG = {
  model: 'gpt-4',
  maxRetries: 3,
  initialRetryDelayMs: 1000,
  timeoutMs: 30000,
} as const;

// --- Retry & Parsing Utilities (exported for testing) ---

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseJsonResponse<T>(raw: string): T {
  // Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {
    // Attempt to extract JSON from markdown code fences
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      return JSON.parse(fenceMatch[1].trim());
    }
    throw new Error(`Failed to parse LLM response as JSON: ${raw.slice(0, 200)}`);
  }
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  initialDelayMs: number,
  sleepFn: (ms: number) => Promise<void> = sleep
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        await sleepFn(delay);
      }
    }
  }
  throw lastError!;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// --- OpenAI Implementation ---

export class OpenAILLMService implements LLMService {
  private client: OpenAI;
  private model: string;
  private maxRetries: number;
  private initialRetryDelayMs: number;
  private timeoutMs: number;

  constructor(config: LLMServiceConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model ?? DEFAULT_CONFIG.model;
    this.maxRetries = config.maxRetries ?? DEFAULT_CONFIG.maxRetries;
    this.initialRetryDelayMs = config.initialRetryDelayMs ?? DEFAULT_CONFIG.initialRetryDelayMs;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_CONFIG.timeoutMs;
  }

  private async callLLM(systemPrompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that always responds with valid JSON.' },
            { role: 'user', content: systemPrompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        },
        { signal: controller.signal }
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('LLM returned empty response');
      }
      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async callWithRetry(prompt: string): Promise<string> {
    return retryWithBackoff(
      () => this.callLLM(prompt),
      this.maxRetries,
      this.initialRetryDelayMs
    );
  }

  async analyzePrompt(prompt: string): Promise<PromptAnalysis> {
    const filledPrompt = fillTemplate(PROMPT_TEMPLATES.ANALYZE_PROMPT, { prompt });
    const raw = await this.callWithRetry(filledPrompt);
    const parsed = parseJsonResponse<{
      goals: string[];
      conversationFlows: PromptAnalysis['conversationFlows'];
      expectedBehaviors: PromptAnalysis['expectedBehaviors'];
    }>(raw);

    return {
      agentId: '',
      goals: parsed.goals,
      conversationFlows: parsed.conversationFlows,
      expectedBehaviors: parsed.expectedBehaviors,
      rawPrompt: prompt,
    };
  }

  async generateTestCases(analysis: PromptAnalysis): Promise<TestCase[]> {
    const filledPrompt = fillTemplate(PROMPT_TEMPLATES.GENERATE_TEST_CASES, {
      analysis: JSON.stringify(analysis, null, 2),
    });
    const raw = await this.callWithRetry(filledPrompt);

    // The response might be { "testCases": [...] } or just [...]
    const parsed = parseJsonResponse<any>(raw);
    const testCases: any[] = Array.isArray(parsed) ? parsed : parsed.testCases ?? parsed.test_cases ?? [];

    return testCases.map((tc: any, index: number) => ({
      id: `tc-${index + 1}`,
      scenarioDescription: tc.scenarioDescription,
      scenarioType: tc.scenarioType,
      userInputSequence: tc.userInputSequence,
      successCriteria: (tc.successCriteria || []).map((sc: any, scIdx: number) => ({
        id: `sc-${index + 1}-${scIdx + 1}`,
        description: sc.description,
        category: sc.category,
        evaluationPrompt: sc.evaluationPrompt,
      })),
    }));
  }

  async evaluateCriterion(
    response: string,
    criterion: SuccessCriterion
  ): Promise<CriterionResult> {
    const filledPrompt = fillTemplate(PROMPT_TEMPLATES.EVALUATE_CRITERION, {
      response,
      criterionDescription: criterion.description,
      evaluationPrompt: criterion.evaluationPrompt,
    });
    const raw = await this.callWithRetry(filledPrompt);
    const parsed = parseJsonResponse<{ passed: boolean; explanation: string }>(raw);

    return {
      criterionId: criterion.id,
      passed: parsed.passed,
      explanation: parsed.explanation,
    };
  }

  async optimizePrompt(
    original: string,
    failures: CriterionResult[],
    passes: CriterionResult[]
  ): Promise<OptimizationResult> {
    const filledPrompt = fillTemplate(PROMPT_TEMPLATES.OPTIMIZE_PROMPT, {
      originalPrompt: original,
      failures: JSON.stringify(failures, null, 2),
      passes: JSON.stringify(passes, null, 2),
    });
    const raw = await this.callWithRetry(filledPrompt);
    const parsed = parseJsonResponse<{
      revisedPrompt: string;
      changes: OptimizationResult['changes'];
      targetedFailures: string[];
    }>(raw);

    return {
      originalPrompt: original,
      revisedPrompt: parsed.revisedPrompt,
      changes: parsed.changes,
      targetedFailures: parsed.targetedFailures,
    };
  }
}
