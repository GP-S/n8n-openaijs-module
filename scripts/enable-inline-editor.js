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

const candidateExtensions = ['.ts', '.js', '.mjs', '.cjs'];

function patchFile(filePath) {
  if (visited.has(filePath)) return;
  visited.add(filePath);

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return;
  }

  if (!content.includes('NODES_USING_CODE_NODE_EDITOR')) return;
  if (content.includes(NODE_TYPE)) return;

  const markerIndex = content.indexOf('NODES_USING_CODE_NODE_EDITOR');
  if (markerIndex === -1) return;

  const openBracketIndex = content.indexOf('[', markerIndex);
  if (openBracketIndex === -1) return;

  const closeSequence = '];';
  const closeIndex = content.indexOf(closeSequence, openBracketIndex);
  if (closeIndex === -1) return;

  const arrayContent = content.slice(openBracketIndex + 1, closeIndex);
  if (arrayContent.includes(NODE_TYPE)) return;

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
    const updatedContent = `${before}${needsPadding}${newArrayContent}${needsPadding}${after}`;

    fs.writeFileSync(filePath, updatedContent, 'utf8');
    patchedFiles.push(filePath);
    return;
  }

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

  const newContent = `${content.slice(0, openBracketIndex + 1)}${lines.join('\n')}${content.slice(closeIndex)}`;

  fs.writeFileSync(filePath, newContent, 'utf8');
  patchedFiles.push(filePath);
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

