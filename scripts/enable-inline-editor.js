#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const NODE_TYPE = 'n8n-nodes-unsafe-code.unsafeCode';
const packagesToCheck = [
  'n8n-editor-ui',
  '@n8n/editor-ui',
  '@n8n/frontend',
  '@n8n/frontend-editor-ui',
];

const visited = new Set();
const patchedFiles = [];

const searchRoots = new Set();

for (const pkg of packagesToCheck) {
  try {
    const pkgPath = require.resolve(path.join(pkg, 'package.json'), { paths: [process.cwd()] });
    searchRoots.add(path.dirname(pkgPath));
  } catch (error) {
    // Package not available in this installation.
  }
}

if (process.env.N8N_EDITOR_UI_PATH) {
  searchRoots.add(path.resolve(process.env.N8N_EDITOR_UI_PATH));
}

const candidateExtensions = ['.ts', '.js', '.mjs', '.cjs', '.vue'];

const CODE_NODE_VAR_REGEX = /([A-Za-z_$][\w$]*)\s*=\s*['"]n8n-nodes-base\.code['"]/g;
const CODE_NODE_TYPE_IDENTIFIER = 'CODE_NODE_TYPE';

function patchCodeNodeEquality(content) {
  let updated = content;
  let changed = false;

  const ensureEqualityIncludesUnsafe = (identifier) => {
    const identifierPattern = '(?:[\\w$]+(?:\\.[\\w$]+)*)\\.type';
    const equalityRegex = new RegExp(
      `(${identifierPattern})\\s*===\\s*${identifier}(?!\\s*\\|\\|\\s*\\1\\.type\\s*===\\s*['\"]${NODE_TYPE}['\"])`,
      'g',
    );

    updated = updated.replace(equalityRegex, (match, left) => {
      changed = true;
      return `${match}||${left}.type==='${NODE_TYPE}'`;
    });
  };

  ensureEqualityIncludesUnsafe(CODE_NODE_TYPE_IDENTIFIER);

  const varNames = new Set();
  let match;
  while ((match = CODE_NODE_VAR_REGEX.exec(updated)) !== null) {
    if (match[1] !== CODE_NODE_TYPE_IDENTIFIER) {
      varNames.add(match[1]);
    }
  }

  for (const varName of varNames) {
    ensureEqualityIncludesUnsafe(varName);
  }

  const explicitCheck = `node.type === ${CODE_NODE_TYPE_IDENTIFIER}`;
  const explicitCheckCompact = `node.type===${CODE_NODE_TYPE_IDENTIFIER}`;
  const replacement = `node.type === ${CODE_NODE_TYPE_IDENTIFIER} || node.type === '${NODE_TYPE}'`;
  const replacementCompact = `node.type===${CODE_NODE_TYPE_IDENTIFIER}||node.type==='${NODE_TYPE}'`;

  if (updated.includes(explicitCheck) && !updated.includes(replacement)) {
    updated = updated.replace(new RegExp(explicitCheck, 'g'), replacement);
    changed = true;
  }

  if (updated.includes(explicitCheckCompact) && !updated.includes(replacementCompact)) {
    updated = updated.replace(new RegExp(explicitCheckCompact, 'g'), replacementCompact);
    changed = true;
  }

  return { updated, changed };
}

function patchFile(filePath) {
  if (visited.has(filePath)) return;
  visited.add(filePath);

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return;
  }

  let updated = content;
  let changed = false;

  if (content.includes('NODES_USING_CODE_NODE_EDITOR') && !content.includes(NODE_TYPE)) {
    const markerIndex = content.indexOf('NODES_USING_CODE_NODE_EDITOR');
    if (markerIndex !== -1) {
      const openBracketIndex = content.indexOf('[', markerIndex);
      if (openBracketIndex !== -1) {
        const closeSequence = '];';
        const closeIndex = content.indexOf(closeSequence, openBracketIndex);
        if (closeIndex !== -1) {
          const arrayContent = content.slice(openBracketIndex + 1, closeIndex);
          if (!arrayContent.includes(NODE_TYPE)) {
            let newArrayContent;

            if (!arrayContent.includes('\n')) {
              const trimmed = arrayContent.trim();
              if (trimmed.length === 0) {
                newArrayContent = `'${NODE_TYPE}'`;
              } else {
                const normalized = trimmed.endsWith(',') ? trimmed.slice(0, -1).trimEnd() : trimmed;
                newArrayContent = `${normalized}, '${NODE_TYPE}'`;
              }

              const before = content.slice(0, openBracketIndex + 1);
              const after = content.slice(closeIndex);
              const needsPadding = newArrayContent.length > 0 ? ' ' : '';
              updated = `${before}${needsPadding}${newArrayContent}${needsPadding}${after}`;
            } else {
              const lines = arrayContent.split('\n');
              let lastContentIndex = -1;
              for (let i = lines.length - 1; i >= 0; i -= 1) {
                if (lines[i].trim().length > 0) {
                  lastContentIndex = i;
                  break;
                }
              }

              if (lastContentIndex === -1) {
                const indent = '        ';
                const insertionLine = `${indent}'${NODE_TYPE}',`;
                if (lines.length === 1) {
                  lines[0] = insertionLine;
                } else {
                  lines.splice(lines.length - 1, 0, insertionLine);
                }
              } else {
                if (!lines[lastContentIndex].trim().endsWith(',')) {
                  lines[lastContentIndex] = `${lines[lastContentIndex].trimEnd()},`;
                }
                const indentMatch = lines[lastContentIndex].match(/^\s*/);
                const indent = indentMatch ? indentMatch[0] : '        ';
                lines.splice(lastContentIndex + 1, 0, `${indent}'${NODE_TYPE}',`);
              }

              updated = `${content.slice(0, openBracketIndex + 1)}${lines.join('\n')}${content.slice(closeIndex)}`;
            }

            changed = true;
          }
        }
      }
    }
  }

  const equalityResult = patchCodeNodeEquality(updated);
  updated = equalityResult.updated;
  changed = changed || equalityResult.changed;

  if (changed) {
    fs.writeFileSync(filePath, updated, 'utf8');
    patchedFiles.push(filePath);
  }
}

function walkDirectory(dir, depth = 0) {
  if (depth > 6) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(entryPath, depth + 1);
      continue;
    }

    if (!entry.isFile()) continue;

    if (!candidateExtensions.some((ext) => entry.name.endsWith(ext))) continue;

    patchFile(entryPath);
  }
}

for (const root of searchRoots) {
  walkDirectory(root);
}

if (patchedFiles.length > 0) {
  console.log('[unsafe-code] Enabled inline editor support for:', NODE_TYPE);
  for (const file of patchedFiles) {
    console.log(`  - ${path.relative(process.cwd(), file)}`);
  }
} else {
  console.log('[unsafe-code] No editor files patched. If inline editing remains read-only, ensure the n8n editor UI package is accessible and rerun `npm run patch:ui`.');
}

