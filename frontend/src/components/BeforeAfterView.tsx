import { useState, useEffect } from 'react';
import { fetchComparison, type ComparisonData } from '../api';

interface Props {
  agentId: string;
}

export default function BeforeAfterView({ agentId }: Props) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchComparison(agentId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agentId]);

  if (loading) return <div className="card"><div className="loading">Loading comparison…</div></div>;

  if (error) {
    return (
      <div className="card">
        <h2>Before vs. After</h2>
        <div className="error-msg"><span>{error}</span></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <h2>Before vs. After</h2>
        <p>No optimization data available yet.</p>
      </div>
    );
  }

  const origRate = Math.round(data.originalMetrics.passRate * 100);
  const currRate = Math.round(data.currentMetrics.passRate * 100);
  const diff = currRate - origRate;

  return (
    <div className="card">
      <h2>Before vs. After</h2>

      <div className="metrics-row">
        <div className="metric-card">
          <div className="value">{origRate}%</div>
          <div className="label">Original Pass Rate</div>
        </div>
        <div className="metric-card">
          <div className="value">{currRate}%</div>
          <div className="label">Current Pass Rate</div>
        </div>
        <div className="metric-card">
          <div className={`value ${diff > 0 ? 'improvement' : diff < 0 ? 'regression' : ''}`}>
            {diff > 0 ? '+' : ''}{diff}%
          </div>
          <div className="label">Change</div>
        </div>
      </div>

      <div className="diff-container">
        <div className="diff-pane">
          <h4>Original Prompt</h4>
          {data.originalPrompt}
        </div>
        <div className="diff-pane">
          <h4>Current Prompt</h4>
          {data.currentPrompt}
        </div>
      </div>

      {data.improvements.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3 className="improvement">Improvements</h3>
          <ul>
            {data.improvements.map((item, i) => (
              <li key={i} className="improvement">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {data.regressions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3 className="regression">Regressions</h3>
          <ul>
            {data.regressions.map((item, i) => (
              <li key={i} className="regression">{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
