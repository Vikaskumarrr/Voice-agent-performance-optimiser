import express from 'express';
import cors from 'cors';
import { getDatabase } from './database';
import { createAgentsRouter } from './routes/agents';
import { createAnalysisRouter } from './routes/analysis';
import { createTestSuitesRouter } from './routes/test-suites';
import { createTestRunsRouter } from './routes/test-runs';
import { createOptimizeRouter } from './routes/optimize';
import { createCyclesRouter } from './routes/cycles';
import { getLLMService } from './services/llm-service-factory';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
const database = getDatabase();
const llmService = getLLMService();
app.use('/api/agents', createAgentsRouter(database));
app.use('/api/analysis', createAnalysisRouter(database, llmService));
app.use('/api/test-suites', createTestSuitesRouter(database, llmService));
app.use('/api/test-runs', createTestRunsRouter(database, llmService));
app.use('/api/optimize', createOptimizeRouter(database, llmService));
app.use('/api/cycles', createCyclesRouter(database, llmService));

export { app };

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Voice AI Performance Optimizer backend running on port ${PORT}`);
  });
}
