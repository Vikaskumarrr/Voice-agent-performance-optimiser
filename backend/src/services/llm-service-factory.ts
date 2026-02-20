import { LLMService, OpenAILLMService } from './llm-service';
import { PromptAnalysis, TestCase, SuccessCriterion, CriterionResult, OptimizationResult } from '../types';

/**
 * Mock LLM service that returns deterministic responses for testing
 * and environments without an OpenAI API key.
 */
export class MockLLMService implements LLMService {
  async analyzePrompt(prompt: string): Promise<PromptAnalysis> {
    return {
      agentId: '',
      goals: ['Handle customer inquiries', 'Collect contact information'],
      conversationFlows: [
        {
          name: 'Greeting Flow',
          description: 'Initial greeting and intent identification',
          steps: ['Greet caller', 'Ask how to help', 'Route to appropriate flow'],
        },
      ],
      expectedBehaviors: [
        { description: 'Maintain a polite and professional tone', category: 'behavioral' },
        { description: 'Collect caller name and email', category: 'functional' },
      ],
      rawPrompt: prompt,
    };
  }

  async generateTestCases(analysis: PromptAnalysis): Promise<TestCase[]> {
    const testCases: TestCase[] = [
      {
        id: 'tc-1',
        scenarioDescription: 'Happy path: Customer calls to book an appointment and provides all required information',
        scenarioType: 'happy-path',
        userInputSequence: [
          { turn: 1, utterance: 'Hi, I would like to book an appointment.' },
          { turn: 2, utterance: 'My name is John Smith.' },
          { turn: 3, utterance: 'john.smith@example.com' },
        ],
        successCriteria: [
          {
            id: 'sc-1-1',
            description: 'Agent greets the caller politely',
            category: 'behavioral',
            evaluationPrompt: 'Does the agent greet the caller in a polite and professional manner?',
          },
          {
            id: 'sc-1-2',
            description: 'Agent collects caller name',
            category: 'functional',
            evaluationPrompt: 'Does the agent ask for or acknowledge the caller\'s name?',
          },
        ],
      },
      {
        id: 'tc-2',
        scenarioDescription: 'Happy path: Customer inquires about services and agent provides information',
        scenarioType: 'happy-path',
        userInputSequence: [
          { turn: 1, utterance: 'What services do you offer?' },
          { turn: 2, utterance: 'How much does that cost?' },
        ],
        successCriteria: [
          {
            id: 'sc-2-1',
            description: 'Agent provides relevant service information',
            category: 'functional',
            evaluationPrompt: 'Does the agent provide information about available services?',
          },
        ],
      },
      {
        id: 'tc-3',
        scenarioDescription: 'Happy path: Customer follows the complete booking flow from greeting to confirmation',
        scenarioType: 'happy-path',
        userInputSequence: [
          { turn: 1, utterance: 'Hello, I need to schedule a visit.' },
          { turn: 2, utterance: 'Next Tuesday at 2pm works for me.' },
          { turn: 3, utterance: 'Yes, that is confirmed.' },
        ],
        successCriteria: [
          {
            id: 'sc-3-1',
            description: 'Agent follows the greeting script structure',
            category: 'compliance',
            evaluationPrompt: 'Does the agent follow the expected greeting and booking script structure?',
          },
          {
            id: 'sc-3-2',
            description: 'Agent confirms the appointment details',
            category: 'functional',
            evaluationPrompt: 'Does the agent confirm the appointment date and time with the caller?',
          },
        ],
      },
      {
        id: 'tc-4',
        scenarioDescription: 'Adversarial: Customer goes off-topic and asks unrelated questions',
        scenarioType: 'adversarial',
        userInputSequence: [
          { turn: 1, utterance: 'What is the weather like today?' },
          { turn: 2, utterance: 'Can you tell me a joke?' },
          { turn: 3, utterance: 'Actually, I do need to book an appointment.' },
        ],
        successCriteria: [
          {
            id: 'sc-4-1',
            description: 'Agent maintains polite tone when handling off-topic questions',
            category: 'behavioral',
            evaluationPrompt: 'Does the agent remain polite and professional when the caller asks off-topic questions?',
          },
          {
            id: 'sc-4-2',
            description: 'Agent redirects conversation back to its purpose',
            category: 'functional',
            evaluationPrompt: 'Does the agent attempt to redirect the conversation back to its intended purpose?',
          },
        ],
      },
      {
        id: 'tc-5',
        scenarioDescription: 'Adversarial: Customer refuses to provide required contact information',
        scenarioType: 'adversarial',
        userInputSequence: [
          { turn: 1, utterance: 'I want to book an appointment.' },
          { turn: 2, utterance: 'I don\'t want to give you my name.' },
          { turn: 3, utterance: 'No, I won\'t share my email either.' },
        ],
        successCriteria: [
          {
            id: 'sc-5-1',
            description: 'Agent handles refusal gracefully without being pushy',
            category: 'behavioral',
            evaluationPrompt: 'Does the agent handle the caller\'s refusal to provide information gracefully?',
          },
          {
            id: 'sc-5-2',
            description: 'Agent explains why information is needed',
            category: 'functional',
            evaluationPrompt: 'Does the agent explain why the contact information is needed?',
          },
        ],
      },
      {
        id: 'tc-6',
        scenarioDescription: 'Adversarial: Customer interrupts the agent mid-sentence repeatedly',
        scenarioType: 'adversarial',
        userInputSequence: [
          { turn: 1, utterance: 'Yeah yeah, skip the intro.', context: 'user interrupts greeting' },
          { turn: 2, utterance: 'Just tell me the price.', context: 'user interrupts explanation' },
        ],
        successCriteria: [
          {
            id: 'sc-6-1',
            description: 'Agent adapts to interruptions without losing context',
            category: 'behavioral',
            evaluationPrompt: 'Does the agent handle interruptions gracefully and continue the conversation coherently?',
          },
          {
            id: 'sc-6-2',
            description: 'Agent still collects required information despite interruptions',
            category: 'compliance',
            evaluationPrompt: 'Does the agent still attempt to follow its script and collect required information despite interruptions?',
          },
        ],
      },
    ];

    return testCases;
  }

  async evaluateCriterion(_response: string, criterion: SuccessCriterion): Promise<CriterionResult> {
    return { criterionId: criterion.id, passed: true, explanation: 'Mock evaluation passed' };
  }

  async optimizePrompt(
    original: string,
    _failures: CriterionResult[],
    _passes: CriterionResult[]
  ): Promise<OptimizationResult> {
    return {
      originalPrompt: original,
      revisedPrompt: original + '\n[optimized]',
      changes: [],
      targetedFailures: [],
    };
  }
}

let overriddenLLMService: LLMService | null = null;

/**
 * Override the LLM service instance (useful for testing).
 */
export function setLLMService(service: LLMService | null): void {
  overriddenLLMService = service;
}

/**
 * Create or return the LLM service.
 * Uses OpenAI when OPENAI_API_KEY is set, otherwise falls back to MockLLMService.
 */
export function getLLMService(): LLMService {
  if (overriddenLLMService) {
    return overriddenLLMService;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    return new OpenAILLMService({ apiKey });
  }

  return new MockLLMService();
}
