import { useState, useEffect, useCallback } from 'react';
import { triggerAnalysis, type PromptAnalysis } from '../api';

interface Props {
  agentId: string;
  analysisId: string | null;
  onAnalysis: (analysisId: string | null) => void;
}

export default function PromptAnalysisView({ agentId, analysisId, onAnalysis }: Props) {
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when agent changes
  useEffect(() => {
    if (!analysisId) {
      setAnalysis(null);
    }
  }, [analysisId]);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await triggerAnalysis(agentId);
      setAnalysis(result);
      onAnalysis(result.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [agentId, onAnalysis]);

  return (
    <div className="card">
      <h2>Prompt Analysis</h2>

      {error && (
        <div className="error-msg">
          <span>{error}</span>
          <button className="btn btn-sm btn-secondary" onClick={runAnalysis}>Retry</button>
        </div>
      )}

      {!analysis && !loading && (
        <button className="btn btn-primary" onClick={runAnalysis} disabled={loading}>
          Analyze Agent Prompt
        </button>
      )}

      {loading && <div className="loading">Analyzing prompt…</div>}

      {analysis && (
        <div>
          <section>
            <h3>Goals</h3>
            <ul>
              {analysis.goals.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </section>

          <section style={{ marginTop: 12 }}>
            <h3>Conversation Flows</h3>
            {analysis.conversationFlows.map((flow, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <strong>{flow.name}</strong>: {flow.description}
                <ol>
                  {flow.steps.map((step, j) => (
                    <li key={j}>{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </section>

          <section style={{ marginTop: 12 }}>
            <h3>Expected Behaviors</h3>
            <ul className="item-list">
              {analysis.expectedBehaviors.map((b, i) => (
                <li key={i}>
                  <span>{b.description}</span>
                  <span className={`badge badge-${b.category}`}>{b.category}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="actions">
            <button className="btn btn-secondary" onClick={runAnalysis}>
              Re-analyze
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
