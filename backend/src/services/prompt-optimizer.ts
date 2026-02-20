import { v4 as uuidv4 } from 'uuid';
import { LLMService } from './llm-service';
import { AppDatabase } from '../database';
import { CriterionResult, OptimizationResult } from '../types';

export interface StoredOptimizationRecord {
  id: string;
  testRunId: string;
  agentId: string;
  originalPrompt: string;
  revisedPrompt: string;
  changes: OptimizationResult['changes'];
  targetedFailures: string[];
  status: 'generated' | 'accepted' | 'rejected';
  createdAt: string;
}

export class PromptOptimizerService {
  constructor(
    private llmService: LLMService,
    private database: AppDatabase
  ) {}

  /**
   * Generate a revised prompt based on test failures.
   * Includes both failed and passing criteria in LLM context.
   */
  async optimizePrompt(
    testRunId: string,
    agentId: string,
    originalPrompt: string,
    failures: CriterionResult[],
    passes: CriterionResult[]
  ): Promise<StoredOptimizationRecord> {
    const result = await this.llmService.optimizePrompt(originalPrompt, failures, passes);

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    this.database.db.prepare(`
      INSERT INTO OptimizationRecord (id, testRunId, agentId, originalPrompt, revisedPrompt, changes, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'generated', ?)
    `).run(id, testRunId, agentId, originalPrompt, result.revisedPrompt, JSON.stringify(result.changes), createdAt);

    return {
      id,
      testRunId,
      agentId,
      originalPrompt,
      revisedPrompt: result.revisedPrompt,
      changes: result.changes,
      targetedFailures: result.targetedFailures,
      status: 'generated',
      createdAt,
    };
  }

  getOptimizationRecord(id: string): StoredOptimizationRecord | null {
    const row = this.database.db.prepare('SELECT * FROM OptimizationRecord WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  private mapRow(row: any): StoredOptimizationRecord {
    return {
      id: row.id,
      testRunId: row.testRunId,
      agentId: row.agentId,
      originalPrompt: row.originalPrompt,
      revisedPrompt: row.revisedPrompt,
      changes: JSON.parse(row.changes),
      targetedFailures: [],
      status: row.status,
      createdAt: row.createdAt,
    };
  }
}
