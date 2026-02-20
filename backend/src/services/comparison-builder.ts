import { AppDatabase } from '../database';

export interface CriterionChange {
  criterionId: string;
  description: string;
  previousPassed: boolean;
  currentPassed: boolean;
}

export interface TestRunMetric {
  testRunId: string;
  passRate: number;
  completedAt: string;
}

export interface ComparisonData {
  agentId: string;
  originalPrompt: string;
  currentPrompt: string;
  improvements: CriterionChange[];
  regressions: CriterionChange[];
  testRunMetrics: TestRunMetric[];
}

export class ComparisonBuilderService {
  constructor(private database: AppDatabase) {}

  /**
   * Build before/after comparison from agent's original prompt,
   * current prompt, and test run history.
   */
  buildComparison(agentId: string): ComparisonData | null {
    const agent = this.database.db.prepare(
      'SELECT id, originalPrompt, currentPrompt FROM Agent WHERE id = ?'
    ).get(agentId) as any;

    if (!agent) return null;

    const testRuns = this.database.db.prepare(
      `SELECT id, overallPassRate, completedAt FROM TestRun
       WHERE agentId = ? AND status = 'completed'
       ORDER BY startedAt ASC`
    ).all(agentId) as any[];

    const testRunMetrics: TestRunMetric[] = testRuns.map((r: any) => ({
      testRunId: r.id,
      passRate: r.overallPassRate ?? 0,
      completedAt: r.completedAt,
    }));

    const { improvements, regressions } = this.computeChanges(testRuns);

    return {
      agentId,
      originalPrompt: agent.originalPrompt,
      currentPrompt: agent.currentPrompt,
      improvements,
      regressions,
      testRunMetrics,
    };
  }

  /**
   * Compare the first and last test runs to find improvements and regressions.
   */
  private computeChanges(testRuns: any[]): { improvements: CriterionChange[]; regressions: CriterionChange[] } {
    if (testRuns.length < 2) return { improvements: [], regressions: [] };

    const firstRun = testRuns[0];
    const lastRun = testRuns[testRuns.length - 1];

    const firstResults = this.getCriterionResultsForRun(firstRun.id);
    const lastResults = this.getCriterionResultsForRun(lastRun.id);

    const improvements: CriterionChange[] = [];
    const regressions: CriterionChange[] = [];

    // Build map of criterionId → passed for the first run
    const firstMap = new Map<string, boolean>();
    for (const r of firstResults) {
      firstMap.set(r.criterionId, r.passed);
    }

    for (const r of lastResults) {
      const prev = firstMap.get(r.criterionId);
      if (prev === undefined) continue;

      if (!prev && r.passed) {
        improvements.push({
          criterionId: r.criterionId,
          description: r.description,
          previousPassed: false,
          currentPassed: true,
        });
      } else if (prev && !r.passed) {
        regressions.push({
          criterionId: r.criterionId,
          description: r.description,
          previousPassed: true,
          currentPassed: false,
        });
      }
    }

    return { improvements, regressions };
  }

  private getCriterionResultsForRun(testRunId: string): Array<{ criterionId: string; passed: boolean; description: string }> {
    const rows = this.database.db.prepare(`
      SELECT cr.criterionId, cr.passed, sc.description
      FROM CriterionResult cr
      JOIN TestCaseResult tcr ON cr.testCaseResultId = tcr.id
      JOIN SuccessCriterion sc ON cr.criterionId = sc.id
      WHERE tcr.testRunId = ? AND tcr.status = 'completed'
    `).all(testRunId) as any[];

    return rows.map((r: any) => ({
      criterionId: r.criterionId,
      passed: r.passed === 1,
      description: r.description,
    }));
  }
}
