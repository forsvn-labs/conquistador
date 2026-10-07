// Machine-readable rubric gates. A rubric declares its pass rules once, in a fenced block:
//
//   ```json conquistador-gate
//   { "scale": { "min": 0, "max": 10 }, "dimensions": ["Clarity", "Proof"],
//     "variants": { "default": { "minEach": 6, "minTotal": 14, "doneAt": 16 } },
//     "hardFails": ["fabricated-claim"] }
//   ```
//
// A level scale uses { "levels": ["fail", "weak", "pass"] } with "minEach" naming a level and
// "maxAtLevel" capping how many dimensions may sit at a level. "notApplicable" lists dimensions a
// variant may score as "N/A"; they leave the total and the maximum. "minScore" sets a floor for one
// named dimension. "concernsBelowEach" lowers a pass to pass_with_concerns when any dimension
// scores below it. The scores are the reviewer's judgment; the gate only checks them against the
// rubric's own rules.

const usage = message => Object.assign(new Error(message), { usage: true });

export function parseGate(markdown) {
  const match = markdown.match(/```json conquistador-gate\n([\s\S]*?)\n```/);
  if (!match) return null;
  return JSON.parse(match[1]);
}

export function evaluateGate(gate, { variant, scores, hardFails = [] }) {
  const names = Object.keys(gate.variants);
  if (variant === undefined && names.length === 1) [variant] = names;
  if (!Object.hasOwn(gate.variants, variant ?? '')) throw usage(`Choose a variant: ${names.join(', ')}.`);
  const rules = gate.variants[variant];
  const levels = gate.scale.levels;
  const notApplicable = new Set(rules.notApplicable ?? []);
  const unknown = Object.keys(scores).filter(name => !gate.dimensions.includes(name));
  if (unknown.length) throw usage(`Unknown dimension. This rubric scores: ${gate.dimensions.join(', ')}.`);
  const unknownFails = hardFails.filter(id => !(gate.hardFails ?? []).includes(id));
  if (unknownFails.length) throw usage(`Unknown hard fail. This rubric lists: ${(gate.hardFails ?? []).join(', ') || 'none'}.`);

  const failures = hardFails.map(id => `hard fail: ${id}`);
  const missing = [];
  let total = 0;
  let max = 0;
  const atLevel = {};
  let concerns = false;
  for (const name of gate.dimensions) {
    const value = scores[name];
    if (value === 'N/A') {
      if (!notApplicable.has(name)) throw usage(`${name} cannot be N/A in the ${variant} variant.`);
      continue;
    }
    if (value === undefined) { if (!notApplicable.has(name)) missing.push(name); continue; }
    if (levels) {
      if (!levels.includes(value)) throw usage(`Score ${name} with one of: ${levels.join(', ')}.`);
      atLevel[value] = (atLevel[value] ?? 0) + 1;
      if (rules.minEach && levels.indexOf(value) < levels.indexOf(rules.minEach)) failures.push(`${name} is ${value}; the minimum is ${rules.minEach}`);
      const floor = rules.minScore?.[name];
      if (floor && levels.indexOf(value) < levels.indexOf(floor)) failures.push(`${name} is ${value}; its minimum is ${floor}`);
      if (rules.concernsBelowEach && levels.indexOf(value) < levels.indexOf(rules.concernsBelowEach)) concerns = true;
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < gate.scale.min || value > gate.scale.max) throw usage(`Score ${name} with a number from ${gate.scale.min} to ${gate.scale.max}.`);
      total += value;
      max += gate.scale.max;
      if (rules.minEach !== undefined && value < rules.minEach) failures.push(`${name} is ${value}; each dimension needs at least ${rules.minEach}`);
      const floor = rules.minScore?.[name];
      if (floor !== undefined && value < floor) failures.push(`${name} is ${value}; it needs at least ${floor}`);
      if (rules.concernsBelowEach !== undefined && value < rules.concernsBelowEach) concerns = true;
    }
  }
  for (const [level, cap] of Object.entries(rules.maxAtLevel ?? {})) {
    if ((atLevel[level] ?? 0) > cap) failures.push(`${atLevel[level]} dimensions are ${level}; at most ${cap} may be`);
  }
  if (!levels && rules.minTotal !== undefined && !missing.length && total < rules.minTotal) failures.push(`total is ${total}/${max}; the minimum is ${rules.minTotal}`);
  const verdict = hardFails.length ? 'fail' : missing.length ? 'incomplete' : failures.length ? 'fail' : concerns || (!levels && rules.doneAt !== undefined && total < rules.doneAt) ? 'pass_with_concerns' : 'pass';
  return { verdict, variant, total: levels ? null : total, max: levels ? null : max, failures, missing };
}
