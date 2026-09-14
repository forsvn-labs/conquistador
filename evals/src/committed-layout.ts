import { execFileSync } from 'node:child_process';

export type CommittedLayout = { prefix: '' | '01-business/conquistador/'; tree: string };

/** Select only recognized layouts and bind reads to the exact candidate tree. */
export function committedLayout(repoRoot: string, commit: string, expectedTree?: string): CommittedLayout {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('[eval-lab] exact source commit required');
  const matches: CommittedLayout[] = [];
  for (const prefix of ['', '01-business/conquistador/'] as const) {
    try {
      if (!expectedTree) execFileSync('git', ['-C', repoRoot, 'cat-file', '-e', `${commit}:${prefix}release/ledger/v1.json`], { stdio: 'pipe' });
      const tree = execFileSync('git', ['-C', repoRoot, 'rev-parse', prefix ? `${commit}:${prefix.slice(0, -1)}` : `${commit}^{tree}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      if (!expectedTree || tree === expectedTree) matches.push({ prefix, tree });
    } catch { /* Missing layouts are not candidates. */ }
  }
  if (matches.length !== 1) throw new Error('[eval-lab] candidate layout is missing, ambiguous, or differs from its exact source tree');
  return matches[0]!;
}
