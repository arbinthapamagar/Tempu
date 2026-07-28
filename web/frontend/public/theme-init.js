// Apply the saved theme before paint to avoid a flash of the wrong mode.
// Lives in public/ rather than inline in index.html so the backend's CSP can
// stay strict (script-src 'self') — an inline block would need 'unsafe-inline'
// or a content hash that silently breaks the page whenever this file changes.
(function () {
  try {
    var m = localStorage.getItem('shakti_theme') || 'system';
    var dark = m === 'dark' || (m === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) { /* ignore */ }
})();
