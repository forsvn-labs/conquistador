export const UNCHANGED_COMMANDS: readonly string[];
export const KEPT_PLAYS: readonly string[];
export function isThinCommand(name: string, task?: string): boolean;
export function isThinPlay(name: string): boolean;
export function commandDocumentFor(name: string, task?: string): 'ENTRY.md' | 'COMMAND.md';
