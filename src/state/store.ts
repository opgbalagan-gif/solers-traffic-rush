import { BOY_COLORS, STORAGE_KEY } from '@/src/config/game';

export type Driver = 'boy' | 'girl';

export type StoredGameState = {
  driver: Driver;
  carColor: string;
  bestScore: number;
  phone: string;
  phoneVerified: boolean;
  sawInstallScreen: boolean;
  demoRuns: number;
};

export const DEFAULT_STATE: StoredGameState = {
  driver: 'boy',
  carColor: BOY_COLORS[0].value,
  bestScore: 0,
  phone: '+7',
  phoneVerified: false,
  sawInstallScreen: false,
  demoRuns: 0,
};

export function loadGameState(): StoredGameState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveGameState(state: StoredGameState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
