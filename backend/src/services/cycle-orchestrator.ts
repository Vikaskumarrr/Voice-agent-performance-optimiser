import { v4 as uuidv4 } from 'uuid';
import { AppDatabase } from '../database';
import { LLMService } from './llm-service';
import { TestExecutorService } from './test-executor';
import { ResultEvaluatorService } from './result-evaluator';
import { PromptOptimizerService } from './prompt-optimizer';
import { calculatePassRate } from '../utils/pass-rate';
import { transitionCycleStatus, CycleStatus } from '../utils/state-machine';
import { TestCase, TestCaseResult, CriterionResult } from '../types';

export interface CycleConfig {
  agentId: string;
  testSuiteId: string;
  targetThreshold: number;
  maxCycles: number;
}

export interface CycleEvent {
  type: 'cycle_start' | 'cycle_complete' | 'test_run_complete' | 'optimization_complete' | 'finished' | 'error';
  cycleNumber?: number;
  passRate?: number;
  status?: string;
  message?: string;
}

export type CycleEventListener = (event: CycleEvent) => void;

export class CycleOrchestratorService {
  private listeners = new Map<string, CycleEventListener[]>();
  private stateFlags = new Map<string, CycleStatus>();

  constructor(
    private database: AppDatabase,
    private llmService: LLMService
  ) {}

  /**
   * Start an auto-optimization cycle: test → evaluate → optimize → repeat.
   */
  async startCycle(config: CycleConfig): Promise<string> {
    const cycleId = uuidv4();
    const now = new Date().toISOString();

    this.database.db.prepare(`
      INSERT INTO CycleRecord (id, agentId, cycleCount, startingPassRate, endingPassRate, targetThreshold, maxCycles, status, testRunIds, optimizationIds, startedAt)
      VALUES (?, ?, 0, 0, 0, ?, ?, 'running', '[]', '[]', ?)
    `).run(cycleId, config.agentId, config.targetThreshold, config.maxCycles, now);

    this.stateFlags.set(cycleId, 'running');

    // Run the cycle loop asynchronously
    this.runCycleLoop(cycleId, config).catch(err => {
      this.emit(cycleId, { type: 'error', message: err.message });
    });

    return cycleId;
  }

  private async runCycleLoop(cycleId: string, config: CycleConfig): Promise<void> {
    const executor = new TestExecutorService(this.database);
    const evaluator = new ResultEvaluatorService(this.llmService);
    const optimizer = new PromptOptimizerService(this.llmService, this.database);

    const testRunIds: string[] = [];
    const optimizationIds: string[] = [];
    let cycleCount = 0;
    let currentPassRate = 0;

    // Capture starting pass rate
    const startingPassRate = currentPassRate;

    while (cycleCount < config.maxCycles) {
      // Check for pause/cancel
      const flag = this.stateFlags.get(cycleId);
      if (flag === 'cancelled') {
        this.updateCycleRecord(cycleId, cycleCount, startingPassRate, currentPassRate, 'cancelled', testRunIds, optimizationIds);
        this.emit(cycleId, { type: 'finished', status: 'cancelled' });
        return;
      }
      if (flag === 'paused') {
        this.updateCycleRecord(cycleId, cycleCount, startingPassRate, currentPassRate, 'paused', testRunIds, optimizationIds);
        this.emit(cycleId, { type: 'finished', status: 'paused' });
        return;
      }

      cycleCount++;
      this.emit(cycleId, { type: 'cycle_start', cycleNumber: cycleCount });

      // 1. Execute test run
      const testRunId = await this.executeTestRun(config, executor, evaluator);
      testRunIds.push(testRunId);

      // Get pass rate from the test run
      const run = this.database.db.prepare('SELECT overallPassRate FROM TestRun WHERE id = ?').get(testRunId) as any;
      currentPassRate = run?.overallPassRate ?? 0;

      this.emit(cycleId, { type: 'test_run_complete', cycleNumber: cycleCount, passRate: currentPassRate });

      // 2. Check if threshold met
      if (currentPassRate >= config.targetThreshold) {
        this.updateCycleRecord(cycleId, cycleCount, startingPassRate, currentPassRate, 'completed', testRunIds, optimizationIds);
        this.emit(cycleId, { type: 'finished', status: 'completed', passRate: currentPassRate });
        return;
      }

      // 3. Optimize prompt if not last cycle
      if (cycleCount < config.maxCycles) {
        const agent = this.database.db.prepare('SELECT currentPrompt FROM Agent WHERE id = ?').get(config.agentId) as any;
        const { failures, passes } = this.getResultsForRun(testRunId);

        if (failures.length > 0) {
          const optRecord = await optimizer.optimizePrompt(testRunId, config.agentId, agent.currentPrompt, failures, passes);
          optimizationIds.push(optRecord.id);

          // Apply the optimized prompt
          this.database.db.prepare(`UPDATE Agent SET currentPrompt = ?, updatedAt = datetime('now') WHERE id = ?`)
            .run(optRecord.revisedPrompt, config.agentId);
          this.database.db.prepare(`UPDATE OptimizationRecord SET status = 'accepted' WHERE id = ?`)
            .run(optRecord.id);

          this.emit(cycleId, { type: 'optimization_complete', cycleNumber: cycleCount });
        }
      }
    }

    // Max cycles reached
    this.updateCycleRecord(cycleId, cycleCount, startingPassRate, currentPassRate, 'completed', testRunIds, optimizationIds);
    this.emit(cycleId, { type: 'finished', status: 'completed', passRate: currentPassRate });
  }

  private async executeTestRun(
    config: CycleConfig,
    executor: TestExecutorService,
    evaluator: ResultEvaluatorService
  ): Promise<string> {
    const testRunId = uuidv4();
    const now = new Date().toISOString();
    const agent = this.database.db.prepare('SELECT currentPrompt FROM Agent WHERE id = ?').get(config.agentId) as any;

    this.database.db.prepare(`
      INSERT INTO TestRun (id, testSuiteId, agentId, promptSnapshot, status, startedAt)
      VALUES (?, ?, ?, ?, 'running', ?)
    `).run(testRunId, config.testSuiteId, config.agentId, agent.currentPrompt, now);

    const testCases = this.getTestCases(config.testSuiteId);
    const allResults: TestCaseResult[] = [];

    for (const tc of testCases) {
      const result = await executor.executeTestCase(tc, agent.currentPrompt);

      if (result.status === 'completed') {
        result.criterionResults = await evaluator.evaluateAllCriteria(result.agentResponses, tc.successCriteria);
      }

      // Store result
      const resultId = uuidv4();
      this.database.db.prepare(`
        INSERT INTO TestCaseResult (id, testRunId, testCaseId, agentResponses, status, errorMessage, executedAt)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(resultId, testRunId, tc.id, JSON.stringify(result.agentResponses), result.status, result.errorMessage || null);

      for (const cr of result.criterionResults) {
        this.database.db.prepare(`
          INSERT INTO CriterionResult (id, testCaseResultId, criterionId, passed, explanation)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuidv4(), resultId, cr.criterionId, cr.passed ? 1 : 0, cr.explanation);
      }

      allResults.push(result);
    }

    const passRate = calculatePassRate(allResults);
    this.database.db.prepare(`
      UPDATE TestRun SET overallPassRate = ?, status = 'completed', completedAt = datetime('now') WHERE id = ?
    `).run(passRate, testRunId);

    return testRunId;
  }

  private getTestCases(testSuiteId: string): TestCase[] {
    const rows = this.database.db.prepare('SELECT * FROM TestCase WHERE testSuiteId = ?').all(testSuiteId) as any[];
    return rows.map((r: any) => {
      const criteria = this.database.db.prepare('SELECT * FROM SuccessCriterion WHERE testCaseId = ?').all(r.id) as any[];
      return {
        id: r.id,
        scenarioDescription: r.scenarioDescription,
        scenarioType: r.scenarioType,
        userInputSequence: JSON.parse(r.userInputSequence),
        successCriteria: criteria.map((c: any) => ({
          id: c.id,
          description: c.description,
          category: c.category,
          evaluationPrompt: c.evaluationPrompt,
        })),
      };
    });
  }

  private getResultsForRun(testRunId: string): { failures: CriterionResult[]; passes: CriterionResult[] } {
    const rows = this.database.db.prepare(`
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

    return { failures, passes };
  }

  private updateCycleRecord(
    cycleId: string, cycleCount: number, startingPassRate: number, endingPassRate: number,
    status: string, testRunIds: string[], optimizationIds: string[]
  ): void {
    this.database.db.prepare(`
      UPDATE CycleRecord SET cycleCount = ?, startingPassRate = ?, endingPassRate = ?, status = ?,
        testRunIds = ?, optimizationIds = ?, completedAt = datetime('now')
      WHERE id = ?
    `).run(cycleCount, startingPassRate, endingPassRate, status, JSON.stringify(testRunIds), JSON.stringify(optimizationIds), cycleId);
  }

  cancelCycle(cycleId: string): void {
    const record = this.database.db.prepare('SELECT status FROM CycleRecord WHERE id = ?').get(cycleId) as any;
    if (record) {
      transitionCycleStatus(record.status as CycleStatus, 'cancelled');
      this.stateFlags.set(cycleId, 'cancelled');
    }
  }

  pauseCycle(cycleId: string): void {
    const record = this.database.db.prepare('SELECT status FROM CycleRecord WHERE id = ?').get(cycleId) as any;
    if (record) {
      transitionCycleStatus(record.status as CycleStatus, 'paused');
      this.stateFlags.set(cycleId, 'paused');
    }
  }

  resumeCycle(cycleId: string): void {
    const record = this.database.db.prepare('SELECT status FROM CycleRecord WHERE id = ?').get(cycleId) as any;
    if (record) {
      transitionCycleStatus(record.status as CycleStatus, 'running');
      this.stateFlags.set(cycleId, 'running');
    }
  }

  getCycleRecord(cycleId: string): any {
    const row = this.database.db.prepare('SELECT * FROM CycleRecord WHERE id = ?').get(cycleId) as any;
    if (!row) return null;
    return {
      ...row,
      testRunIds: JSON.parse(row.testRunIds),
      optimizationIds: JSON.parse(row.optimizationIds),
    };
  }

  addEventListener(cycleId: string, listener: CycleEventListener): void {
    const existing = this.listeners.get(cycleId) || [];
    existing.push(listener);
    this.listeners.set(cycleId, existing);
  }

  removeEventListener(cycleId: string, listener: CycleEventListener): void {
    const existing = this.listeners.get(cycleId) || [];
    this.listeners.set(cycleId, existing.filter(l => l !== listener));
  }

  private emit(cycleId: string, event: CycleEvent): void {
    const listeners = this.listeners.get(cycleId) || [];
    for (const listener of listeners) {
      listener(event);
    }
  }
}
