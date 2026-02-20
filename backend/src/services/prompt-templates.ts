// Structured prompt templates for each LLM operation

export const PROMPT_TEMPLATES = {
  ANALYZE_PROMPT: `You are an expert Voice AI prompt analyst. Analyze the following Voice AI agent base prompt and extract structured information.

BASE PROMPT:
"""
{{prompt}}
"""

Return a JSON object with the following structure:
{
  "goals": ["string array of the agent's intended goals"],
  "conversationFlows": [
    {
      "name": "flow name",
      "description": "what this flow does",
      "steps": ["step 1", "step 2"]
    }
  ],
  "expectedBehaviors": [
    {
      "description": "behavior description",
      "category": "behavioral" | "functional" | "compliance"
    }
  ]
}

Rules:
- Extract ALL identifiable goals from the prompt
- Identify distinct conversation flows (e.g., greeting, qualification, booking)
- Categorize behaviors as: "behavioral" (tone, politeness), "functional" (collects info, performs actions), or "compliance" (follows script structure)
- Return ONLY valid JSON, no additional text`,

  GENERATE_TEST_CASES: `You are an expert QA engineer for Voice AI agents. Generate test cases based on the following prompt analysis.

PROMPT ANALYSIS:
"""
{{analysis}}
"""

Generate a JSON array of test cases. Requirements:
- Generate at least 5 test cases
- Include both "happy-path" and "adversarial" scenario types
- Each test case must have at least one success criterion
- Cover all identified goals and conversation flows

Return a JSON array with this structure:
[
  {
    "scenarioDescription": "description of the test scenario",
    "scenarioType": "happy-path" | "adversarial",
    "userInputSequence": [
      { "turn": 1, "utterance": "user says this", "context": "optional context" }
    ],
    "successCriteria": [
      {
        "description": "what should happen",
        "category": "behavioral" | "functional" | "compliance",
        "evaluationPrompt": "prompt to evaluate if this criterion is met"
      }
    ]
  }
]

Return ONLY valid JSON, no additional text.`,

  EVALUATE_CRITERION: `You are an expert evaluator for Voice AI agent responses. Evaluate whether the agent's response meets the given success criterion.

AGENT RESPONSE:
"""
{{response}}
"""

SUCCESS CRITERION:
Description: {{criterionDescription}}
Evaluation Guide: {{evaluationPrompt}}

Evaluate the response against the criterion and return a JSON object:
{
  "passed": true | false,
  "explanation": "brief explanation of why the criterion passed or failed"
}

Rules:
- Be objective and precise in your evaluation
- If the criterion fails, the explanation MUST describe what was missing or incorrect
- Return ONLY valid JSON, no additional text`,

  OPTIMIZE_PROMPT: `You are an expert Voice AI prompt engineer. Optimize the following base prompt based on test results.

ORIGINAL PROMPT:
"""
{{originalPrompt}}
"""

FAILED CRITERIA:
{{failures}}

PASSING CRITERIA (preserve these behaviors):
{{passes}}

Generate a revised prompt that:
1. Addresses each failed criterion specifically
2. Preserves all passing behaviors
3. Maintains the original prompt's core intent and structure

Return a JSON object:
{
  "revisedPrompt": "the complete revised prompt text",
  "changes": [
    {
      "description": "what was changed",
      "rationale": "why this change addresses the failure"
    }
  ],
  "targetedFailures": ["criterionId1", "criterionId2"]
}

Return ONLY valid JSON, no additional text.`,
} as const;
