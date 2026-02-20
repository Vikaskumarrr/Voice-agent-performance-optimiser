import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppDatabase } from '../database';
import { LLMService } from '../services/llm-service';
import { TestExecutorService } from '../services/test-executor';
import { ResultEvaluatorService } from '../services/result-evaluator';
import { calculatePassRate } from '../utils/pass-rate';
import { TestCase, TestCaseResult } from '../types';

export function createTestRunsRouter(database: AppDatabase, llmService: LLMService): Router {
  const router = Router();
  const executor = new TestExecutorService(database);
  const evaluator = new ResultEvaluatorService(llmService);

  function errorResponse(code: string, message: string, retryable: boolean) {
    return { error: { code, message, retryable } };
  }

  function getTestCases(testSuiteId: string): TestCase[] {
    const rows = database.db.prepare('SELECT * FROM TestCase WHERE testSuiteId = ?').all(testSuiteId) as any[];
    return rows.map((r: any) => {
      const criteria = database.db.prepare('SELECT * FROM SuccessCriterion WHERE testCaseId = ?').all(r.id) as any[];
      return {
        id: r.id,
        scenarioDescription: r.scenarioDescription,
        scenarioType: r.scenarioType,
        userInputSequence: JSON.parse(r.userInputSequence),
        successCriteria: criteria.map((c: any) => ({
          id: c.id, description: c.description, category: c.category, evaluationPrompt: c.evaluationPrompt,
        })),
      };
    });
  }

  // POST /api/test-runs - Execute a test run
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { testSuiteId, agentId } = req.body;

      if (!testSuiteId || !agentId) {
        res.status(400).json(errorResponse('INVALID_INPUT', 'testSuiteId and agentId are required', false));
        return;
      }

      const agent = database.db.prepare('SELECT id, currentPrompt FROM Agent WHERE id = ?').get(agentId) as any;
      if (!agent) {
        res.status(404).json(errorResponse('AGENT_NOT_FOUND', `Agent '${agentId}' not found`, false));
        return;
      }

      const suite = database.db.prepare('SELECT id FROM TestSuite WHERE id = ?').get(testSuiteId) as any;
      if (!suite) {
        res.status(404).json(errorResponse('TEST_SUITE_NOT_FOUND', `Test suite '${testSuiteId}' not found`, false));
        return;
      }

      const testRunId = uuidv4();
      const now = new Date().toISOString();

      database.db.prepare(`
        INSERT INTO TestRun (id, testSuiteId, agentId, promptSnapshot, status, startedAt)
        VALUES (?, ?, ?, ?, 'running', ?)
      `).run(testRunId, testSuiteId, agentId, agent.currentPrompt, now);

      const testCases = getTestCases(testSuiteId);
      const allResults: TestCaseResult[] = [];

      for (const tc of testCases) {
        const result = await executor.executeTestCase(tc, agent.currentPrompt);

        if (result.status === 'completed') {
          result.criterionResults = await evaluator.evaluateAllCriteria(result.agentResponses, tc.successCriteria);
        }

        const resultId = uuidv4();
        database.db.prepare(`
          INSERT INTO TestCaseResult (id, testRunId, testCaseId, agentResponses, status, errorMessage, executedAt)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(resultId, testRunId, tc.id, JSON.stringify(result.agentResponses), result.status, result.errorMessage || null);

        for (const cr of result.criterionResults) {
          database.db.prepare(`
            INSERT INTO CriterionResult (id, testCaseResultId, criterionId, passed, explanation)
            VALUES (?, ?, ?, ?, ?)
          `).run(uuidv4(), resultId, cr.criterionId, cr.passed ? 1 : 0, cr.explanation);
        }

        allResults.push(result);
      }

      const passRate = calculatePassRate(allResults);
      database.db.prepare(`
        UPDATE TestRun SET overallPassRate = ?, status = 'completed', completedAt = datetime('now') WHERE id = ?
      `).run(passRate, testRunId);

      res.status(201).json({ id: testRunId, overallPassRate: passRate, status: 'completed' });
    } catch (err: any) {
      res.status(500).json(errorResponse('TEST_RUN_FAILED', `Test run failed: ${err.message}`, true));
    }
  });

  // GET /api/test-runs/:id - Retrieve test run results
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const run = database.db.prepare('SELECT * FROM TestRun WHERE id = ?').get(req.params.id) as any;
      if (!run) {
        res.status(404).json(errorResponse('TEST_RUN_NOT_FOUND', `Test run '${req.params.id}' not found`, false));
        return;
      }

      const caseResults = database.db.prepare('SELECT * FROM TestCaseResult WHERE testRunId = ?').all(run.id) as any[];
      const results = caseResults.map((tcr: any) => {
        const criteria = database.db.prepare('SELECT * FROM CriterionResult WHERE testCaseResultId = ?').all(tcr.id) as any[];
        return {
          id: tcr.id,
          testCaseId: tcr.testCaseId,
          agentResponses: JSON.parse(tcr.agentResponses),
          status: tcr.status,
          errorMessage: tcr.errorMessage || undefined,
          criterionResults: criteria.map((cr: any) => ({
            criterionId: cr.criterionId, passed: cr.passed === 1, explanation: cr.explanation,
          })),
        };
      });

      res.json({ ...run, testCaseResults: results });
    } catch (err: any) {
      res.status(500).json(errorResponse('TEST_RUN_FETCH_FAILED', `Failed to retrieve test run: ${err.message}`, true));
    }
  });

  // POST /api/test-runs/:id/retry/:caseId - Retry individual test case
  router.post('/:id/retry/:caseId', async (req: Request, res: Response) => {
    try {
      const { id: testRunId, caseId } = req.params;

      const run = database.db.prepare('SELECT * FROM TestRun WHERE id = ?').get(testRunId) as any;
      if (!run) {
        res.status(404).json(errorResponse('TEST_RUN_NOT_FOUND', `Test run '${testRunId}' not found`, false));
        return;
      }

      const testCaseRow = database.db.prepare('SELECT * FROM TestCase WHERE id = ?').get(caseId) as any;
      if (!testCaseRow) {
        res.status(404).json(errorResponse('TEST_CASE_NOT_FOUND', `Test case '${caseId}' not found`, false));
        return;
      }

      const criteria = database.db.prepare('SELECT * FROM SuccessCriterion WHERE testCaseId = ?').all(caseId) as any[];
      const testCase: TestCase = {
        id: testCaseRow.id,
        scenarioDescription: testCaseRow.scenarioDescription,
        scenarioType: testCaseRow.scenarioType,
        userInputSequence: JSON.parse(testCaseRow.userInputSequence),
        successCriteria: criteria.map((c: any) => ({
          id: c.id, description: c.description, category: c.category, evaluationPrompt: c.evaluationPrompt,
        })),
      };

      // Delete old result for this case in this run
      const oldResult = database.db.prepare('SELECT id FROM TestCaseResult WHERE testRunId = ? AND testCaseId = ?').get(testRunId, caseId) as any;
      if (oldResult) {
        database.db.prepare('DELETE FROM CriterionResult WHERE testCaseResultId = ?').run(oldResult.id);
        database.db.prepare('DELETE FROM TestCaseResult WHERE id = ?').run(oldResult.id);
      }

      const result = await executor.executeTestCase(testCase, run.promptSnapshot);
      if (result.status === 'completed') {
        result.criterionResults = await evaluator.evaluateAllCriteria(result.agentResponses, testCase.successCriteria);
      }

      const resultId = uuidv4();
      database.db.prepare(`
        INSERT INTO TestCaseResult (id, testRunId, testCaseId, agentResponses, status, errorMessage, executedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(resultId, testRunId, caseId, JSON.stringify(result.agentResponses), result.status, result.errorMessage || null);

      for (const cr of result.criterionResults) {
        database.db.prepare(`
          INSERT INTO CriterionResult (id, testCaseResultId, criterionId, passed, explanation)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuidv4(), resultId, cr.criterionId, cr.passed ? 1 : 0, cr.explanation);
      }

      // Recalculate pass rate
      const allCaseResults = database.db.prepare('SELECT * FROM TestCaseResult WHERE testRunId = ?').all(testRunId) as any[];
      const mapped: TestCaseResult[] = allCaseResults.map((tcr: any) => {
        const crs = database.db.prepare('SELECT * FROM CriterionResult WHERE testCaseResultId = ?').all(tcr.id) as any[];
        return {
          testCaseId: tcr.testCaseId,
          agentResponses: JSON.parse(tcr.agentResponses),
          status: tcr.status as 'completed' | 'error',
          criterionResults: crs.map((c: any) => ({ criterionId: c.criterionId, passed: c.passed === 1, explanation: c.explanation })),
        };
      });

      const newPassRate = calculatePassRate(mapped);
      database.db.prepare('UPDATE TestRun SET overallPassRate = ? WHERE id = ?').run(newPassRate, testRunId);

      res.json({ testCaseId: caseId, status: result.status, overallPassRate: newPassRate });
    } catch (err: any) {
      res.status(500).json(errorResponse('RETRY_FAILED', `Retry failed: ${err.message}`, true));
    }
  });

  return router;
}
