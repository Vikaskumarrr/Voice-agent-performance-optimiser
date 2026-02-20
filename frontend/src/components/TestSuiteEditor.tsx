import { useState, useEffect, useCallback } from 'react';
import {
  createTestSuite,
  fetchTestSuite,
  updateTestSuite,
  type TestSuite,
  type TestCase,
  type SuccessCriterion,
} from '../api';

interface Props {
  agentId: string;
  analysisId: string;
  testSuiteId: string | null;
  onSuiteCreated: (id: string | null) => void;
}

export default function TestSuiteEditor({ agentId, analysisId, testSuiteId, onSuiteCreated }: Props) {
  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editingCriterion, setEditingCriterion] = useState<string | null>(null);
  const [editCritDesc, setEditCritDesc] = useState('');

  useEffect(() => {
    if (!testSuiteId) return;
    let cancelled = false;
    setLoading(true);
    fetchTestSuite(testSuiteId)
      .then((data) => { if (!cancelled) setSuite(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [testSuiteId]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createTestSuite(agentId, analysisId);
      setSuite(result);
      onSuiteCreated(result.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  }, [agentId, analysisId, onSuiteCreated]);

  const saveSuite = useCallback(async (testCases: TestCase[]) => {
    if (!suite) return;
    try {
      const updated = await updateTestSuite(suite.id, testCases);
      setSuite(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }, [suite]);

  const removeCase = useCallback((caseId: string) => {
    if (!suite) return;
    saveSuite(suite.testCases.filter((tc) => tc.id !== caseId));
  }, [suite, saveSuite]);

  const saveEditCase = useCallback((caseId: string) => {
    if (!suite) return;
    saveSuite(suite.testCases.map((tc) =>
      tc.id === caseId ? { ...tc, scenarioDescription: editDesc } : tc
    ));
    setEditingCase(null);
  }, [suite, editDesc, saveSuite]);

  const removeCriterion = useCallback((caseId: string, critId: string) => {
    if (!suite) return;
    saveSuite(suite.testCases.map((tc) =>
      tc.id === caseId
        ? { ...tc, successCriteria: tc.successCriteria.filter((c) => c.id !== critId) }
        : tc
    ));
  }, [suite, saveSuite]);

  const saveEditCriterion = useCallback((caseId: string, critId: string) => {
    if (!suite) return;
    saveSuite(suite.testCases.map((tc) =>
      tc.id === caseId
        ? {
            ...tc,
            successCriteria: tc.successCriteria.map((c: SuccessCriterion) =>
              c.id === critId ? { ...c, description: editCritDesc } : c
            ),
          }
        : tc
    ));
    setEditingCriterion(null);
  }, [suite, editCritDesc, saveSuite]);

  return (
    <div className="card">
      <h2>Test Suite</h2>
      {error && (
        <div className="error-msg">
          <span>{error}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      {!suite && !loading && (
        <button className="btn btn-primary" onClick={generate}>Generate Test Suite</button>
      )}
      {loading && <div className="loading">Generating test cases…</div>}
      {suite && (
        <div>
          <p style={{ marginBottom: 12 }}>
            {suite.testCases.length} test case{suite.testCases.length !== 1 ? 's' : ''}
          </p>
          {suite.testCases.map((tc) => (
            <div key={tc.id} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #e2e4e9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className={`badge badge-${tc.scenarioType === 'happy-path' ? 'happy' : 'adversarial'}`}>
                  {tc.scenarioType}
                </span>
                {editingCase === tc.id ? (
                  <div className="inline-edit" style={{ flex: 1 }}>
                    <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
                    <button className="btn btn-sm btn-success" onClick={() => saveEditCase(tc.id)}>Save</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingCase(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{tc.scenarioDescription}</span>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setEditingCase(tc.id); setEditDesc(tc.scenarioDescription); }}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => removeCase(tc.id)}>Remove</button>
                  </>
                )}
              </div>
              <div style={{ marginLeft: 16 }}>
                <strong style={{ fontSize: '0.85rem' }}>Criteria:</strong>
                <ul className="item-list">
                  {tc.successCriteria.map((crit) => (
                    <li key={crit.id}>
                      {editingCriterion === crit.id ? (
                        <div className="inline-edit" style={{ flex: 1 }}>
                          <textarea value={editCritDesc} onChange={(e) => setEditCritDesc(e.target.value)} rows={2} />
                          <button className="btn btn-sm btn-success" onClick={() => saveEditCriterion(tc.id, crit.id)}>Save</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditingCriterion(null)}>Cancel</button>
                        </div>
                      ) : (
                        <>
                          <span style={{ flex: 1 }}>
                            <span className={`badge badge-${crit.category}`}>{crit.category}</span>{' '}
                            {crit.description}
                          </span>
                          <button className="btn btn-sm btn-secondary" onClick={() => { setEditingCriterion(crit.id); setEditCritDesc(crit.description); }}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => removeCriterion(tc.id, crit.id)}>Remove</button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
          <div className="actions">
            <button className="btn btn-secondary" onClick={generate}>Regenerate</button>
          </div>
        </div>
      )}
    </div>
  );
}
