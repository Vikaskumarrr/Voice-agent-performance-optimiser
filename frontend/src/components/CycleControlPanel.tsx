import { useState, useEffect, useCallback } from 'react';
import {
  startCycle,
  fetchCycle,
  cancelCycle,
  subscribeCycleEvents,
  type CycleRecord,
} from '../api';

interface Props {
  agentId: string;
  testSuiteId: string;
  cycleId: string | null;
  onCycle: (id: string | null) => void;
}

interface CycleEvent {
  type: string;
  data: unknown;
}

export default function CycleControlPanel({ agentId, testSuiteId, cycleId, onCycle }: Props) {
  const [cycle, setCycle] = useState<CycleRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.9);
  const [maxCycles, setMaxCycles] = useState(5);
  const [events, setEvents] = useState<CycleEvent[]>([]);

  // Load existing cycle
  useEffect(() => {
    if (!cycleId) return;
    let cancelled = false;
    fetchCycle(cycleId)
      .then((data) => { if (!cancelled) setCycle(data); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [cycleId]);

  // Subscribe to SSE events when cycle is running
  useEffect(() => {
    if (!cycle || cycle.status !== 'running') return;
    const unsub = subscribeCycleEvents(cycle.id, (event) => {
      setEvents((prev) => [...prev, event]);
      // Refresh cycle data on progress events
      fetchCycle(cycle.id)
        .then(setCycle)
        .catch(() => { /* ignore */ });
    });
    return unsub;
  }, [cycle?.id, cycle?.status]);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEvents([]);
    try {
      const result = await startCycle(agentId, testSuiteId, threshold, maxCycles);
      setCycle(result);
      onCycle(result.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start cycle');
    } finally {
      setLoading(false);
    }
  }, [agentId, testSuiteId, threshold, maxCycles, onCycle]);

  const cancel = useCallback(async () => {
    if (!cycle) return;
    try {
      const updated = await cancelCycle(cycle.id);
      setCycle(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  }, [cycle]);

  return (
    <div className="card">
      <h2>Auto-Optimization Cycle</h2>

      {error && (
        <div className="error-msg">
          <span>{error}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {!cycle && (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="threshold">Target Pass Rate</label>
              <input
                id="threshold"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="maxCycles">Max Cycles</label>
              <input
                id="maxCycles"
                type="number"
                min={1}
                max={20}
                value={maxCycles}
                onChange={(e) => setMaxCycles(Number(e.target.value))}
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={start} disabled={loading}>
            Start Auto-Cycle
          </button>
        </div>
      )}

      {loading && <div className="loading">Starting cycle…</div>}

      {cycle && (
        <div>
          <div className="metrics-row">
            <div className="metric-card">
              <div className="value">{cycle.cycleCount}</div>
              <div className="label">Cycles Run</div>
            </div>
            <div className="metric-card">
              <div className="value">{Math.round(cycle.startingPassRate * 100)}%</div>
              <div className="label">Starting Rate</div>
            </div>
            <div className="metric-card">
              <div className="value">{Math.round(cycle.endingPassRate * 100)}%</div>
              <div className="label">Current Rate</div>
            </div>
            <div className="metric-card">
              <div className="value">
                <span className={`badge badge-${cycle.status}`}>{cycle.status}</span>
              </div>
              <div className="label">Status</div>
            </div>
          </div>

          <div className="progress-bar">
            <div
              className="fill"
              style={{ width: `${Math.min(100, (cycle.cycleCount / cycle.maxCycles) * 100)}%` }}
            />
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 12 }}>
            {cycle.cycleCount} / {cycle.maxCycles} cycles — Target: {Math.round(cycle.targetThreshold * 100)}%
          </div>

          {cycle.status === 'running' && (
            <div className="actions">
              <button className="btn btn-danger" onClick={cancel}>Cancel</button>
            </div>
          )}

          {(cycle.status === 'completed' || cycle.status === 'cancelled') && (
            <div>
              <h3>Summary</h3>
              <p>
                Started at {Math.round(cycle.startingPassRate * 100)}%, ended at{' '}
                {Math.round(cycle.endingPassRate * 100)}% after {cycle.cycleCount} cycle
                {cycle.cycleCount !== 1 ? 's' : ''}.
              </p>
              <div className="actions">
                <button className="btn btn-primary" onClick={() => { setCycle(null); onCycle(null); setEvents([]); }}>
                  Start New Cycle
                </button>
              </div>
            </div>
          )}

          {events.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h3>Events</h3>
              <ul className="trend-list">
                {events.slice(-10).map((ev, i) => (
                  <li key={i}>
                    <span className="badge badge-running">{ev.type}</span>
                    <span style={{ fontSize: '0.8rem' }}>{JSON.stringify(ev.data)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
