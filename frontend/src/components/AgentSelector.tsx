import { useState, useEffect } from 'react';
import { fetchAgents, type Agent } from '../api';

interface Props {
  selectedAgentId: string | null;
  onSelect: (agentId: string | null) => void;
}

export default function AgentSelector({ selectedAgentId, onSelect }: Props) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAgents()
      .then((data) => {
        if (!cancelled) setAgents(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="card">
      <h2>Select Voice AI Agent</h2>

      {error && (
        <div className="error-msg">
          <span>{error}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {loading && <div className="loading">Loading agents…</div>}

      {!loading && !error && agents.length === 0 && (
        <p>No agents found.</p>
      )}

      {!loading && agents.length > 0 && (
        <ul className="agent-list">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className={selectedAgentId === agent.id ? 'selected' : ''}
              onClick={() => onSelect(agent.id)}
              role="option"
              aria-selected={selectedAgentId === agent.id}
            >
              <strong>{agent.name}</strong>
              <br />
              <small>ID: {agent.id}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
