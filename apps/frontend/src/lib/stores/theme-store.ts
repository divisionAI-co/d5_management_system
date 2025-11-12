import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

const applyThemeToDocument = (theme: Theme) => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
};

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyThemeToDocument(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const nextTheme: Theme = get().theme === 'dark' ? 'light' : 'dark';
        applyThemeToDocument(nextTheme);
        set({ theme: nextTheme });
      },
    }),
    {
      name: 'division5-theme-storage',
      onRehydrateStorage: () => (state) => {
        const restoredTheme = state?.theme ?? 'dark';
        applyThemeToDocument(restoredTheme);
      },
    },
  ),
);

export const getCurrentTheme = () => useThemeStore.getState().theme;

if (typeof document !== 'undefined') {
  applyThemeToDocument(useThemeStore.getState().theme);
}


