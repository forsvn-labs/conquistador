// The rule registry. Each rule has an id, family, severity, message, and fix.
// Severity: `error` and `warning` count toward exit code 2; `advisory` is listed but never fails a run.
// docs/CHECK.md is the catalog and cites the source for every limit.
import { adFields, adLength, socialPosts, weightedLength } from './channels.mjs';

export const families = {
  claims: 'Unsupported claims',
  'ai-tells': 'AI-writing tells',
  cta: 'Vague calls to action',
  channel: 'Channel limits',
  email: 'Email compliance',
  links: 'Link hygiene',
};

// A sentence with one of these markers carries its own source.
const sourceMarker = /\[\^?[\w-]+\]|\[\d+\]|<sup>|†|‡|\(source|\bsources?:|according to|\bper (?:a |the )?[A-Z0-9]|\b(?:survey|study|report|audit|benchmark|analysis|data) (?:by|from|of)\b|\bdata from\b|\bas of (?:\w+ )?\d{4}\b|\bin (?:a|our) \d{4} (?:survey|study|report)|\bG2\b|\bGartner\b|\bForrester\b|\bIDC\b|\bNielsen\b|\bmeasured (?:by|on|across)\b|\b(?:test|experiment|trial|survey|study|sample) (?:with|of|across) |\bn ?= ?\d+|\*$/i;

const concreteTime = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{1,2}\b|\b\d{1,2} (?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b|\b\d{1,2}\/\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\bmidnight\b|\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b|\b\d+ (?:hours?|days?)\b/i;

const sentences = text => text.split(/(?<=[.!?…])\s+(?=[A-Z0-9"“'‘(*])/).filter(Boolean);

// The previous sentence counts too: "In a 2026 survey of 400 buyers (link)... 62% said ...".
const cited = (sentence, line, previous = '') => sourceMarker.test(sentence) || sourceMarker.test(previous) || line.links.some(link => /^https?:/.test(link.href) && !/[?&]utm_/.test(link.href) && sentence.includes(link.text));

const clip = text => (text.length > 120 ? `${text.slice(0, 117)}...` : text);

// Build a rule that flags a phrase once per sentence, unless `unless(sentence, line)` holds.
function phrase(meta, pattern, unless = () => false) {
  return {
    ...meta,
    scope: 'line',
    check(context) {
      const found = [];

      let previous = '';

      for (const line of context.document.lines) {
        for (const sentence of sentences(line.text)) {
          const match = pattern.exec(sentence);

          if (match && !unless(sentence, line, previous)) found.push({ line: line.n, snippet: clip(sentence), match: match[0] });
          previous = sentence;
        }
      }

      return found;
    },
  };
}

function documentRule(meta, check) {
  return { ...meta, scope: 'document', check };
}

const firstLine = context => context.document.lines[0]?.n ?? 1;

const field = (context, ...names) => {
  for (const name of names) {
    const value = context.document.data[name];

    if (value !== undefined && value !== '' && !Array.isArray(value)) return { text: String(value), line: context.document.fieldLines[name] ?? 1 };
  }

  return null;
};

const words = context => context.document.lines.reduce((total, line) => total + line.text.split(/\s+/).filter(Boolean).length, 0);

// Links that every compliant email has and that do not count as calls to action.
const footerLink = link => /unsubscribe|opt[- ]?out|preferences|privacy|terms|view (?:it )?(?:in|on) (?:your )?browser|web version|manage|forward to a friend/i.test(`${link.text} ${link.href}`) || /^(mailto|tel):/i.test(link.href) || /(twitter|x|linkedin|facebook|instagram|youtube|tiktok)\.com\/[^/?]+\/?$/i.test(link.href);

const ctaVerb = /^(?:→\s*)?(?:get|start|try|book|sign up|join|download|request|schedule|buy|shop|claim|reserve|register|contact|subscribe|apply|create|see|watch|explore|grab|install|upgrade|order|reply|talk to|chat with|compare|calculate|build|launch|save|redeem|activate)\b/i;

// A short direct question that asks for a reply or a meeting is the usual action in a 1:1 email.
const askQuestion = /\b(?:would|could|can|should|is|are|open to|worth|interested|make sense|useful|helpful|reply|call|chat|talk|look|meet|demo)\b.*\?\s*$/i;
const asksForReply = text => askQuestion.test(text) && /\b(?:open to|worth|interested|make sense|useful|helpful|reply|call|chat|talk|look|meet|demo|conversation|walkthrough)\b/i.test(text) && text.split(/\s+/).length <= 20;
const ctaLinks = context => context.document.lines.flatMap(line => line.links.filter(link => !footerLink(link) && link.href !== '#'));

const marketingLinks = context => context.document.lines.flatMap(line => line.links.filter(link => /^https?:/i.test(link.href) && !footerLink(link)).map(link => ({ ...link, n: line.n })));

const campaignChannels = new Set(['email', 'x', 'linkedin', 'social', 'google-ads', 'meta-ads']);

const vagueLabel = /^(?:learn more|read more|more|find out more|more info(?:rmation)?|details|go|submit|click|continue|ok|here|this link|link|click here|see more)\s*[→>»›.!]*$/i;

export const rules = [
  // Unsupported claims. Sources: FTC advertising substantiation policy, FTC dark patterns report.
  phrase({ id: 'claim-superlative', family: 'claims', severity: 'warning', name: 'Superlative without a source',
    message: 'Superlative or ranking claim with no source in the same sentence.',
    fix: 'Cite the ranking or study beside the claim, or replace it with a specific, checkable fact.' },
  /#1\b|\bno\.\s?1\b|\bnumber[- ]one\b|\bthe best\b(?! (?:way|part|thing|time|practices?|of luck|possible|you can|we can))|\b(?:world|industry|market|category)[- ]leading\b|\bthe leading\b|\bleading (?:provider|platform|solution|brand|company|tool|vendor)\b|\bworld'?s (?:first|best|largest|fastest|most|only|leading)\b|\bbest[- ]in[- ]class\b|\bthe (?:fastest|easiest|cheapest|smartest|most (?:advanced|powerful|trusted|popular|secure|accurate|reliable|loved|complete))\b|\b(?:unmatched|unrivall?ed|unbeatable|unparalleled|second to none)\b/i, cited),
  phrase({ id: 'claim-number-unsourced', family: 'claims', severity: 'warning', name: 'Number without a source',
    message: 'Performance number, percentage, or customer count with no source marker.',
    fix: 'Add the source (study, dataset, date, sample) next to the number, or remove the number.' },
  /\b\d+(?:\.\d+)?\s?%(?! off\b| discount\b| of (?:the )?(?:proceeds|profits)\b)|\b\d+(?:\.\d+)?x (?:faster|more|better|cheaper|higher|growth|roi|return|increase|the)\b|\b\d+(?:\.\d+)? times (?:faster|more|better|cheaper|higher)\b|\b\d{1,3}(?:,\d{3})+\+?\s+(?:users|customers|teams|companies|businesses|downloads|subscribers|marketers|people|developers|brands|creators|members|installs)\b|\b\d+(?:\.\d+)?\s?[km]\+?\s+(?:users|customers|teams|companies|businesses|downloads|subscribers|marketers|people|developers|brands|creators|members|installs)\b|\bsaves? (?:you )?(?:up to )?\d+\s?(?:hours?|days?|minutes?)\b/i,
  (sentence, line, previous) => cited(sentence, line, previous) || /^\s*(?:save|get|take|enjoy|extra|up to)\b[^.]*%/i.test(sentence) && /% off|off\b|discount|coupon|code\b/i.test(sentence)),
  phrase({ id: 'claim-proven', family: 'claims', severity: 'warning', name: 'Proof claim without a citation',
    message: '"Proven" or "studies show" claim with no citation.',
    fix: 'Link the study or dataset, or describe what you observed and where.' },
  /\b(?:clinically|scientifically|independently) (?:proven|tested|shown)\b|\bproven to\b|\b(?:studies|research|science|data) (?:shows?|proves?|confirms?)\b|\bscience[- ]backed\b|\bdoctor[- ]recommended\b|\bexperts (?:agree|recommend)\b/i, cited),
  phrase({ id: 'claim-absolute', family: 'claims', severity: 'warning', name: 'Absolute promise',
    message: 'Absolute promise that one failure would make false.',
    fix: 'State the real limit, for example the uptime SLA, the security certification, or the error rate.' },
  /\b100% (?:secure|safe|accurate|reliable|uptime|private|effective|compliant|satisfaction)\b|\bzero (?:downtime|risk|errors|bugs|effort)\b|\bnever (?:fails|goes down|breaks|misses)\b|\b(?:unhackable|bulletproof|foolproof)\b/i, cited),
  phrase({ id: 'claim-guarantee', family: 'claims', severity: 'warning', name: 'Guarantee without terms',
    message: 'Guarantee or "risk-free" promise with no terms in the same sentence.',
    fix: 'Add the terms, for example "30-day refund, no questions asked", and link the policy.' },
  /\b(?:guaranteed?|risk[- ]free|no[- ]risk|money[- ]back)\b/i,
  sentence => /\b\d+[- ]day|\bterms\b|\bpolicy\b|\brefund within\b|\bsee\b|\*$|†/i.test(sentence)),
  phrase({ id: 'claim-urgency', family: 'claims', severity: 'warning', name: 'Urgency with no real deadline',
    message: 'Urgency phrase with no concrete date or time. Fake deadlines are a dark pattern.',
    fix: 'State the real deadline (date, time, time zone), or remove the urgency.' },
  /\b(?:act (?:now|fast|quickly)|hurry|limited[- ]time|today only|last chance|ends? (?:soon|tonight|today)|don'?t miss (?:out|this)|before it'?s too late|offer expires|expires soon|now or never|time is running out|only (?:a few )?(?:hours|days) left)\b/i,
  sentence => concreteTime.test(sentence)),
  phrase({ id: 'claim-scarcity', family: 'claims', severity: 'warning', name: 'Scarcity claim',
    message: 'Scarcity or demand claim. False low-stock or high-demand messages are a dark pattern.',
    fix: 'Confirm the number is true and current and say how it is counted, or remove the claim.' },
  /\bonly \d+ (?:left|spots?|seats?|places?|units?|remaining|available)\b|\b(?:selling|filling) (?:out )?fast\b|\balmost (?:gone|sold out|full)\b|\b(?:spots|seats) are (?:filling|limited|going)\b|\b(?:few|limited) (?:spots|seats|places) (?:left|remaining|available)\b|\bwhile (?:supplies|stocks?) last\b|\b\d+ people (?:are )?(?:viewing|looking at|have this in)\b/i),
  phrase({ id: 'claim-vague-proof', family: 'claims', severity: 'warning', name: 'Vague social proof',
    message: 'Social proof with no names or sourced count.',
    fix: 'Name customers you have permission to name, or give a sourced count with a date.' },
  /\b(?:trusted|loved|used|chosen) by (?:thousands|millions|hundreds|countless|teams|companies|businesses|brands|leaders|customers|marketers|developers)(?: of \w+)?(?: (?:everywhere|worldwide|around the (?:world|globe)))?\b|\bjoin (?:thousands|millions|hundreds) of\b/i, cited),
  phrase({ id: 'claim-placeholder', family: 'claims', severity: 'error', name: 'Unfilled placeholder',
    message: 'Unfilled placeholder text.',
    fix: 'Replace the placeholder with the real value before anyone sees this copy.' },
  /\bX{2,}\s?%|\b(?:lorem ipsum|TODO|TBD|FIXME|INSERT [A-Z]+)\b|\[(?:company|customer|product|brand|name|first name|link|url|insert|your|cta|stat|number|date|price)[^\]]{0,30}\](?!\()/i),

  // AI-writing tells. Source: Wikipedia "Signs of AI writing" (WikiProject AI Cleanup).
  phrase({ id: 'ai-unlock', family: 'ai-tells', severity: 'warning', name: '"Unlock"',
    message: '"Unlock" is a stock AI-copy verb.', fix: 'Say what the reader can now do, for example "see every campaign\'s cost in one table".' },
  /\bunlock(?:s|ed|ing)?\b/i),
  phrase({ id: 'ai-elevate', family: 'ai-tells', severity: 'warning', name: '"Elevate"',
    message: '"Elevate" is a stock AI-copy verb.', fix: 'Name the concrete improvement and, if you have it, the number.' },
  /\belevat(?:e|es|ed|ing)\b/i),
  phrase({ id: 'ai-seamless', family: 'ai-tells', severity: 'warning', name: '"Seamless"',
    message: '"Seamless" is a stock AI-copy adjective.', fix: 'Describe the step that disappears, for example "no export, no CSV".' },
  /\bseamless(?:ly)?\b/i),
  phrase({ id: 'ai-delve', family: 'ai-tells', severity: 'warning', name: '"Delve"',
    message: '"Delve" is a strong AI-writing tell.', fix: 'Use "look at", "cover", or cut the sentence.' },
  /\bdelv(?:e|es|ed|ing)\b/i),
  phrase({ id: 'ai-game-changer', family: 'ai-tells', severity: 'warning', name: '"Game-changer" and "revolutionary"',
    message: 'Hype noun or adjective that makes no checkable claim.', fix: 'Replace it with the specific change and who it changes it for.' },
  /\bgame[- ]chang(?:er|ers|ing)\b|\brevolutioni[sz](?:e|es|ed|ing)\b|\brevolutionary\b|\bparadigm shift\b/i),
  phrase({ id: 'ai-fast-paced-world', family: 'ai-tells', severity: 'warning', name: 'Stock scene-setting opener',
    message: 'Stock scene-setting phrase such as "in today\'s fast-paced world".', fix: 'Delete it and start with the reader\'s problem.' },
  /\bin today'?s (?:fast[- ]paced|digital|ever[- ]changing|ever[- ]evolving|modern|competitive|busy|hyper[- ]connected)\b|\bever[- ](?:evolving|changing) (?:landscape|world|market)\b|\bin the (?:digital|modern) (?:age|era|landscape)\b/i),
  phrase({ id: 'ai-not-just', family: 'ai-tells', severity: 'warning', name: '"Not just X, it\'s Y"',
    message: '"It\'s not just X, it\'s Y" contrast frame, a common AI-writing pattern.', fix: 'State Y directly.' },
  /\b(?:it'?s|this is|that'?s|this isn'?t|it isn'?t|isn'?t|is) (?:not )?(?:just|only|merely) (?:a |an |about )?[^.;!?]{1,60}?[,;—–-]+\s*(?:it'?s|this is|that'?s|but)\b|\bnot (?:just|only|merely) [^.;!?]{1,60}?,? but (?:also )?/i),
  phrase({ id: 'ai-buzzword', family: 'ai-tells', severity: 'warning', name: 'Corporate buzzword',
    message: 'Buzzword that readers skip.', fix: 'Replace it with the plain verb or the concrete feature.' },
  /\b(?:leverag(?:e|es|ed|ing)|synerg(?:y|ies|istic)|cutting[- ]edge|empower(?:s|ed|ing)?|supercharg(?:e|es|ed|ing)|harness(?:es|ed|ing)? the power|next[- ]level|transformative|holistic|state[- ]of[- ]the[- ]art|frictionless|turnkey|mission[- ]critical|best[- ]of[- ]breed|robust solution|innovative solution|unleash(?:es|ed|ing)?)\b/i),
  phrase({ id: 'ai-purple-prose', family: 'ai-tells', severity: 'warning', name: 'Purple prose',
    message: 'Ornamental phrase common in generated text.', fix: 'Cut it, or replace it with a fact.' },
  /\b(?:rich )?tapestry\b|\b(?:a )?testament to\b|\bin the realm of\b|\bembark on\b|\b(?:a )?beacon of\b|\bsymphony of\b|\bnavigat(?:e|ing) the (?:complexities|complex|intricacies|landscape)\b|\ba world where\b|\bthe power of\b/i),
  phrase({ id: 'ai-stock-opener', family: 'ai-tells', severity: 'warning', name: 'Stock opener or closer',
    message: 'Stock opener or closer such as "Imagine a world" or "Ready to take it to the next level?".', fix: 'Open with the reader\'s situation; close with the specific next step.' },
  /^(?:imagine (?:a world|if|having)|picture this|let'?s (?:dive in|face it|be honest|explore)|in conclusion|in summary|at the end of the day|whether you'?re an? .{2,40}? or an?\b)|\bready to (?:take|level up|transform|supercharge) (?:your|it)\b|\btake (?:your|it) \w+ to the next level\b/i),
  documentRule({ id: 'ai-em-dash', family: 'ai-tells', severity: 'advisory', name: 'Heavy em-dash use',
    message: 'Em dashes are dense in this text, a common AI-writing tell.', fix: 'Keep one or two. Use periods, commas, or parentheses for the rest.' },
  context => {
    const dashes = context.document.lines.filter(line => /—|\s--\s/.test(line.text));
    const count = context.document.lines.reduce((total, line) => total + (line.text.match(/—|\s--\s/g)?.length ?? 0), 0);

    return count >= 3 && count / Math.max(words(context), 1) > 1 / 100 ? [{ line: dashes[0].n, snippet: `${count} em dashes in ${words(context)} words` }] : [];
  }),
  documentRule({ id: 'ai-triplet', family: 'ai-tells', severity: 'advisory', name: 'Reflexive triplets',
    message: 'Several "X, Y, and Z" lists. Reflexive groups of three read as generated.', fix: 'Keep the one list that matters; cut the weakest item from the others.' },
  context => {
    const hits = context.document.lines.filter(line => /\b[\w-]{3,15},\s+[\w-]{3,15},?\s+and\s+[\w-]{3,15}\b/i.test(line.text) && !line.links.length);

    return hits.length >= 3 ? [{ line: hits[0].n, snippet: `${hits.length} lines with "X, Y, and Z" lists` }] : [];
  }),
  documentRule({ id: 'ai-exclamation', family: 'ai-tells', severity: 'advisory', name: 'Exclamation overuse',
    message: 'Many exclamation marks. They lower trust in marketing copy.', fix: 'Keep at most one.' },
  context => {
    const hits = context.document.lines.filter(line => line.text.includes('!'));
    const count = context.document.lines.reduce((total, line) => total + (line.text.match(/!/g)?.length ?? 0), 0);

    return count >= 4 || hits.some(line => /!!/.test(line.text)) ? [{ line: hits[0].n, snippet: `${count} exclamation marks` }] : [];
  }),
  documentRule({ id: 'ai-emoji-bullets', family: 'ai-tells', severity: 'advisory', name: 'Emoji bullets',
    message: 'Lines that start with decorative emoji such as 🚀 or ✅.', fix: 'Use plain bullets, or keep emoji only where the channel expects them.' },
  context => {
    const hits = context.document.lines.filter(line => /^\p{Extended_Pictographic}/u.test(line.text));

    return hits.length >= 3 ? [{ line: hits[0].n, snippet: `${hits.length} lines start with emoji` }] : [];
  }),

  // Vague calls to action. Source: WCAG 2.2 failure F84 (non-specific link text).
  phrase({ id: 'cta-click-here', family: 'cta', severity: 'warning', name: '"Click here"',
    message: '"Click here" says nothing about the destination.', fix: 'Make the link text the action and the result, for example "Download the 2026 pricing guide".' },
  /\bclick (?:here|this link|the link (?:below|above))\b/i),
  documentRule({ id: 'cta-vague', family: 'cta', severity: 'warning', name: 'Vague link or button text',
    message: 'Link or button text such as "Learn more" or "Submit" that does not say what happens next.', fix: 'Use a verb and the outcome, for example "See pricing" or "Book a 20-minute demo".' },
  context => context.document.lines.flatMap(line => line.links.filter(link => vagueLabel.test(link.text.trim())).map(link => ({ line: line.n, snippet: link.text.trim() || link.href })))
    .concat(context.document.lines.filter(line => !line.links.length && /^(?:learn more|read more|find out more|click here)\s*[→>»›.!]*$/i.test(line.text)).map(line => ({ line: line.n, snippet: line.text })))),
  documentRule({ id: 'cta-missing', family: 'cta', severity: 'warning', name: 'No call to action', channels: ['landing', 'email'],
    message: 'This landing page or email has no call to action.', fix: 'Add one primary action with a specific label and a working link.' },
  context => {
    const action = ctaLinks(context).length > 0 || context.document.lines.some(line => (ctaVerb.test(line.text) && line.text.split(/\s+/).length <= 8) || (context.channel === 'email' && asksForReply(line.text)));

    return action ? [] : [{ line: firstLine(context), snippet: 'No link, button, or action line found' }];
  }),
  documentRule({ id: 'cta-competing', family: 'cta', severity: 'advisory', name: 'Too many calls to action', channels: ['email'],
    message: 'More than three different destinations compete for the click.', fix: 'Pick one primary action. Move the rest to a later email.' },
  context => {
    const targets = new Set(ctaLinks(context).map(link => link.href.replace(/[?#].*$/, '')).filter(Boolean));

    return targets.size > 3 ? [{ line: firstLine(context), snippet: `${targets.size} different link destinations` }] : [];
  }),

  // Channel limits. Sources are in docs/CHECK.md.
  documentRule({ id: 'x-length', family: 'channel', severity: 'error', name: 'X post over 280', channels: ['x'],
    message: 'X post is over 280 weighted characters (URLs count 23, CJK and emoji count 2).', fix: 'Cut the post, or split it into a thread with `---` between posts.' },
  context => socialPosts(context.document).filter(post => weightedLength(post.text) > 280).map(post => ({ line: post.n, snippet: `${weightedLength(post.text)} of 280: ${clip(post.text.split('\n')[0])}` }))),
  documentRule({ id: 'linkedin-length', family: 'channel', severity: 'error', name: 'LinkedIn post over 3,000', channels: ['linkedin'],
    message: 'LinkedIn post is over 3,000 characters.', fix: 'Cut it below 3,000, or move the detail to an article and link it.' },
  context => socialPosts(context.document).filter(post => [...post.text].length > 3000).map(post => ({ line: post.n, snippet: `${[...post.text].length} of 3000 characters` }))),
  documentRule({ id: 'linkedin-hook', family: 'channel', severity: 'warning', name: 'LinkedIn hook cut by "see more"', channels: ['linkedin'],
    message: 'The first line runs past 150 characters, so LinkedIn hides the end of the hook behind "see more".', fix: 'Put the hook in the first 150 characters and break the line after it.' },
  context => socialPosts(context.document).flatMap(post => {
    const opening = post.text.split('\n')[0];

    return [...opening].length > 150 ? [{ line: post.n, snippet: `${[...opening].length} characters before the first break: ${clip(opening)}` }] : [];
  })),
  documentRule({ id: 'meta-title-length', family: 'channel', severity: 'warning', name: 'Page title over 60', channels: ['landing', 'web', 'article'],
    message: 'Page title is over 60 characters, so search results will likely truncate it.', fix: 'Put the key words first and keep the title within 60 characters.' },
  context => {
    const title = field(context, 'meta_title', 'seo_title', 'title');

    return title && [...title.text].length > 60 ? [{ line: title.line, snippet: `${[...title.text].length} of 60: ${clip(title.text)}` }] : [];
  }),
  documentRule({ id: 'meta-title-missing', family: 'channel', severity: 'warning', name: 'Page title missing', channels: ['landing', 'web'],
    message: 'The page has no <title>.', fix: 'Add a unique, descriptive <title> of 60 characters or fewer.' },
  context => context.document.kind === 'html' && !field(context, 'title') ? [{ line: 1, snippet: 'No <title> element' }] : []),
  documentRule({ id: 'meta-description-length', family: 'channel', severity: 'warning', name: 'Meta description over 155', channels: ['landing', 'web', 'article'],
    message: 'Meta description is over 155 characters, so search results will likely truncate it.', fix: 'Keep the description within 155 characters, with the benefit first.' },
  context => {
    const description = field(context, 'meta_description', 'description');

    return description && [...description.text].length > 155 ? [{ line: description.line, snippet: `${[...description.text].length} of 155: ${clip(description.text)}` }] : [];
  }),
  documentRule({ id: 'meta-description-missing', family: 'channel', severity: 'advisory', name: 'Meta description missing', channels: ['landing', 'web'],
    message: 'The page has no meta description, so search engines pick a snippet.', fix: 'Add <meta name="description"> with a specific summary of 155 characters or fewer.' },
  context => context.document.kind === 'html' && !field(context, 'description') ? [{ line: 1, snippet: 'No <meta name="description">' }] : []),
  documentRule({ id: 'email-subject-missing', family: 'channel', severity: 'warning', name: 'Email subject missing', channels: ['email'],
    message: 'No subject line found.', fix: 'Add `subject:` to the front matter or a `Subject:` line at the top.' },
  context => field(context, 'subject', 'og_title') || (context.document.kind === 'html' && field(context, 'title')) ? [] : [{ line: 1, snippet: 'No subject' }]),
  documentRule({ id: 'email-subject-length', family: 'channel', severity: 'warning', name: 'Email subject over 60 or 9 words', channels: ['email'],
    message: 'Subject line is over 60 characters or 9 words, so most inboxes will truncate it.', fix: 'Cut it to 9 words and 60 characters, with the specific benefit first.' },
  context => {
    const subject = field(context, 'subject') ?? (context.document.kind === 'html' ? field(context, 'title') : null);
    const count = subject ? subject.text.trim().split(/\s+/).length : 0;

    return subject && ([...subject.text].length > 60 || count > 9) ? [{ line: subject.line, snippet: `${[...subject.text].length} characters, ${count} words: ${clip(subject.text)}` }] : [];
  }),
  documentRule({ id: 'email-preheader-missing', family: 'channel', severity: 'advisory', name: 'Email preheader missing', channels: ['email'],
    message: 'No preheader. Inboxes then show the first body text, often "View in browser".', fix: 'Add `preheader:` that extends the subject, not repeats it.' },
  context => field(context, 'preheader', 'preview_text', 'preview') ? [] : [{ line: 1, snippet: 'No preheader' }]),
  documentRule({ id: 'rsa-headline-length', family: 'channel', severity: 'error', name: 'RSA headline over 30', channels: ['google-ads'],
    message: 'Responsive search ad headline is over 30 characters (double-width characters count 2).', fix: 'Cut the headline to 30 characters.' },
  context => adFields(context.document).headlines.filter(item => adLength(item.text) > 30).map(item => ({ line: item.n, snippet: `${adLength(item.text)} of 30: ${item.text}` }))),
  documentRule({ id: 'rsa-description-length', family: 'channel', severity: 'error', name: 'RSA description over 90', channels: ['google-ads'],
    message: 'Responsive search ad description is over 90 characters.', fix: 'Cut the description to 90 characters.' },
  context => adFields(context.document).descriptions.filter(item => adLength(item.text) > 90).map(item => ({ line: item.n, snippet: `${adLength(item.text)} of 90: ${clip(item.text)}` }))),
  documentRule({ id: 'rsa-path-length', family: 'channel', severity: 'error', name: 'RSA path over 15', channels: ['google-ads'],
    message: 'Display URL path field is over 15 characters.', fix: 'Cut each path field to 15 characters.' },
  context => adFields(context.document).paths.filter(item => adLength(item.text) > 15).map(item => ({ line: item.n, snippet: `${adLength(item.text)} of 15: ${item.text}` }))),
  documentRule({ id: 'rsa-asset-count', family: 'channel', severity: 'error', name: 'RSA asset count', channels: ['google-ads'],
    message: 'A responsive search ad needs 3 to 15 headlines and 2 to 4 descriptions.', fix: 'Add or remove assets to fit the range.' },
  context => {
    const { headlines, descriptions } = adFields(context.document);
    const bad = headlines.length < 3 || headlines.length > 15 || descriptions.length < 2 || descriptions.length > 4;

    return bad ? [{ line: headlines[0]?.n ?? firstLine(context), snippet: `${headlines.length} headlines, ${descriptions.length} descriptions` }] : [];
  }),
  documentRule({ id: 'meta-ad-primary-length', family: 'channel', severity: 'warning', name: 'Meta primary text over 150', channels: ['meta-ads'],
    message: 'Meta ad primary text is over the recommended 150 characters, so feeds cut it behind "See more".', fix: 'Put the offer in the first 125 characters and keep the total within 150.' },
  context => {
    const primary = adFields(context.document).primary;
    const text = primary.map(item => item.text).join(' ');

    return [...text].length > 150 ? [{ line: primary[0].n, snippet: `${[...text].length} of 150: ${clip(text)}` }] : [];
  }),
  documentRule({ id: 'meta-ad-headline-length', family: 'channel', severity: 'warning', name: 'Meta headline over 27', channels: ['meta-ads'],
    message: 'Meta ad headline is over the recommended 27 characters for feed placements.', fix: 'Cut the headline to 27 characters.' },
  context => adFields(context.document).headlines.filter(item => [...item.text].length > 27).map(item => ({ line: item.n, snippet: `${[...item.text].length} of 27: ${item.text}` }))),

  // Email compliance. Source: FTC CAN-SPAM compliance guide; Gmail and Yahoo sender rules.
  documentRule({ id: 'email-unsubscribe-missing', family: 'email', severity: 'error', name: 'No unsubscribe', channels: ['email'],
    message: 'Commercial email with no unsubscribe link or instruction.', fix: 'Add a visible unsubscribe link, or your platform\'s unsubscribe merge tag.' },
  context => /unsubscribe|opt[- ]?out|manage (?:your )?(?:email )?(?:preferences|subscription)|email preferences|\*\|UNSUB\|\*|\{\{\s*[\w.]*unsubscribe[\w.]*\s*\}\}|%unsubscribe[\w_]*%|<%asm_\w*unsubscribe\w*%>|\{\$unsubscribe\}|\{unsubscribe\}/i.test(context.document.source) ? [] : [{ line: firstLine(context), snippet: 'No unsubscribe link found' }]),
  documentRule({ id: 'email-address-missing', family: 'email', severity: 'error', name: 'No postal address', channels: ['email'],
    message: 'Commercial email with no physical postal address.', fix: 'Add your street address, registered PO box, or your platform\'s address merge tag to the footer.' },
  context => /\b\d{1,6}\s+(?:[A-Z][\w.'-]*\s+){1,4}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|suite|ste|court|ct|place|pl|square|sq|parkway|pkwy|highway|hwy|terrace|plaza)\b\.?|\bp\.?\s?o\.?\s+box\s+\d+|\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b|\b[A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2}\b|\*\|LIST:ADDRESS(?:LINE)?\|\*|\{\{\s*[\w.]*address[\w.]*\s*\}\}|%(?:company_)?address%|\{\$?(?:company_)?address\}/i.test(context.document.source) ? [] : [{ line: firstLine(context), snippet: 'No postal address found' }]),
  documentRule({ id: 'email-fake-reply', family: 'email', severity: 'error', name: 'Fake "Re:" or "Fwd:"', channels: ['email'],
    message: 'Subject starts with "Re:" or "Fwd:" on a first-touch email. That misrepresents the message.', fix: 'Remove the prefix. Write a subject that describes the content.' },
  context => {
    const subject = field(context, 'subject') ?? (context.document.kind === 'html' ? field(context, 'title') : null);

    return subject && /^\s*(?:re|fwd?|aw|tr)\s*:/i.test(subject.text) ? [{ line: subject.line, snippet: subject.text }] : [];
  }),
  documentRule({ id: 'email-subject-shouting', family: 'email', severity: 'warning', name: 'Shouting subject', channels: ['email'],
    message: 'Subject has all-caps words, repeated "!" or "$", or "FREE" in caps. Spam filters and readers both penalize it.', fix: 'Use sentence case and one plain benefit.' },
  context => {
    const subject = field(context, 'subject') ?? (context.document.kind === 'html' ? field(context, 'title') : null);
    const shouting = subject && (/[!?$]{2,}/.test(subject.text) || /\bFREE\b/.test(subject.text) || (subject.text.match(/\b[A-Z]{4,}\b/g) ?? []).length >= 2);

    return shouting ? [{ line: subject.line, snippet: subject.text }] : [];
  }),

  // Link hygiene. Sources: Google Analytics campaign URL guide; Chromium "A secure web is here to stay".
  documentRule({ id: 'link-http', family: 'links', severity: 'warning', name: 'Plain http link',
    message: 'Link uses plain http. Browsers mark it "Not secure".', fix: 'Use the https URL.' },
  context => context.document.lines.flatMap(line => line.links.filter(link => /^http:\/\/(?!localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(link.href)).map(link => ({ line: line.n, snippet: link.href })))),
  documentRule({ id: 'link-utm-missing', family: 'links', severity: 'warning', name: 'Campaign link without UTM', channels: [...campaignChannels],
    message: 'Campaign link has no UTM parameters, so analytics cannot attribute the visit.', fix: 'Add utm_source, utm_medium, and utm_campaign.' },
  context => marketingLinks(context).filter(link => !/[?&]utm_/i.test(link.href) && !/\{\{|\*\||%%/.test(link.href)).map(link => ({ line: link.n, snippet: link.href }))),
  documentRule({ id: 'link-utm-incomplete', family: 'links', severity: 'warning', name: 'Incomplete UTM set',
    message: 'Link has some UTM parameters but not all of utm_source, utm_medium, and utm_campaign.', fix: 'Add the missing parameters so the visit is not reported as "(not set)".' },
  context => marketingLinks(context).filter(link => /[?&]utm_/i.test(link.href) && !['utm_source', 'utm_medium', 'utm_campaign'].every(name => new RegExp(`[?&]${name}=[^&#]+`, 'i').test(link.href))).map(link => ({ line: link.n, snippet: link.href }))),
  documentRule({ id: 'link-placeholder', family: 'links', severity: 'error', name: 'Placeholder link',
    message: 'Link points at a placeholder such as "#", example.com, or an empty target.', fix: 'Replace it with the real destination.' },
  context => context.document.lines.flatMap(line => line.links.filter(link => link.tag !== 'button' && (/^(?:#|)$/.test(link.href.trim()) || /^https?:\/\/(?:www\.)?example\.(?:com|org|net)\b|^(?:url|link|todo|tbd)$/i.test(link.href.trim()))).map(link => ({ line: line.n, snippet: `${link.text || '(no text)'} -> ${link.href || '(empty)'}` })))),
];

export const ruleById = new Map(rules.map(rule => [rule.id, rule]));
