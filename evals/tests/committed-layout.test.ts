import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { committedLayout } from '../src/committed-layout.ts';

describe('exact committed product layout', () => {
  it.each(['', '01-business/conquistador/'])('reads %s without relabeling its tree', prefix => {
    const root = mkdtempSync(resolve(tmpdir(), 'conquistador-layout-'));
    const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
    try {
      git('init', '-q'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
      mkdirSync(resolve(root, prefix, 'release/ledger'), { recursive: true });
      writeFileSync(resolve(root, prefix, 'release/ledger/v1.json'), '{}');
      git('add', '.'); git('commit', '-qm', 'layout fixture');
      const commit = git('rev-parse', 'HEAD');
      const tree = git('rev-parse', prefix ? `HEAD:${prefix.slice(0, -1)}` : 'HEAD^{tree}');
      expect(committedLayout(root, commit, tree)).toEqual({ prefix, tree });
      expect(() => committedLayout(root, commit, '0'.repeat(40))).toThrow('source tree');
      expect(() => committedLayout(root, 'HEAD')).toThrow('exact source commit');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
