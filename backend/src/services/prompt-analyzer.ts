import { v4 as uuidv4 } from 'uuid';
import { LLMService } from './llm-service';
import { AppDatabase } from '../database';
import { PromptAnalysis } from '../types';

export interface StoredPromptAnalysis extends PromptAnalysis {
  id: string;
  createdAt: string;
}

export class PromptAnalyzerService {
  constructor(
    private llmService: LLMService,
    private database: AppDatabase
  ) {}

  async analyzePrompt(agentId: string, rawPrompt: string): Promise<StoredPromptAnalysis> {
    const analysis = await this.llmService.analyzePrompt(rawPrompt);

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    this.database.db.prepare(`
      INSERT INTO PromptAnalysis (id, agentId, goals, conversationFlows, expectedBehaviors, rawPrompt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      agentId,
      JSON.stringify(analysis.goals),
      JSON.stringify(analysis.conversationFlows),
      JSON.stringify(analysis.expectedBehaviors),
      rawPrompt,
      createdAt
    );

    return {
      id,
      agentId,
      goals: analysis.goals,
      conversationFlows: analysis.conversationFlows,
      expectedBehaviors: analysis.expectedBehaviors,
      rawPrompt,
      createdAt,
    };
  }

  getAnalysis(id: string): StoredPromptAnalysis | null {
    const row = this.database.db.prepare(
      'SELECT * FROM PromptAnalysis WHERE id = ?'
    ).get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      agentId: row.agentId,
      goals: JSON.parse(row.goals),
      conversationFlows: JSON.parse(row.conversationFlows),
      expectedBehaviors: JSON.parse(row.expectedBehaviors),
      rawPrompt: row.rawPrompt,
      createdAt: row.createdAt,
    };
  }

  getAnalysesByAgent(agentId: string): StoredPromptAnalysis[] {
    const rows = this.database.db.prepare(
      'SELECT * FROM PromptAnalysis WHERE agentId = ? ORDER BY createdAt DESC'
    ).all(agentId) as any[];

    return rows.map(row => ({
      id: row.id,
      agentId: row.agentId,
      goals: JSON.parse(row.goals),
      conversationFlows: JSON.parse(row.conversationFlows),
      expectedBehaviors: JSON.parse(row.expectedBehaviors),
      rawPrompt: row.rawPrompt,
      createdAt: row.createdAt,
    }));
  }
}
