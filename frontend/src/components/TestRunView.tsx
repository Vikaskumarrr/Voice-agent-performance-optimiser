import { useState, useCallback } from 'react';
import {
  startTestRun,
  fetchTestRun,
  retryTestCase,
  type TestRun,
  type TestCaseResult,
} from '../api';

interface Props {
  testSuiteId: string;
  agentId: string;
  testRunId: string | null;
  onTestRun: (id: string | null) => void;
}

export default function TestRunView({ testSuiteId, agentId, testRunId, onTestRun }: Props) {
  const [run, setRun] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await startTestRun(testSuiteId, agentId);
      setRun(result);
      onTestRun(result.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Test run failed');
    } finally {
      setLoading(false);
    }
  }, [testSuiteId, agentId, onTestRun]);

  const loadRun = useCallback(async () => {
    if (!testRunId) return;
    setLoading(true);
    try {
      const result = await fetchTestRun(testRunId);
      setRun(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load run');
    } finally {
      setLoading(false);
    }
  }, [testRunId]);

  const handleRetry = useCallback(async (caseId: string) => {
    if (!run) return;
    try {
      const updated = await retryTestCase(run.id, caseId);
      setRun((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          results: prev.results.map((r: TestCaseResult) =>
            r.testCaseId === caseId ? updated : r
          ),
        };
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    }
  }, [run]);

  return (
    <div className="card">
      <h2>Test Run</h2>

      {error && (
        <div className="error-msg">
          <span>{error}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="actions" style={{ marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={executeRun} disabled={loading}>
          {run ? 'Run Again' : 'Start Test Run'}
        </button>
        {testRunId && !run && (
          <button className="btn btn-secondary" onClick={loadRun} disabled={loading}>
            Load Previous Run
          </button>
        )}
      </div>

      {loading && <div className="loading">Running tests…</div>}

      {run && (
        <div>
          <div className="metrics-row">
            <div className="metric-card">
              <div className="value">{Math.round(run.overallPassRate * 100)}%</div>
              <div className="label">Pass Rate</div>
            </div>
            <div className="metric-card">
              <div className="value">{run.results.length}</div>
              <div className="label">Test Cases</div>
            </div>
            <div className="metric-card">
              <div className="value">
                <span className={`badge badge-${run.status === 'completed' ? 'completed' : 'running'}`}>
                  {run.status}
                </span>
              </div>
              <div className="label">Status</div>
            </div>
          </div>

          {run.results.map((result: TestCaseResult) => (
            <div key={result.testCaseId} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #e2e4e9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className={`badge badge-${result.status === 'error' ? 'error' : 'completed'}`}>
                  {result.status}
                </span>
                <strong>Case: {result.testCaseId.slice(0, 8)}</strong>
                {result.status === 'error' && (
                  <button className="btn btn-sm btn-secondary" onClick={() => handleRetry(result.testCaseId)}>
                    Retry
                  </button>
                )}
              </div>

              {result.errorMessage && (
                <div className="error-msg" style={{ marginBottom: 8 }}>
                  <span>{result.errorMessage}</span>
                </div>
              )}

              {result.agentResponses.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ fontSize: '0.85rem' }}>Agent Responses:</strong>
                  {result.agentResponses.map((resp, i) => (
                    <div key={i} style={{ marginLeft: 12, fontSize: '0.85rem', color: '#374151' }}>
                      Turn {resp.turn}: {resp.utterance}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <strong style={{ fontSize: '0.85rem' }}>Criteria Results:</strong>
                <ul className="item-list">
                  {result.criterionResults.map((cr) => (
                    <li key={cr.criterionId}>
                      <span className={`badge badge-${cr.passed ? 'pass' : 'fail'}`}>
                        {cr.passed ? 'PASS' : 'FAIL'}
                      </span>
                      <span style={{ flex: 1, marginLeft: 8 }}>
                        {cr.criterionId.slice(0, 8)}
                        {!cr.passed && cr.explanation && (
                          <div style={{ fontSize: '0.8rem', color: '#991b1b', marginTop: 2 }}>
                            {cr.explanation}
                          </div>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
