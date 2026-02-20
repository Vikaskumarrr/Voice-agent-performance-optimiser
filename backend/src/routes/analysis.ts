import { Router, Request, Response } from 'express';
import { AppDatabase } from '../database';
import { PromptAnalyzerService } from '../services/prompt-analyzer';
import { LLMService } from '../services/llm-service';

export function createAnalysisRouter(database: AppDatabase, llmService: LLMService): Router {
  const router = Router();
  const analyzerService = new PromptAnalyzerService(llmService, database);

  function errorResponse(code: string, message: string, retryable: boolean) {
    return { error: { code, message, retryable } };
  }

  // POST /api/analysis - Trigger prompt analysis for an agent
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.body;

      if (!agentId || typeof agentId !== 'string' || agentId.trim().length === 0) {
        res.status(400).json(
          errorResponse('INVALID_AGENT_ID', 'Request body must include a non-empty "agentId" string', false)
        );
        return;
      }

      const agent = database.db.prepare(
        'SELECT id, currentPrompt FROM Agent WHERE id = ?'
      ).get(agentId.trim()) as { id: string; currentPrompt: string } | undefined;

      if (!agent) {
        res.status(404).json(
          errorResponse('AGENT_NOT_FOUND', `Agent with id '${agentId.trim()}' not found`, false)
        );
        return;
      }

      const analysis = await analyzerService.analyzePrompt(agent.id, agent.currentPrompt);

      res.status(201).json(analysis);
    } catch (err: any) {
      res.status(500).json(
        errorResponse('ANALYSIS_FAILED', `Prompt analysis failed: ${err.message}`, true)
      );
    }
  });

  return router;
}
