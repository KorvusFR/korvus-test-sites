/**
 * Inlined script that runs before React hydrates to prevent
 * flash of wrong theme (FOUT). Must be a Server Component
 * so it renders inline without `use client`.
 */
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem('taguardian_theme');
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (theme === 'dark' || (!theme && prefersDark)) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch(e) {}
    })();
  `.trim();

  return (
    <script
      id="theme-init"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
