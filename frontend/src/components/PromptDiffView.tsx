import { useState, useCallback } from 'react';
import {
  generateOptimization,
  applyOptimization,
  type OptimizationRecord,
} from '../api';

interface Props {
  testRunId: string;
  agentId: string;
  optimizationId: string | null;
  onOptimization: (id: string | null) => void;
}

export default function PromptDiffView({ testRunId, agentId, optimizationId: _optimizationId, onOptimization }: Props) {
  const [record, setRecord] = useState<OptimizationRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');

  const optimize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateOptimization(testRunId, agentId);
      setRecord(result);
      onOptimization(result.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Optimization failed');
    } finally {
      setLoading(false);
    }
  }, [testRunId, agentId, onOptimization]);

  const accept = useCallback(async () => {
    if (!record) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await applyOptimization(record.id);
      setRecord(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply optimization');
    } finally {
      setLoading(false);
    }
  }, [record]);

  const reject = useCallback(() => {
    setRecord((prev) => prev ? { ...prev, status: 'rejected' } : prev);
  }, []);

  const startEdit = useCallback(() => {
    if (!record) return;
    setEditedPrompt(record.revisedPrompt);
    setEditing(true);
  }, [record]);

  const saveEdit = useCallback(() => {
    setRecord((prev) => prev ? { ...prev, revisedPrompt: editedPrompt } : prev);
    setEditing(false);
  }, [editedPrompt]);

  return (
    <div className="card">
      <h2>Prompt Optimization</h2>

      {error && (
        <div className="error-msg">
          <span>{error}</span>
          <button className="btn btn-sm btn-secondary" onClick={optimize}>Retry</button>
        </div>
      )}

      {!record && !loading && (
        <button className="btn btn-primary" onClick={optimize}>
          Generate Optimized Prompt
        </button>
      )}

      {loading && <div className="loading">Optimizing prompt…</div>}

      {record && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <span className={`badge badge-${record.status === 'accepted' ? 'pass' : record.status === 'rejected' ? 'fail' : 'running'}`}>
              {record.status}
            </span>
          </div>

          {record.changes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <h3>Changes</h3>
              <ul>
                {record.changes.map((ch, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    <strong>{ch.description}</strong>: {ch.rationale}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="diff-container">
            <div className="diff-pane">
              <h4>Original</h4>
              {record.originalPrompt}
            </div>
            <div className="diff-pane">
              <h4>Revised</h4>
              {editing ? (
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  style={{ width: '100%', minHeight: 200, fontFamily: 'monospace', fontSize: '0.82rem' }}
                />
              ) : (
                record.revisedPrompt
              )}
            </div>
          </div>

          {record.status === 'generated' && (
            <div className="actions">
              <button className="btn btn-success" onClick={accept} disabled={loading}>Accept</button>
              <button className="btn btn-danger" onClick={reject}>Reject</button>
              {editing ? (
                <button className="btn btn-secondary" onClick={saveEdit}>Save Edit</button>
              ) : (
                <button className="btn btn-secondary" onClick={startEdit}>Edit</button>
              )}
            </div>
          )}

          <div className="actions">
            <button className="btn btn-secondary" onClick={optimize}>Re-optimize</button>
          </div>
        </div>
      )}
    </div>
  );
}
