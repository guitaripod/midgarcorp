const COPIED_MS = 1400;

/// Shows one install channel's command inside its widget and marks its tab.
function selectInstallTab(tab: HTMLElement): void {
  const widget = tab.closest<HTMLElement>('[data-install]');
  if (!widget) return;
  const channel = tab.dataset.installTab;
  widget.querySelectorAll<HTMLElement>('[data-install-tab]').forEach((other) => {
    other.setAttribute('aria-pressed', String(other === tab));
  });
  widget.querySelectorAll<HTMLElement>('[data-install-cmd]').forEach((command) => {
    command.hidden = command.dataset.installCmd !== channel;
  });
}

/// Copies the command a button points at: its own `data-copy`, or the one currently shown
/// in its install widget. Flashes the label once the clipboard accepts it.
async function copyInstallCommand(button: HTMLButtonElement): Promise<void> {
  const shown = button
    .closest('[data-install]')
    ?.querySelector<HTMLElement>('[data-command]:not([hidden])');
  const command = button.dataset.copy ?? shown?.dataset.command;
  if (!command) return;
  try {
    await navigator.clipboard.writeText(command);
  } catch {
    return;
  }
  const original = button.textContent;
  button.textContent = 'copied ✓';
  button.classList.add('text-term-green');
  window.setTimeout(() => {
    button.textContent = original;
    button.classList.remove('text-term-green');
  }, COPIED_MS);
}

let wired = false;

/// Wires every install widget on the page with one delegated click handler: channel tabs
/// swap the shown command and copy buttons copy it. Safe to call from every component that
/// renders a widget; the listener is added once.
export function initLinuxInstall(): void {
  if (wired) return;
  wired = true;
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const tab = target?.closest<HTMLElement>('[data-install-tab]');
    if (tab) return selectInstallTab(tab);
    const copy = target?.closest('.copy-btn');
    if (copy instanceof HTMLButtonElement) void copyInstallCommand(copy);
  });
}
