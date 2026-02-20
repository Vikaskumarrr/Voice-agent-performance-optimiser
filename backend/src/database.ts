import Database from 'better-sqlite3';
import path from 'path';

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'optimizer.db');

export class AppDatabase {
  public db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || process.env.DATABASE_PATH || DEFAULT_DB_PATH;

    // Use ':memory:' as-is, otherwise ensure directory exists
    if (resolvedPath !== ':memory:') {
      const dir = path.dirname(resolvedPath);
      const fs = require('fs');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.runMigrations();
  }

  private runMigrations(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS Agent (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        highlevelAgentId TEXT NOT NULL,
        currentPrompt TEXT NOT NULL,
        originalPrompt TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS PromptAnalysis (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        goals TEXT NOT NULL,
        conversationFlows TEXT NOT NULL,
        expectedBehaviors TEXT NOT NULL,
        rawPrompt TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (agentId) REFERENCES Agent(id)
      );

      CREATE TABLE IF NOT EXISTS TestSuite (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        analysisId TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (agentId) REFERENCES Agent(id),
        FOREIGN KEY (analysisId) REFERENCES PromptAnalysis(id)
      );

      CREATE TABLE IF NOT EXISTS TestCase (
        id TEXT PRIMARY KEY,
        testSuiteId TEXT NOT NULL,
        scenarioDescription TEXT NOT NULL,
        scenarioType TEXT NOT NULL CHECK (scenarioType IN ('happy-path', 'adversarial')),
        userInputSequence TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (testSuiteId) REFERENCES TestSuite(id)
      );

      CREATE TABLE IF NOT EXISTS SuccessCriterion (
        id TEXT PRIMARY KEY,
        testCaseId TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('behavioral', 'functional', 'compliance')),
        evaluationPrompt TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (testCaseId) REFERENCES TestCase(id)
      );

      CREATE TABLE IF NOT EXISTS TestRun (
        id TEXT PRIMARY KEY,
        testSuiteId TEXT NOT NULL,
        agentId TEXT NOT NULL,
        promptSnapshot TEXT NOT NULL,
        overallPassRate REAL,
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'error')),
        startedAt TEXT NOT NULL DEFAULT (datetime('now')),
        completedAt TEXT,
        FOREIGN KEY (testSuiteId) REFERENCES TestSuite(id),
        FOREIGN KEY (agentId) REFERENCES Agent(id)
      );

      CREATE TABLE IF NOT EXISTS TestCaseResult (
        id TEXT PRIMARY KEY,
        testRunId TEXT NOT NULL,
        testCaseId TEXT NOT NULL,
        agentResponses TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('completed', 'error')),
        errorMessage TEXT,
        executedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (testRunId) REFERENCES TestRun(id),
        FOREIGN KEY (testCaseId) REFERENCES TestCase(id)
      );

      CREATE TABLE IF NOT EXISTS CriterionResult (
        id TEXT PRIMARY KEY,
        testCaseResultId TEXT NOT NULL,
        criterionId TEXT NOT NULL,
        passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
        explanation TEXT NOT NULL,
        FOREIGN KEY (testCaseResultId) REFERENCES TestCaseResult(id),
        FOREIGN KEY (criterionId) REFERENCES SuccessCriterion(id)
      );

      CREATE TABLE IF NOT EXISTS OptimizationRecord (
        id TEXT PRIMARY KEY,
        testRunId TEXT NOT NULL,
        agentId TEXT NOT NULL,
        originalPrompt TEXT NOT NULL,
        revisedPrompt TEXT NOT NULL,
        changes TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('generated', 'accepted', 'rejected')),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (testRunId) REFERENCES TestRun(id),
        FOREIGN KEY (agentId) REFERENCES Agent(id)
      );

      CREATE TABLE IF NOT EXISTS CycleRecord (
        id TEXT PRIMARY KEY,
        agentId TEXT NOT NULL,
        cycleCount INTEGER NOT NULL DEFAULT 0,
        startingPassRate REAL NOT NULL DEFAULT 0,
        endingPassRate REAL NOT NULL DEFAULT 0,
        targetThreshold REAL NOT NULL,
        maxCycles INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running', 'paused', 'completed', 'cancelled')),
        testRunIds TEXT NOT NULL DEFAULT '[]',
        optimizationIds TEXT NOT NULL DEFAULT '[]',
        startedAt TEXT NOT NULL DEFAULT (datetime('now')),
        completedAt TEXT,
        FOREIGN KEY (agentId) REFERENCES Agent(id)
      );
    `);
  }

  getTableNames(): string[] {
    const rows = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all() as { name: string }[];
    return rows.map(r => r.name);
  }

  getTableInfo(tableName: string): { name: string; type: string; notnull: number; pk: number }[] {
    return this.db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance for application use
let instance: AppDatabase | null = null;

export function getDatabase(dbPath?: string): AppDatabase {
  if (!instance) {
    instance = new AppDatabase(dbPath);
  }
  return instance;
}

export function resetDatabase(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
