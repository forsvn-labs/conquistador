// Clack reports Escape and Ctrl-C with the same cancellation symbol. Observe
// the key only while a prompt is active so the CLI retains Unix exit semantics.
export function cancellableUi(ui, input = process.stdin) {
  const wrapped = { ...ui };
  for (const name of ['select', 'confirm', 'multiselect', 'text']) {
    wrapped[name] = async options => {
      let interrupted = false;
      const onKey = (_text, key) => { if (key?.ctrl && key.name === 'c') interrupted = true; };
      input.on('keypress', onKey);
      try {
        const value = await ui[name](options);
        if (interrupted && ui.isCancel(value)) throw Object.assign(Error('Cancelled. No files changed.'), { cancelled: true, exitCode: 130 });
        return value;
      } finally { input.off('keypress', onKey); }
    };
  }
  return wrapped;
}
