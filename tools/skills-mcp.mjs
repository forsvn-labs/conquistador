import { constants, openSync, closeSync, readSync, fstatSync, lstatSync, realpathSync, opendirSync, readFileSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrief, formatBriefPack, searchKnowledge } from './brief.mjs';

export const LIMITS = Object.freeze({ request: 65536, file: 262144, response: 524288, files: 256, depth: 8, methods: 128, entries: 2048 });
const bundledRoot = fileURLToPath(new URL('../skills', import.meta.url));
const decoder = new TextDecoder('utf-8', { fatal: true });
const extensions = new Set(['.md', '.json', '.yaml', '.yml', '.txt', '.csv', '.tsv', '.py', '.sh', '.swift', '.pbxproj', '.xcworkspacedata']);
const segment = /^[A-Za-z0-9](?:[A-Za-z0-9._ -]*[A-Za-z0-9_-])?$/;
const protocolVersions = new Set(['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']);
const methodPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const schema = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const TOOLS = [
  { name: 'conquistador_brief', description: 'Call this FIRST for any growth, GTM, launch, marketing, sales, pricing, positioning, copy, content, SEO, ads, outreach, or product-marketing task. Describe the task in plain words. Returns the selected method and the full text of the field-tested playbooks for that task, plus the rules for using them. Read the whole response before drafting.', inputSchema: { type: 'object', properties: { task: { type: 'string', minLength: 1, maxLength: 8000, description: 'The user request, including product, audience, channel, and goal when known.' } }, required: ['task'], additionalProperties: false } },
  { name: 'conquistador_search', description: 'Search all Conquistador playbooks, platform guides, examples, and your own playbooks by keyword. Use it when a task reaches a step the brief did not cover. Returns paths with summaries; read one with conquistador_read.', inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 1, maxLength: 400 } }, required: ['query'], additionalProperties: false } },
  { name: 'conquistador_methods', description: 'List bundled methods and the parent guide. Prefer conquistador_brief, which selects methods and playbooks for you.', inputSchema: schema({}) },
  { name: 'conquistador_files', description: 'List readable text resources in one bundled method. Scripts are text only and are never executed.', inputSchema: schema({ method: { type: 'string', pattern: methodPattern.source, maxLength: 100 } }) },
  { name: 'conquistador_read', description: 'Read one bundled method or playbook by its skills-relative path, such as plan-campaign/references/channel-strategy.md, or a path returned by conquistador_brief or conquistador_search. No project files, credentials or runtime state are available.', inputSchema: schema({ path: { type: 'string', minLength: 1, maxLength: 400 } }) },
].map(tool => ({ ...tool, annotations: readOnly }));
const PROMPTS = [
  { name: 'launch', title: 'Plan a launch', description: 'Plan a product launch with the Conquistador playbooks.', text: 'Plan a launch for {{product}}. Use conquistador_brief first and follow its playbooks.' },
  { name: 'diagnose-growth', title: 'Diagnose a growth stall', description: 'Find why a growth metric changed.', text: 'Diagnose this growth change: {{product}}. Use conquistador_brief first and follow its playbooks.' },
  { name: 'write-copy', title: 'Write marketing copy', description: 'Write landing page, email, or ad copy.', text: 'Write marketing copy for {{product}}. Use conquistador_brief first and follow its playbooks.' },
  { name: 'review-results', title: 'Review campaign results', description: 'Decide what to keep, drop, and test next.', text: 'Review these results and tell me what to keep, drop, and test: {{product}}. Use conquistador_brief first and follow its playbooks.' },
].map(prompt => ({ ...prompt, arguments: [{ name: 'product', description: 'Product, audience, goal, and any facts or numbers you have.', required: true }] }));
export const SERVER_INSTRUCTIONS = 'Conquistador supplies field-tested playbooks for growth, GTM, launch, marketing, sales, pricing, positioning, copy, content, SEO, ads, and outreach work. For any such task, call conquistador_brief with the task before you draft, read the whole result, apply its specific rules, and end your answer with "Playbooks applied": each file and the rule you took from it. Never invent metrics, quotes, or customer facts. Ask the user before publishing, spending, or sending. Your host supplies the model, tools, and permissions; this server only reads playbooks.';
const packageVersion = (() => { try { return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version; } catch { return '0.0.0'; } })();

// The caller controls only relative names, never the bundle root. Reject every symlink
// below the canonical installation root, including intermediate directories.
export function createMethodAccess(root = bundledRoot) {
  const base = realpathSync(dirname(root));
  if (lstatSync(root).isSymbolicLink() || !lstatSync(root).isDirectory()) throw new Error('Invalid bundle');
  const skills = realpathSync(root);
  if (dirname(skills) !== base) throw new Error('Invalid bundle');
  function contained(path, directory = false) {
    if (typeof path !== 'string' || path.length > 400) throw new Error('Invalid path');
    const parts = path.split('/');
    if (!parts.length || parts.length > LIMITS.depth + 2 || !methodPattern.test(parts[0]) || parts.some(p => !segment.test(p) || p === '.' || p === '..')) throw new Error('Invalid path');
    if (!directory && (parts.length < 2 || !extensions.has(extname(path)))) throw new Error('Unsupported file');
    if (lstatSync(root).isSymbolicLink() || realpathSync(root) !== skills) throw new Error('Bundle changed');
    let target = skills;
    for (let i = 0; i < parts.length; i++) {
      target = join(target, parts[i]);
      const stat = lstatSync(target);
      if (stat.isSymbolicLink() || (i < parts.length - 1 || directory ? !stat.isDirectory() : !stat.isFile())) throw new Error('Invalid file');
    }
    if (realpathSync(target) !== target) throw new Error('Invalid file');
    return target;
  }
  function read(path) {
    const target = contained(path);
    const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = fstatSync(fd);
      const checked = lstatSync(contained(path));
      if (!stat.isFile() || stat.size > LIMITS.file || stat.dev !== checked.dev || stat.ino !== checked.ino) throw new Error('Invalid file');
      const bytes = Buffer.alloc(LIMITS.file + 1);
      let size = 0;
      while (size < bytes.length) {
        const count = readSync(fd, bytes, size, bytes.length - size, null);
        if (!count) break;
        size += count;
      }
      if (size > LIMITS.file) throw new Error('File too large');
      const text = decoder.decode(bytes.subarray(0, size));
      if (text.includes('\0')) throw new Error('Binary file');
      return text;
    } finally { closeSync(fd); }
  }
  function entries(path) {
    const directory = opendirSync(path);
    const result = [];
    try {
      for (let entry; (entry = directory.readSync());) {
        if (result.length >= LIMITS.entries) throw new Error('Directory too large');
        result.push(entry);
      }
    } finally { directory.closeSync(); }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }
  function methods() {
    const result = [];
    for (const entry of entries(skills)) {
      if (!entry.isDirectory() || !methodPattern.test(entry.name)) continue;
      contained(`${entry.name}/SKILL.md`);
      if (result.length >= LIMITS.methods) throw new Error('Too many methods');
      result.push({ method: entry.name, path: `${entry.name}/SKILL.md` });
    }
    return { guide: 'conquistador/SKILL.md', methods: result };
  }
  function files(method) {
    if (typeof method !== 'string' || method.length > 100 || !methodPattern.test(method)) throw new Error('Invalid method');
    contained(`${method}/SKILL.md`);
    const result = [];
    let visited = 0;
    function walk(path, depth) {
      if (depth > LIMITS.depth) throw new Error('Too deep');
      for (const entry of entries(contained(path, true))) {
        if (++visited > LIMITS.entries) throw new Error('Too many entries');
        if (!segment.test(entry.name) || entry.isSymbolicLink()) continue;
        const name = `${path}/${entry.name}`;
        if (entry.isDirectory()) walk(name, depth + 1);
        else if (entry.isFile() && extensions.has(extname(name))) {
          if (result.length >= LIMITS.files) throw new Error('Too many files');
          contained(name);
          result.push(name);
        }
      }
    }
    walk(method, 0);
    return { files: result };
  }
  return { methods, files, read };
}

// One JSON-RPC handler shared by stdio and HTTP. It returns the response object, or null for notifications.
export function createMcpHandler({ root = bundledRoot, requireInitialize = true } = {}) {
  let access;
  let initialized = !requireInitialize;
  let ready = !requireInitialize;
  const error = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
  const packageRoot = () => dirname(realpathSync(root));
  return function handle(message) {
    if (!object(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || (Object.hasOwn(message, 'id') && !(typeof message.id === 'string' && message.id.length <= 128 || typeof message.id === 'number' && Number.isFinite(message.id)))) return error(null, -32600, 'Invalid request');
    const { id, method } = message;
    if (id === undefined) {
      if (method === 'notifications/initialized' && initialized) ready = true;
      return null;
    }
    const params = message.params ?? {};
    if (!object(params)) return error(id, -32602, 'Invalid parameters');
    if (method === 'ping') return ok(id, {});
    if (method === 'initialize' && (!initialized || !requireInitialize)) {
      if (typeof params.protocolVersion !== 'string' || !object(params.capabilities) || !object(params.clientInfo)) return error(id, -32602, 'Invalid initialization');
      initialized = true;
      return ok(id, { protocolVersion: protocolVersions.has(params.protocolVersion) ? params.protocolVersion : '2025-11-25', capabilities: { tools: {}, prompts: {} }, serverInfo: { name: 'conquistador', title: 'Conquistador', version: packageVersion }, instructions: SERVER_INSTRUCTIONS });
    }
    if (!ready) return error(id, -32600, 'Initialize the connection first');
    if (method === 'tools/list') return ok(id, { tools: TOOLS });
    if (method === 'prompts/list') return ok(id, { prompts: PROMPTS.map(({ text, ...prompt }) => prompt) });
    if (method === 'prompts/get') {
      const prompt = PROMPTS.find(item => item.name === params.name);
      const product = object(params.arguments) && typeof params.arguments.product === 'string' ? params.arguments.product.slice(0, 8000) : '';
      if (!prompt) return error(id, -32602, 'Unknown prompt');
      return ok(id, { description: prompt.description, messages: [{ role: 'user', content: { type: 'text', text: prompt.text.replace('{{product}}', product || 'my product') } }] });
    }
    if (method !== 'tools/call') return error(id, -32601, 'Method not found');
    const definition = TOOLS.find(tool => tool.name === params.name);
    const args = params.arguments ?? {};
    if (!definition || !object(args) || Object.keys(args).some(key => !Object.hasOwn(definition.inputSchema.properties, key)) || definition.inputSchema.required.some(key => typeof args[key] !== 'string')) return error(id, -32602, 'Invalid tool arguments');
    let result;
    try {
      let value;
      if (params.name === 'conquistador_brief') {
        if (!args.task.trim() || args.task.length > 8000) throw new Error('Invalid task');
        value = formatBriefPack(createBrief(args.task, { root: packageRoot(), force: true }));
      } else if (params.name === 'conquistador_search') {
        if (!args.query.trim() || args.query.length > 400) throw new Error('Invalid query');
        value = searchKnowledge(args.query, { root: packageRoot() });
      } else {
        access ??= createMethodAccess(root);
        value = params.name === 'conquistador_methods' ? access.methods() : params.name === 'conquistador_files' ? access.files(args.method) : access.read(args.path.replace(/^skills\//, ''));
      }
      result = { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] };
    } catch {
      result = { isError: true, content: [{ type: 'text', text: params.name === 'conquistador_brief' || params.name === 'conquistador_search' ? 'Cannot build a brief for this input. Describe the task in plain words.' : 'Cannot read bundled method: invalid path, unavailable text file, or bundle limit exceeded.' }] };
    }
    if (Buffer.byteLength(JSON.stringify(result)) > LIMITS.response - 1024) {
      result = { isError: true, content: [{ type: 'text', text: 'Encoded text exceeds the response limit.' }] };
    }
    return ok(id, result);
  };
}

// Process one bounded frame at a time. There is no task queue or background work
// to cancel; cancellation notifications need no response. Writes have a deadline.
export async function runSkillsMcp({ input = process.stdin, output = process.stdout, root = bundledRoot } = {}) {
  const handler = createMcpHandler({ root });
  let stopped = false;
  let abortWrite;
  const stop = () => { stopped = true; abortWrite?.(); input.destroy(); };
  const send = async value => {
    const frame = `${JSON.stringify(value)}\n`;
    if (Buffer.byteLength(frame) > LIMITS.response || stopped) throw new Error('Output unavailable');
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        abortWrite = undefined;
        error ? reject(new Error('Output unavailable')) : resolve();
      };
      const timer = setTimeout(() => { finish(true); stop(); }, 3000);
      abortWrite = () => finish(true);
      try { output.write(frame, finish); } catch { finish(true); }
    });
  };
  const error = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });
  async function handle(bytes) {
    let message;
    try { message = JSON.parse(decoder.decode(bytes)); } catch { return error(null, -32700, 'Invalid JSON'); }
    const response = handler(message);
    if (response) await send(response);
  }
  output.on('error', stop);
  output.on('close', stop);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  let buffer = Buffer.alloc(0);
  try {
    for await (const chunk of input) {
      if (stopped) break;
      const bytes = Buffer.from(chunk);
      let start = 0;
      while (start < bytes.length && !stopped) {
        const newline = bytes.indexOf(10, start);
        const end = newline < 0 ? bytes.length : newline;
        if (buffer.length + end - start > LIMITS.request) { await error(null, -32600, 'Request limit exceeded'); stop(); break; }
        buffer = Buffer.concat([buffer, bytes.subarray(start, end)]);
        if (newline < 0) break;
        await handle(buffer);
        buffer = Buffer.alloc(0);
        start = newline + 1;
      }
    }
    if (!stopped && buffer.length) await error(null, -32700, 'Incomplete JSONL frame');
  } catch { stop(); }
  finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    output.removeListener('close', stop);
    // Keep the error listener until pending stream callbacks have settled.
    if (stopped) output.destroy();
    else output.removeListener('error', stop);
  }
}
