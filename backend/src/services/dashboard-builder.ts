import { AppDatabase } from '../database';

export interface DashboardCriterionResult {
  criterionId: string;
  description: string;
  category: string;
  passed: boolean;
  explanation: string;
}

export interface DashboardTestCaseResult {
  testCaseId: string;
  scenarioDescription: string;
  scenarioType: string;
  status: 'completed' | 'error';
  errorMessage?: string;
  agentResponses: Array<{ turn: number; utterance: string }>;
  criterionResults: DashboardCriterionResult[];
}

export interface DashboardData {
  testRunId: string;
  agentId: string;
  overallPassRate: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
  testCaseResults: DashboardTestCaseResult[];
}

export class DashboardBuilderService {
  constructor(private database: AppDatabase) {}

  /**
   * Aggregate test run data for dashboard rendering.
   */
  buildDashboard(testRunId: string): DashboardData | null {
    const run = this.database.db.prepare('SELECT * FROM TestRun WHERE id = ?').get(testRunId) as any;
    if (!run) return null;

    const caseResults = this.database.db.prepare(
      'SELECT * FROM TestCaseResult WHERE testRunId = ? ORDER BY executedAt'
    ).all(testRunId) as any[];

    const testCaseResults: DashboardTestCaseResult[] = caseResults.map((tcr: any) => {
      const testCase = this.database.db.prepare('SELECT * FROM TestCase WHERE id = ?').get(tcr.testCaseId) as any;

      const criterionRows = this.database.db.prepare(`
        SELECT cr.criterionId, cr.passed, cr.explanation, sc.description, sc.category
        FROM CriterionResult cr
        JOIN SuccessCriterion sc ON cr.criterionId = sc.id
        WHERE cr.testCaseResultId = ?
      `).all(tcr.id) as any[];

      return {
        testCaseId: tcr.testCaseId,
        scenarioDescription: testCase?.scenarioDescription ?? '',
        scenarioType: testCase?.scenarioType ?? '',
        status: tcr.status,
        errorMessage: tcr.errorMessage || undefined,
        agentResponses: JSON.parse(tcr.agentResponses),
        criterionResults: criterionRows.map((cr: any) => ({
          criterionId: cr.criterionId,
          description: cr.description,
          category: cr.category,
          passed: cr.passed === 1,
          explanation: cr.explanation,
        })),
      };
    });

    return {
      testRunId: run.id,
      agentId: run.agentId,
      overallPassRate: run.overallPassRate ?? 0,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      testCaseResults,
    };
  }
}
