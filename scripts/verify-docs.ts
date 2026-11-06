/**
 * Mechanical Documentation, Pure-TypeScript & Anti-Slop Verification Gate.
 * Enforces docs/AGENTS.md and .agents/skills/dsh-prose-standard/SKILL.md.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const REQUIRED_AGENTS_MD = [
  'AGENTS.md',
  'docs/AGENTS.md',
  'packages/AGENTS.md',
  'src/native/AGENTS.md',
  'vendor/AGENTS.md',
  'benchmarks/AGENTS.md',
  'examples/AGENTS.md',
] as const;

const BANNED_SLOP_PATTERNS: readonly RegExp[] = [
  /\bindustrial port\b/i,
  /\bport industrial\b/i,
  /\bv2\.0 Architecture\b/i,
  /\bV2 Architecture\b/,
  /\badvance the frontier\b/i,
  /\bavançar a fronteira\b/i,
  /\bparadigm shift\b/i,
];

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === 'vendor' ||
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === '.scratch' ||
      entry.name === 'test-results' ||
      entry.name === 'build' ||
      entry.name === 'dist'
    ) {
      continue;
    }
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

const errors: string[] = [];

// 1. Check required recursive AGENTS.md files
for (const relPath of REQUIRED_AGENTS_MD) {
  const full = resolve(rootDir, relPath);
  if (!existsSync(full)) {
    errors.push(`Missing required progressive-disclosure indexer: ${relPath}`);
  } else if (statSync(full).size < 200) {
    errors.push(`AGENTS.md is too shallow (< 200 bytes): ${relPath}`);
  }
}

// 2. Forbid Dockerfile, .mjs, and .cmd files outside vendor/node_modules
if (existsSync(resolve(rootDir, 'Dockerfile'))) {
  errors.push('Prohibited root Dockerfile found (LynxFita is a native/desktop/embedded runtime, not a container service).');
}

const allFiles = walkFiles(rootDir);
for (const file of allFiles) {
  const rel = relative(rootDir, file).replace(/\\/g, '/');
  if (rel.endsWith('.mjs') || rel.endsWith('.cjs') || rel.endsWith('.cmd') || rel.endsWith('.bat')) {
    errors.push(`Prohibited non-TypeScript script/test file found: ${rel} (must be .ts)`);
  }
}

// 3. Checkprose against banned AI-slop terms (excluding transcripts/insights/verify-docs/SKILL.md that quote banned words)
for (const file of allFiles) {
  const rel = relative(rootDir, file).replace(/\\/g, '/');
  if (
    (!rel.endsWith('.md') && !rel.endsWith('.ts')) ||
    rel.startsWith('docs/transcripts/') ||
    rel.startsWith('docs/insights/') ||
    rel.startsWith('.agents/') ||
    rel === 'AGENTS.md' ||
    rel === 'docs/AGENTS.md' ||
    rel === 'scripts/verify-docs.ts'
  ) {
    continue;
  }
  const text = readFileSync(file, 'utf8');
  for (const pattern of BANNED_SLOP_PATTERNS) {
    if (pattern.test(text)) {
      errors.push(`Banned AI-slop phrase matching ${pattern} found in ${rel}`);
    }
  }
}

// 4. Forbid hardcoded local machine user paths (C:\Users\alefita or C:/Users/alefita) across docs and codebase
const BANNED_LOCAL_PATHS: readonly RegExp[] = [
  /C:[\\/]Users[\\/]alefita/i,
];

for (const file of allFiles) {
  const rel = relative(rootDir, file).replace(/\\/g, '/');
  if (
    !rel.endsWith('.md') &&
    !rel.endsWith('.ts') &&
    !rel.endsWith('.yml') &&
    !rel.endsWith('.json')
  ) {
    continue;
  }
  if (rel === 'scripts/verify-docs.ts' || rel.startsWith('docs/transcripts/')) {
    continue;
  }
  const text = readFileSync(file, 'utf8');
  for (const pattern of BANNED_LOCAL_PATHS) {
    if (pattern.test(text)) {
      errors.push(`Prohibited machine-specific path matching ${pattern} found in ${rel}`);
    }
  }
}

// 5. Validate SVG XML entity safety across all docs/ assets
for (const file of allFiles) {
  const rel = relative(rootDir, file).replace(/\\/g, '/');
  if (rel.endsWith('.svg')) {
    const text = readFileSync(file, 'utf8');
    if (text.includes('&bull;')) {
      errors.push(`Prohibited HTML entity '&bull;' in ${rel} (causes GitHub Camo XML parser failure; use '&#8226;' or UTF-8 '•')`);
    }
    if (text.includes('&nbsp;')) {
      errors.push(`Prohibited HTML entity '&nbsp;' in ${rel} (use '&#160;' or standard whitespace)`);
    }
  }
}

// 6. Validate Mermaid diagrams for syntax hazard patterns that break GitHub rendering
for (const file of allFiles) {
  const rel = relative(rootDir, file).replace(/\\/g, '/');
  if (!rel.endsWith('.md') || rel.startsWith('docs/transcripts/')) {
    continue;
  }
  const text = readFileSync(file, 'utf8');
  const mermaidRegex = /```mermaid\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = mermaidRegex.exec(text)) !== null) {
    const diagram = match[1];
    const lines = diagram.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check for unquoted parentheses or brackets inside edge labels: -->|...|
      const edgeLabelMatch = /-->\|([^|]*)\|/.exec(line);
      if (edgeLabelMatch) {
        const label = edgeLabelMatch[1];
        if (/[()<>{}]/.test(label)) {
          errors.push(
            `Mermaid syntax hazard in ${rel} (line ~${i + 1}): Edge label '|${label}|' contains unescaped delimiter chars '()<>{}'. Use plain alphanumeric text.`
          );
        }
      }
      // Check for unquoted HTML tags in node label brackets: [<tag>]
      if (/\[[^"\]]*<[a-zA-Z0-9_-]+>[^"\]]*\]/.test(line)) {
        errors.push(
          `Mermaid syntax hazard in ${rel} (line ~${i + 1}): Unquoted HTML tag in node '${line.trim()}'. Wrap label in double quotes.`
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error('[verify:docs] FAILED with errors:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`[verify:docs] PASSED (${REQUIRED_AGENTS_MD.length} recursive AGENTS.md verified, 0 .mjs/.cmd files, 0 AI-slop violations).`);
