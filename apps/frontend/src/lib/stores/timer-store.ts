import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface TimerState {
  taskId: string;
  startTime: number;
  taskTitle?: string; // Store task title for auto-logging on logout
}

interface TimerStore {
  runningTimer: TimerState | null;
  setRunningTimer: (timer: TimerState | null) => void;
  clearTimer: () => void;
}

export const useTimerStore = create<TimerStore>()(
  persist(
    (set) => ({
      runningTimer: null,
      setRunningTimer: (timer) => set({ runningTimer: timer }),
      clearTimer: () => set({ runningTimer: null }),
    }),
    {
      name: 'division5-timer-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

