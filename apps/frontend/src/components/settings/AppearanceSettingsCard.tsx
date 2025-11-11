import { useMemo } from 'react';
import { useThemeStore } from '@/lib/stores/theme-store';
import type { Theme } from '@/lib/stores/theme-store';

const THEMES: Array<{
  value: Theme;
  title: string;
  description: string;
}> = [
  {
    value: 'light',
    title: 'Light mode',
    description: 'Balanced contrast with a bright, neutral background.',
  },
  {
    value: 'dark',
    title: 'Dark mode',
    description: 'Reduced glare and softer colors for low-light environments.',
  },
];

export function AppearanceSettingsCard() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const activeThemeCopy = useMemo(() => {
    const active = THEMES.find((item) => item.value === theme);
    return active?.description ?? '';
  }, [theme]);

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Choose a theme that best fits your workspace and lighting.
        </p>
      </header>

      <div className="space-y-6 px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {THEMES.map((item) => {
            const isActive = item.value === theme;

            return (
              <label
                key={item.value}
                className={`flex cursor-pointer flex-col gap-3 rounded-lg border p-4 transition focus-within:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
                    : 'border-border bg-background hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>

                  <input
                    type="radio"
                    name="theme"
                    value={item.value}
                    checked={isActive}
                    onChange={() => setTheme(item.value)}
                    className="h-4 w-4 border-border text-blue-600 focus:ring-blue-500"
                  />
                </div>

                <div className="overflow-hidden rounded-md border border-border bg-card">
                  <div
                    className={`flex h-20 items-center justify-center text-sm ${
                      item.value === 'dark'
                        ? 'bg-zinc-900 text-zinc-200'
                        : 'bg-background text-foreground'
                    }`}
                  >
                    {item.title} preview
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
          Active theme: <span className="font-medium text-foreground">{theme}</span>
          <span className="mx-2 text-border" aria-hidden="true">
            |
          </span>
          {activeThemeCopy}
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
        >
          Toggle theme
        </button>
      </div>
    </section>
  );
}


