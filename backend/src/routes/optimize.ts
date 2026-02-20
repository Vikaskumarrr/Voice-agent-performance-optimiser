import { Router, Request, Response } from 'express';
import { AppDatabase } from '../database';
import { LLMService } from '../services/llm-service';
import { PromptOptimizerService } from '../services/prompt-optimizer';
import { transitionOptimizationStatus, OptimizationStatus } from '../utils/state-machine';
import { computeDiff } from '../utils/diff';
import { CriterionResult } from '../types';

export function createOptimizeRouter(database: AppDatabase, llmService: LLMService): Router {
  const router = Router();
  const optimizer = new PromptOptimizerService(llmService, database);

  function errorResponse(code: string, message: string, retryable: boolean) {
    return { error: { code, message, retryable } };
  }

  // POST /api/optimize - Generate optimized prompt
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { testRunId, agentId } = req.body;

      if (!testRunId || !agentId) {
        res.status(400).json(errorResponse('INVALID_INPUT', 'testRunId and agentId are required', false));
        return;
      }

      const run = database.db.prepare('SELECT * FROM TestRun WHERE id = ?').get(testRunId) as any;
      if (!run) {
        res.status(404).json(errorResponse('TEST_RUN_NOT_FOUND', `Test run '${testRunId}' not found`, false));
        return;
      }

      const agent = database.db.prepare('SELECT id, currentPrompt FROM Agent WHERE id = ?').get(agentId) as any;
      if (!agent) {
        res.status(404).json(errorResponse('AGENT_NOT_FOUND', `Agent '${agentId}' not found`, false));
        return;
      }

      // Gather criterion results from the test run
      const rows = database.db.prepare(`
        SELECT cr.criterionId, cr.passed, cr.explanation
        FROM CriterionResult cr
        JOIN TestCaseResult tcr ON cr.testCaseResultId = tcr.id
        WHERE tcr.testRunId = ? AND tcr.status = 'completed'
      `).all(testRunId) as any[];

      const failures: CriterionResult[] = [];
      const passes: CriterionResult[] = [];

      for (const r of rows) {
        const result: CriterionResult = { criterionId: r.criterionId, passed: r.passed === 1, explanation: r.explanation };
        if (result.passed) passes.push(result);
        else failures.push(result);
      }

      if (failures.length === 0) {
        res.status(400).json(errorResponse('NO_FAILURES', 'No failed criteria to optimize against', false));
        return;
      }

      const record = await optimizer.optimizePrompt(testRunId, agentId, agent.currentPrompt, failures, passes);
      const diff = computeDiff(record.originalPrompt, record.revisedPrompt);

      res.status(201).json({ ...record, diff });
    } catch (err: any) {
      res.status(500).json(errorResponse('OPTIMIZATION_FAILED', `Optimization failed: ${err.message}`, true));
    }
  });

  // POST /api/optimize/:id/apply - Apply (accept) optimized prompt to agent
  router.post('/:id/apply', (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const record = database.db.prepare('SELECT * FROM OptimizationRecord WHERE id = ?').get(id) as any;
      if (!record) {
        res.status(404).json(errorResponse('OPTIMIZATION_NOT_FOUND', `Optimization record '${id}' not found`, false));
        return;
      }

      // Validate state transition
      try {
        transitionOptimizationStatus(record.status as OptimizationStatus, 'accepted');
      } catch (err: any) {
        res.status(400).json(errorResponse('INVALID_TRANSITION', err.message, false));
        return;
      }

      // Update agent prompt
      database.db.prepare(`UPDATE Agent SET currentPrompt = ?, updatedAt = datetime('now') WHERE id = ?`)
        .run(record.revisedPrompt, record.agentId);

      // Update optimization status
      database.db.prepare(`UPDATE OptimizationRecord SET status = 'accepted' WHERE id = ?`).run(id);

      res.json({ id, status: 'accepted', agentId: record.agentId });
    } catch (err: any) {
      // Retain prompt locally, return error with retry
      res.status(500).json(errorResponse('APPLY_FAILED', `Failed to apply optimization: ${err.message}`, true));
    }
  });

  return router;
}
