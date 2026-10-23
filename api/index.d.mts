export type Channel = 'x' | 'linkedin' | 'email' | 'landing' | 'google-ads' | 'meta-ads' | 'article' | 'social' | 'web' | 'general';
export type Format = 'markdown' | 'html' | 'text';
export interface Receipt {
  sha256: string;
  clean: boolean;
  blocking: number;
  channel: string;
  format: string;
  contextSha256: string | null;
  signature: string | null;
}
export interface BriefResult {
  action: 'brief' | 'none';
  mode: 'none' | 'assist' | 'command' | 'workflow';
  reason?: string;
  budgetBytes?: number;
  callerContextStatus?: 'absent' | 'included' | 'retained-by-caller';
  provenance?: Array<{ path: string; reason: string; bytes: number; sha256: string | null; status: 'included' | 'deferred' | 'unavailable' }>;
  command?: string | null;
  play?: string | null;
  inlined: Array<{ path: string; title: string }>;
  readNow: string[];
  readAtStep: Array<{ step: number; path: string }>;
  situational: string[];
}
export interface CheckResult {
  channel: string;
  clean: boolean;
  blocking: number;
  truncated: boolean;
  findings: Array<{ rule: string; name: string; family: string; severity: 'error' | 'warning' | 'advisory'; message: string; fix: string; line: number; snippet: string }>;
  receipt: Receipt;
}
export interface VerifyResult { valid: boolean; clean: boolean; signed: boolean; reason: string }
export interface ToolArguments {
  conquistador_brief: { task: string; context?: string; size?: 'full' | 'compact' };
  conquistador_check: { text: string; channel?: Channel; format?: Format; context?: string };
  conquistador_verify: { text: string; receipt: Receipt; context?: string; channel?: Channel };
  conquistador_score: { rubric: string; variant?: string; scores: Record<string, number | string>; hardFails?: string[] };
  conquistador_search: { query: string };
  conquistador_methods: Record<string, never>;
  conquistador_files: { method: string };
  conquistador_read: { path: string; from?: string };
}
export type ToolName = keyof ToolArguments;
export interface ToolResults {
  conquistador_brief: BriefResult;
  conquistador_check: CheckResult;
  conquistador_verify: VerifyResult;
  conquistador_score: Record<string, unknown>;
  conquistador_search: never;
  conquistador_methods: never;
  conquistador_files: never;
  conquistador_read: never;
}
export interface ToolResult<T = unknown> {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: T;
  isError?: true;
}
export interface ToolDefinition {
  readonly name: ToolName;
  readonly description: string;
  readonly inputSchema: { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
  readonly outputSchema?: Record<string, unknown>;
  readonly annotations?: Record<string, boolean>;
}
export interface Conquistador {
  readonly instructions: string;
  readonly tools: ReadonlyArray<ToolDefinition>;
  callTool<N extends ToolName>(name: N, ...args: N extends 'conquistador_methods' ? [arguments?: ToolArguments[N]] : [arguments: ToolArguments[N]]): ToolResult<ToolResults[N]>;
}
/** Uses only packaged playbooks and caller context. No UI, listener, model, or home state. */
export function createConquistador(options?: { receiptKey?: string }): Conquistador;
