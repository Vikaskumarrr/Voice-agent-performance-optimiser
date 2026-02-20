import { Router, Request, Response } from 'express';
import { AppDatabase } from '../database';
import { LLMService } from '../services/llm-service';
import { CycleOrchestratorService } from '../services/cycle-orchestrator';

export function createCyclesRouter(database: AppDatabase, llmService: LLMService): Router {
  const router = Router();
  const orchestrator = new CycleOrchestratorService(database, llmService);

  function errorResponse(code: string, message: string, retryable: boolean) {
    return { error: { code, message, retryable } };
  }

  // POST /api/cycles - Start auto-cycle
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { agentId, testSuiteId, targetThreshold, maxCycles } = req.body;

      if (!agentId || !testSuiteId) {
        res.status(400).json(errorResponse('INVALID_INPUT', 'agentId and testSuiteId are required', false));
        return;
      }

      const agent = database.db.prepare('SELECT id FROM Agent WHERE id = ?').get(agentId) as any;
      if (!agent) {
        res.status(404).json(errorResponse('AGENT_NOT_FOUND', `Agent '${agentId}' not found`, false));
        return;
      }

      const suite = database.db.prepare('SELECT id FROM TestSuite WHERE id = ?').get(testSuiteId) as any;
      if (!suite) {
        res.status(404).json(errorResponse('TEST_SUITE_NOT_FOUND', `Test suite '${testSuiteId}' not found`, false));
        return;
      }

      const cycleId = await orchestrator.startCycle({
        agentId,
        testSuiteId,
        targetThreshold: targetThreshold ?? 0.9,
        maxCycles: maxCycles ?? 5,
      });

      res.status(201).json({ id: cycleId, status: 'running' });
    } catch (err: any) {
      res.status(500).json(errorResponse('CYCLE_START_FAILED', `Failed to start cycle: ${err.message}`, true));
    }
  });

  // GET /api/cycles/:id - Get cycle status
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const record = orchestrator.getCycleRecord(id);
      if (!record) {
        res.status(404).json(errorResponse('CYCLE_NOT_FOUND', `Cycle '${id}' not found`, false));
        return;
      }
      res.json(record);
    } catch (err: any) {
      res.status(500).json(errorResponse('CYCLE_FETCH_FAILED', `Failed to get cycle: ${err.message}`, true));
    }
  });

  // POST /api/cycles/:id/cancel - Cancel a running cycle
  router.post('/:id/cancel', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const record = orchestrator.getCycleRecord(id);
      if (!record) {
        res.status(404).json(errorResponse('CYCLE_NOT_FOUND', `Cycle '${id}' not found`, false));
        return;
      }

      orchestrator.cancelCycle(id);
      res.json({ id, status: 'cancelled' });
    } catch (err: any) {
      res.status(500).json(errorResponse('CYCLE_CANCEL_FAILED', `Failed to cancel cycle: ${err.message}`, true));
    }
  });

  // GET /api/cycles/:id/events - SSE endpoint for real-time progress
  router.get('/:id/events', (req: Request, res: Response) => {
    const cycleId = req.params.id as string;

    const record = orchestrator.getCycleRecord(cycleId);
    if (!record) {
      res.status(404).json(errorResponse('CYCLE_NOT_FOUND', `Cycle '${cycleId}' not found`, false));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const listener = (event: any) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === 'finished' || event.type === 'error') {
        res.end();
      }
    };

    orchestrator.addEventListener(cycleId, listener);

    req.on('close', () => {
      orchestrator.removeEventListener(cycleId, listener);
    });
  });

  return router;
}
