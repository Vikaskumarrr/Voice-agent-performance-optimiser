import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppDatabase } from '../database';
import { TestGeneratorService } from '../services/test-generator';
import { LLMService } from '../services/llm-service';
import { PromptAnalysis } from '../types';

export function createTestSuitesRouter(database: AppDatabase, llmService: LLMService): Router {
  const router = Router();
  const testGeneratorService = new TestGeneratorService(llmService, database);

  function errorResponse(code: string, message: string, retryable: boolean) {
    return { error: { code, message, retryable } };
  }

  // POST /api/test-suites - Create a new test suite (triggers generation)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { agentId, analysisId } = req.body;

      if (!agentId || typeof agentId !== 'string' || agentId.trim().length === 0) {
        res.status(400).json(
          errorResponse('INVALID_AGENT_ID', 'Request body must include a non-empty "agentId" string', false)
        );
        return;
      }

      if (!analysisId || typeof analysisId !== 'string' || analysisId.trim().length === 0) {
        res.status(400).json(
          errorResponse('INVALID_ANALYSIS_ID', 'Request body must include a non-empty "analysisId" string', false)
        );
        return;
      }

      const agent = database.db.prepare('SELECT id FROM Agent WHERE id = ?').get(agentId.trim()) as { id: string } | undefined;
      if (!agent) {
        res.status(404).json(
          errorResponse('AGENT_NOT_FOUND', `Agent with id '${agentId.trim()}' not found`, false)
        );
        return;
      }

      const analysisRow = database.db.prepare('SELECT * FROM PromptAnalysis WHERE id = ?').get(analysisId.trim()) as any;
      if (!analysisRow) {
        res.status(404).json(
          errorResponse('ANALYSIS_NOT_FOUND', `Analysis with id '${analysisId.trim()}' not found`, false)
        );
        return;
      }

      const analysis: PromptAnalysis = {
        agentId: analysisRow.agentId,
        goals: JSON.parse(analysisRow.goals),
        conversationFlows: JSON.parse(analysisRow.conversationFlows),
        expectedBehaviors: JSON.parse(analysisRow.expectedBehaviors),
        rawPrompt: analysisRow.rawPrompt,
      };

      const testSuite = await testGeneratorService.generateTestSuite(agentId.trim(), analysisId.trim(), analysis);

      res.status(201).json(testSuite);
    } catch (err: any) {
      res.status(500).json(
        errorResponse('TEST_SUITE_GENERATION_FAILED', `Test suite generation failed: ${err.message}`, true)
      );
    }
  });

  // GET /api/test-suites/:id - Retrieve a test suite with test cases and criteria
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      const testSuite = testGeneratorService.getTestSuite(id);
      if (!testSuite) {
        res.status(404).json(
          errorResponse('TEST_SUITE_NOT_FOUND', `Test suite with id '${id}' not found`, false)
        );
        return;
      }

      res.json(testSuite);
    } catch (err: any) {
      res.status(500).json(
        errorResponse('TEST_SUITE_FETCH_FAILED', `Failed to retrieve test suite: ${err.message}`, true)
      );
    }
  });

  // PUT /api/test-suites/:id - Update test cases and criteria (add, edit, remove)
  router.put('/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { operations } = req.body;

      const suiteRow = database.db.prepare('SELECT id FROM TestSuite WHERE id = ?').get(id) as { id: string } | undefined;
      if (!suiteRow) {
        res.status(404).json(
          errorResponse('TEST_SUITE_NOT_FOUND', `Test suite with id '${id}' not found`, false)
        );
        return;
      }

      if (!Array.isArray(operations) || operations.length === 0) {
        res.status(400).json(
          errorResponse('INVALID_OPERATIONS', 'Request body must include a non-empty "operations" array', false)
        );
        return;
      }

      const transaction = database.db.transaction(() => {
        for (const op of operations) {
          switch (op.type) {
            case 'addTestCase':
              addTestCase(id, op.data);
              break;
            case 'editTestCase':
              editTestCase(op.testCaseId, op.data);
              break;
            case 'removeTestCase':
              removeTestCase(op.testCaseId);
              break;
            case 'addCriterion':
              addCriterion(op.testCaseId, op.data);
              break;
            case 'editCriterion':
              editCriterion(op.criterionId, op.data);
              break;
            case 'removeCriterion':
              removeCriterion(op.criterionId);
              break;
            default:
              throw new Error(`Unknown operation type: ${op.type}`);
          }
        }

        database.db.prepare(
          `UPDATE TestSuite SET updatedAt = datetime('now') WHERE id = ?`
        ).run(id);
      });

      transaction();

      const updatedSuite = testGeneratorService.getTestSuite(id);
      res.json(updatedSuite);
    } catch (err: any) {
      res.status(500).json(
        errorResponse('TEST_SUITE_UPDATE_FAILED', `Failed to update test suite: ${err.message}`, true)
      );
    }
  });

  function addTestCase(testSuiteId: string, data: any): void {
    const testCaseId = uuidv4();
    const now = new Date().toISOString();

    database.db.prepare(`
      INSERT INTO TestCase (id, testSuiteId, scenarioDescription, scenarioType, userInputSequence, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      testCaseId,
      testSuiteId,
      data.scenarioDescription,
      data.scenarioType,
      JSON.stringify(data.userInputSequence || []),
      now
    );

    if (Array.isArray(data.successCriteria)) {
      for (const sc of data.successCriteria) {
        addCriterion(testCaseId, sc);
      }
    }
  }

  function editTestCase(testCaseId: string, data: any): void {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.scenarioDescription !== undefined) {
      updates.push('scenarioDescription = ?');
      values.push(data.scenarioDescription);
    }
    if (data.scenarioType !== undefined) {
      updates.push('scenarioType = ?');
      values.push(data.scenarioType);
    }
    if (data.userInputSequence !== undefined) {
      updates.push('userInputSequence = ?');
      values.push(JSON.stringify(data.userInputSequence));
    }

    if (updates.length > 0) {
      values.push(testCaseId);
      database.db.prepare(
        `UPDATE TestCase SET ${updates.join(', ')} WHERE id = ?`
      ).run(...values);
    }
  }

  function removeTestCase(testCaseId: string): void {
    database.db.prepare('DELETE FROM SuccessCriterion WHERE testCaseId = ?').run(testCaseId);
    database.db.prepare('DELETE FROM TestCase WHERE id = ?').run(testCaseId);
  }

  function addCriterion(testCaseId: string, data: any): void {
    const criterionId = uuidv4();
    const now = new Date().toISOString();

    database.db.prepare(`
      INSERT INTO SuccessCriterion (id, testCaseId, description, category, evaluationPrompt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(criterionId, testCaseId, data.description, data.category, data.evaluationPrompt, now);
  }

  function editCriterion(criterionId: string, data: any): void {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.category !== undefined) {
      updates.push('category = ?');
      values.push(data.category);
    }
    if (data.evaluationPrompt !== undefined) {
      updates.push('evaluationPrompt = ?');
      values.push(data.evaluationPrompt);
    }

    if (updates.length > 0) {
      values.push(criterionId);
      database.db.prepare(
        `UPDATE SuccessCriterion SET ${updates.join(', ')} WHERE id = ?`
      ).run(...values);
    }
  }

  function removeCriterion(criterionId: string): void {
    database.db.prepare('DELETE FROM SuccessCriterion WHERE id = ?').run(criterionId);
  }

  return router;
}
