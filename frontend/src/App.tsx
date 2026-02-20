import { useState, useEffect, useCallback } from 'react';
import { loadState, saveState, type WidgetState } from './utils/state';
import AgentSelector from './components/AgentSelector';
import PromptAnalysisView from './components/PromptAnalysisView';
import TestSuiteEditor from './components/TestSuiteEditor';
import TestRunView from './components/TestRunView';
import PromptDiffView from './components/PromptDiffView';
import ResultsDashboard from './components/ResultsDashboard';
import BeforeAfterView from './components/BeforeAfterView';
import CycleControlPanel from './components/CycleControlPanel';

const TABS = [
  { id: 'analyze', label: 'Analyze' },
  { id: 'test', label: 'Test' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'dashboard', label: 'Dashboard' },
] as const;

export default function App() {
  const [state, setState] = useState<WidgetState>(loadState);

  // Persist state on every change
  useEffect(() => {
    saveState(state);
  }, [state]);

  const setTab = useCallback((tab: string) => {
    setState((s) => ({ ...s, activeTab: tab }));
  }, []);

  const setAgent = useCallback((agentId: string | null) => {
    setState((s) => ({ ...s, selectedAgentId: agentId, analysisId: null, testSuiteId: null, testRunId: null, optimizationId: null, cycleId: null }));
  }, []);

  const setAnalysis = useCallback((analysisId: string | null) => {
    setState((s) => ({ ...s, analysisId }));
  }, []);

  const setTestSuite = useCallback((testSuiteId: string | null) => {
    setState((s) => ({ ...s, testSuiteId }));
  }, []);

  const setTestRun = useCallback((testRunId: string | null) => {
    setState((s) => ({ ...s, testRunId }));
  }, []);

  const setOptimization = useCallback((optimizationId: string | null) => {
    setState((s) => ({ ...s, optimizationId }));
  }, []);

  const setCycle = useCallback((cycleId: string | null) => {
    setState((s) => ({ ...s, cycleId }));
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Voice AI Performance Optimizer</h1>
      </header>

      <nav className="tab-nav" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={state.activeTab === t.id}
            className={`tab-btn${state.activeTab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {state.activeTab === 'analyze' && (
          <>
            <AgentSelector selectedAgentId={state.selectedAgentId} onSelect={setAgent} />
            {state.selectedAgentId && (
              <PromptAnalysisView
                agentId={state.selectedAgentId}
                analysisId={state.analysisId}
                onAnalysis={setAnalysis}
              />
            )}
          </>
        )}

        {state.activeTab === 'test' && (
          <>
            {state.selectedAgentId && state.analysisId ? (
              <>
                <TestSuiteEditor
                  agentId={state.selectedAgentId}
                  analysisId={state.analysisId}
                  testSuiteId={state.testSuiteId}
                  onSuiteCreated={setTestSuite}
                />
                {state.testSuiteId && state.selectedAgentId && (
                  <TestRunView
                    testSuiteId={state.testSuiteId}
                    agentId={state.selectedAgentId}
                    testRunId={state.testRunId}
                    onTestRun={setTestRun}
                  />
                )}
              </>
            ) : (
              <div className="card">
                <p>Select an agent and run analysis first (Analyze tab).</p>
              </div>
            )}
          </>
        )}

        {state.activeTab === 'optimize' && (
          <>
            {state.testRunId && state.selectedAgentId ? (
              <>
                <PromptDiffView
                  testRunId={state.testRunId}
                  agentId={state.selectedAgentId}
                  optimizationId={state.optimizationId}
                  onOptimization={setOptimization}
                />
                {state.testSuiteId && state.selectedAgentId && (
                  <CycleControlPanel
                    agentId={state.selectedAgentId}
                    testSuiteId={state.testSuiteId}
                    cycleId={state.cycleId}
                    onCycle={setCycle}
                  />
                )}
              </>
            ) : (
              <div className="card">
                <p>Run tests first (Test tab) to enable optimization.</p>
              </div>
            )}
          </>
        )}

        {state.activeTab === 'dashboard' && (
          <>
            {state.selectedAgentId ? (
              <>
                <ResultsDashboard agentId={state.selectedAgentId} testRunId={state.testRunId} />
                <BeforeAfterView agentId={state.selectedAgentId} />
              </>
            ) : (
              <div className="card">
                <p>Select an agent first (Analyze tab).</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
