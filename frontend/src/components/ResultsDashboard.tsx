import { useState, useEffect } from 'react';
import { fetchTestRun, fetchComparison, type TestRun, type ComparisonData } from '../api';

interface Props {
  agentId: string;
  testRunId: string | null;
}

export default function ResultsDashboard({ agentId, testRunId }: Props) {
  const [run, setRun] = useState<TestRun | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const promises: Promise<void>[] = [];

    if (testRunId) {
      promises.push(
        fetchTestRun(testRunId)
          .then((data) => { if (!cancelled) setRun(data); })
          .catch((err) => { if (!cancelled) setError(err.message); })
      );
    }

    promises.push(
      fetchComparison(agentId)
        .then((data) => { if (!cancelled) setComparison(data); })
        .catch(() => { /* comparison may not exist yet */ })
    );

    Promise.all(promises).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [agentId, testRunId]);

  if (loading) return <div className="card"><div className="loading">Loading dashboard…</div></div>;

  return (
    <div className="card">
      <h2>Results Dashboard</h2>

      {error && (
        <div className="error-msg"><span>{error}</span></div>
      )}

      {run && (
        <>
          <div className="metrics-row">
            <div className="metric-card">
              <div className="value">{Math.round(run.overallPassRate * 100)}%</div>
              <div className="label">Overall Pass Rate</div>
            </div>
            <div className="metric-card">
              <div className="value">{run.results.length}</div>
              <div className="label">Test Cases</div>
            </div>
            <div className="metric-card">
              <div className="value">
                {run.results.reduce((sum, r) => sum + r.criterionResults.length, 0)}
              </div>
              <div className="label">Total Criteria</div>
            </div>
          </div>

          <h3>Per-Criterion Breakdown</h3>
          <ul className="item-list">
            {run.results.flatMap((r) =>
              r.criterionResults.map((cr) => (
                <li key={`${r.testCaseId}-${cr.criterionId}`}>
                  <span className={`badge badge-${cr.passed ? 'pass' : 'fail'}`}>
                    {cr.passed ? 'PASS' : 'FAIL'}
                  </span>
                  <span style={{ flex: 1, marginLeft: 8 }}>
                    {cr.criterionId.slice(0, 8)}
                    {!cr.passed && <span style={{ color: '#991b1b', fontSize: '0.8rem' }}> — {cr.explanation}</span>}
                  </span>
                </li>
              ))
            )}
          </ul>
        </>
      )}

      {comparison && comparison.runs.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <h3>Trend Across Runs</h3>
          <ul className="trend-list">
            {comparison.runs.map((r, i) => (
              <li key={r.id}>
                <span>Run {i + 1}</span>
                <span>{Math.round(r.overallPassRate * 100)}%</span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  {r.completedAt ? new Date(r.completedAt).toLocaleDateString() : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!run && !comparison && (
        <p>No test results available yet. Run tests first.</p>
      )}
    </div>
  );
}
