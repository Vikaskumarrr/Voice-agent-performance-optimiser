export type OptimizationStatus = 'generated' | 'accepted' | 'rejected';
export type CycleStatus = 'running' | 'paused' | 'completed' | 'cancelled';

const OPTIMIZATION_TRANSITIONS: Record<OptimizationStatus, OptimizationStatus[]> = {
  generated: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
};

const CYCLE_TRANSITIONS: Record<CycleStatus, CycleStatus[]> = {
  running: ['paused', 'cancelled', 'completed'],
  paused: ['running', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function transitionOptimizationStatus(current: OptimizationStatus, next: OptimizationStatus): OptimizationStatus {
  const allowed = OPTIMIZATION_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new Error(`Invalid optimization status transition: '${current}' → '${next}'`);
  }
  return next;
}

export function transitionCycleStatus(current: CycleStatus, next: CycleStatus): CycleStatus {
  const allowed = CYCLE_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new Error(`Invalid cycle status transition: '${current}' → '${next}'`);
  }
  return next;
}
