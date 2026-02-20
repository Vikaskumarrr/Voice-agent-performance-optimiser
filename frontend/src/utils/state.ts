// Widget state persistence to localStorage

const STORAGE_KEY = 'voice-ai-optimizer-state';

export interface WidgetState {
  activeTab: string;
  selectedAgentId: string | null;
  analysisId: string | null;
  testSuiteId: string | null;
  testRunId: string | null;
  optimizationId: string | null;
  cycleId: string | null;
}

export const defaultState: WidgetState = {
  activeTab: 'analyze',
  selectedAgentId: null,
  analysisId: null,
  testSuiteId: null,
  testRunId: null,
  optimizationId: null,
  cycleId: null,
};

export function saveState(state: WidgetState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

export function loadState(): WidgetState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed };
  } catch {
    return { ...defaultState };
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
