(() => {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  const stored = localStorage.getItem('bteu-theme');
  if (stored) document.documentElement.dataset.theme = stored;
  toggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('bteu-theme', next);
  });
})();
