import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppDatabase } from '../database';
import { ComparisonBuilderService } from '../services/comparison-builder';
import { DashboardBuilderService } from '../services/dashboard-builder';

export function createAgentsRouter(database: AppDatabase): Router {
  const router = Router();
  const comparisonBuilder = new ComparisonBuilderService(database);
  const dashboardBuilder = new DashboardBuilderService(database);

  function errorResponse(code: string, message: string, retryable: boolean) {
    return { error: { code, message, retryable } };
  }

  /**
   * Seed mock agents if the Agent table is empty.
   * This provides a fallback when the HighLevel API is unavailable.
   */
  function seedMockAgentsIfEmpty(): void {
    const count = database.db.prepare('SELECT COUNT(*) as cnt FROM Agent').get() as { cnt: number };
    if (count.cnt > 0) return;

    const mockAgents = [
      {
        id: uuidv4(),
        name: 'Appointment Booking Agent',
        highlevelAgentId: 'hl-agent-001',
        currentPrompt: 'You are a friendly appointment booking assistant. Greet the caller, ask for their name and preferred date/time, confirm the appointment details, and ask for an email to send confirmation.',
        originalPrompt: 'You are a friendly appointment booking assistant. Greet the caller, ask for their name and preferred date/time, confirm the appointment details, and ask for an email to send confirmation.',
      },
      {
        id: uuidv4(),
        name: 'Lead Qualification Agent',
        highlevelAgentId: 'hl-agent-002',
        currentPrompt: 'You are a lead qualification agent. Ask the caller about their business needs, budget range, timeline, and decision-making authority. Qualify leads as hot, warm, or cold based on responses.',
        originalPrompt: 'You are a lead qualification agent. Ask the caller about their business needs, budget range, timeline, and decision-making authority. Qualify leads as hot, warm, or cold based on responses.',
      },
    ];

    const insert = database.db.prepare(
      `INSERT INTO Agent (id, name, highlevelAgentId, currentPrompt, originalPrompt)
       VALUES (@id, @name, @highlevelAgentId, @currentPrompt, @originalPrompt)`
    );

    const seedAll = database.db.transaction(() => {
      for (const agent of mockAgents) {
        insert.run(agent);
      }
    });

    seedAll();
  }

  // GET /api/agents - List all agents (seeds mock data if empty)
  router.get('/', (_req: Request, res: Response) => {
    try {
      seedMockAgentsIfEmpty();

      const agents = database.db.prepare(
        'SELECT id, name, highlevelAgentId, createdAt, updatedAt FROM Agent ORDER BY createdAt ASC'
      ).all();

      res.json(agents);
    } catch (err: any) {
      res.status(500).json(
        errorResponse('AGENTS_FETCH_FAILED', `Failed to retrieve agents: ${err.message}`, true)
      );
    }
  });

  // GET /api/agents/:id/prompt - Retrieve an agent's base prompt
  router.get('/:id/prompt', (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const agent = database.db.prepare(
        'SELECT id, name, currentPrompt, originalPrompt FROM Agent WHERE id = ?'
      ).get(id) as { id: string; name: string; currentPrompt: string; originalPrompt: string } | undefined;

      if (!agent) {
        res.status(404).json(
          errorResponse('AGENT_NOT_FOUND', `Agent with id '${id}' not found`, false)
        );
        return;
      }

      res.json({
        agentId: agent.id,
        name: agent.name,
        currentPrompt: agent.currentPrompt,
        originalPrompt: agent.originalPrompt,
      });
    } catch (err: any) {
      res.status(500).json(
        errorResponse('PROMPT_FETCH_FAILED', `Failed to retrieve agent prompt: ${err.message}`, true)
      );
    }
  });

  // PUT /api/agents/:id/prompt - Update an agent's base prompt
  router.put('/:id/prompt', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        res.status(400).json(
          errorResponse('INVALID_PROMPT', 'Request body must include a non-empty "prompt" string', false)
        );
        return;
      }

      const agent = database.db.prepare('SELECT id FROM Agent WHERE id = ?').get(id) as { id: string } | undefined;

      if (!agent) {
        res.status(404).json(
          errorResponse('AGENT_NOT_FOUND', `Agent with id '${id}' not found`, false)
        );
        return;
      }

      database.db.prepare(
        `UPDATE Agent SET currentPrompt = ?, updatedAt = datetime('now') WHERE id = ?`
      ).run(prompt.trim(), id);

      const updated = database.db.prepare(
        'SELECT id, name, currentPrompt, originalPrompt, updatedAt FROM Agent WHERE id = ?'
      ).get(id) as { id: string; name: string; currentPrompt: string; originalPrompt: string; updatedAt: string };

      res.json({
        agentId: updated.id,
        name: updated.name,
        currentPrompt: updated.currentPrompt,
        originalPrompt: updated.originalPrompt,
        updatedAt: updated.updatedAt,
      });
    } catch (err: any) {
      res.status(500).json(
        errorResponse('PROMPT_UPDATE_FAILED', `Failed to update agent prompt: ${err.message}`, true)
      );
    }
  });

  // GET /api/agents/:id/comparison - Return before/after comparison data
  router.get('/:id/comparison', (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      const agent = database.db.prepare('SELECT id FROM Agent WHERE id = ?').get(id) as any;
      if (!agent) {
        res.status(404).json(
          errorResponse('AGENT_NOT_FOUND', `Agent with id '${id}' not found`, false)
        );
        return;
      }

      const comparison = comparisonBuilder.buildComparison(id);
      if (!comparison) {
        res.status(404).json(
          errorResponse('COMPARISON_NOT_FOUND', 'No comparison data available for this agent', false)
        );
        return;
      }

      res.json(comparison);
    } catch (err: any) {
      res.status(500).json(
        errorResponse('COMPARISON_FAILED', `Failed to build comparison: ${err.message}`, true)
      );
    }
  });

  return router;
}
