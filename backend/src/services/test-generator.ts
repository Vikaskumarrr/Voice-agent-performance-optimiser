import { v4 as uuidv4 } from 'uuid';
import { LLMService } from './llm-service';
import { AppDatabase } from '../database';
import { PromptAnalysis, TestCase, SuccessCriterion } from '../types';

export interface StoredTestSuite {
  id: string;
  agentId: string;
  analysisId: string;
  testCases: TestCase[];
  createdAt: string;
  updatedAt: string;
}

const VALID_CATEGORIES: SuccessCriterion['category'][] = ['behavioral', 'functional', 'compliance'];
const VALID_SCENARIO_TYPES: TestCase['scenarioType'][] = ['happy-path', 'adversarial'];
const MIN_TEST_CASES = 5;

export class TestGeneratorService {
  constructor(
    private llmService: LLMService,
    private database: AppDatabase
  ) {}

  async generateTestSuite(
    agentId: string,
    analysisId: string,
    analysis: PromptAnalysis
  ): Promise<StoredTestSuite> {
    const rawTestCases = await this.llmService.generateTestCases(analysis);
    const testCases = this.validateAndNormalize(rawTestCases);

    return this.storeTestSuite(agentId, analysisId, testCases);
  }

  private validateAndNormalize(testCases: TestCase[]): TestCase[] {
    if (!Array.isArray(testCases) || testCases.length < MIN_TEST_CASES) {
      throw new Error(
        `Test generation must produce at least ${MIN_TEST_CASES} test cases, got ${Array.isArray(testCases) ? testCases.length : 0}`
      );
    }

    const hasHappyPath = testCases.some(tc => tc.scenarioType === 'happy-path');
    const hasAdversarial = testCases.some(tc => tc.scenarioType === 'adversarial');
    if (!hasHappyPath || !hasAdversarial) {
      throw new Error(
        'Test cases must include both happy-path and adversarial scenarios'
      );
    }

    for (const tc of testCases) {
      if (!tc.scenarioDescription || tc.scenarioDescription.trim() === '') {
        throw new Error('Each test case must have a non-empty scenarioDescription');
      }
      if (!VALID_SCENARIO_TYPES.includes(tc.scenarioType)) {
        throw new Error(
          `Invalid scenarioType "${tc.scenarioType}". Must be one of: ${VALID_SCENARIO_TYPES.join(', ')}`
        );
      }
      if (!Array.isArray(tc.userInputSequence) || tc.userInputSequence.length === 0) {
        throw new Error('Each test case must have a non-empty userInputSequence');
      }
      if (!Array.isArray(tc.successCriteria) || tc.successCriteria.length === 0) {
        throw new Error('Each test case must have at least one success criterion');
      }
      for (const sc of tc.successCriteria) {
        if (!VALID_CATEGORIES.includes(sc.category)) {
          throw new Error(
            `Invalid criterion category "${sc.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`
          );
        }
        if (!sc.evaluationPrompt || sc.evaluationPrompt.trim() === '') {
          throw new Error('Each success criterion must have a non-empty evaluationPrompt');
        }
      }
    }

    return testCases;
  }

  private storeTestSuite(
    agentId: string,
    analysisId: string,
    testCases: TestCase[]
  ): StoredTestSuite {
    const suiteId = uuidv4();
    const now = new Date().toISOString();

    const insertSuite = this.database.db.prepare(`
      INSERT INTO TestSuite (id, agentId, analysisId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertTestCase = this.database.db.prepare(`
      INSERT INTO TestCase (id, testSuiteId, scenarioDescription, scenarioType, userInputSequence, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertCriterion = this.database.db.prepare(`
      INSERT INTO SuccessCriterion (id, testCaseId, description, category, evaluationPrompt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const storedTestCases: TestCase[] = [];

    const transaction = this.database.db.transaction(() => {
      insertSuite.run(suiteId, agentId, analysisId, now, now);

      for (const tc of testCases) {
        const testCaseId = uuidv4();
        insertTestCase.run(
          testCaseId,
          suiteId,
          tc.scenarioDescription,
          tc.scenarioType,
          JSON.stringify(tc.userInputSequence),
          now
        );

        const storedCriteria: SuccessCriterion[] = [];
        for (const sc of tc.successCriteria) {
          const criterionId = uuidv4();
          insertCriterion.run(
            criterionId,
            testCaseId,
            sc.description,
            sc.category,
            sc.evaluationPrompt,
            now
          );
          storedCriteria.push({
            id: criterionId,
            description: sc.description,
            category: sc.category,
            evaluationPrompt: sc.evaluationPrompt,
          });
        }

        storedTestCases.push({
          id: testCaseId,
          scenarioDescription: tc.scenarioDescription,
          scenarioType: tc.scenarioType,
          userInputSequence: tc.userInputSequence,
          successCriteria: storedCriteria,
        });
      }
    });

    transaction();

    return {
      id: suiteId,
      agentId,
      analysisId,
      testCases: storedTestCases,
      createdAt: now,
      updatedAt: now,
    };
  }

  getTestSuite(id: string): StoredTestSuite | null {
    const suiteRow = this.database.db.prepare(
      'SELECT * FROM TestSuite WHERE id = ?'
    ).get(id) as any;

    if (!suiteRow) return null;

    const testCaseRows = this.database.db.prepare(
      'SELECT * FROM TestCase WHERE testSuiteId = ? ORDER BY createdAt'
    ).all(id) as any[];

    const testCases: TestCase[] = testCaseRows.map(tcRow => {
      const criteriaRows = this.database.db.prepare(
        'SELECT * FROM SuccessCriterion WHERE testCaseId = ? ORDER BY createdAt'
      ).all(tcRow.id) as any[];

      return {
        id: tcRow.id,
        scenarioDescription: tcRow.scenarioDescription,
        scenarioType: tcRow.scenarioType,
        userInputSequence: JSON.parse(tcRow.userInputSequence),
        successCriteria: criteriaRows.map(scRow => ({
          id: scRow.id,
          description: scRow.description,
          category: scRow.category,
          evaluationPrompt: scRow.evaluationPrompt,
        })),
      };
    });

    return {
      id: suiteRow.id,
      agentId: suiteRow.agentId,
      analysisId: suiteRow.analysisId,
      testCases,
      createdAt: suiteRow.createdAt,
      updatedAt: suiteRow.updatedAt,
    };
  }
}
