import { CriterionResult, TestCaseResult } from '../types';

/**
 * Calculate overall pass rate: passed criteria / total criteria (excluding error cases).
 * Returns 0 when all test cases are errors (no criteria to evaluate).
 */
export function calculatePassRate(testCaseResults: TestCaseResult[]): number {
  const completedResults = testCaseResults.filter(r => r.status === 'completed');

  const allCriteria: CriterionResult[] = completedResults.flatMap(r => r.criterionResults);

  if (allCriteria.length === 0) return 0;

  const passed = allCriteria.filter(c => c.passed).length;
  return passed / allCriteria.length;
}
