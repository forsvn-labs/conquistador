// Explicit real-runtime acceptance from the full source checkout. The shared
// runner owns isolated native state, bounded calls, reports, and cleanup.
await import('../../tools/e2e/executor-v2.mjs');
