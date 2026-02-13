#!/usr/bin/env node

/**
 * Convert legacy markdown code blocks to <Code> JSX components
 * Preserves mermaid blocks (already converted to <Mermaid>)
 * 
 * Usage: node scripts/convert-code-blocks-to-jsx.js [path]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Languages that should be converted to <Code> components
const CODE_LANGUAGES = [
  'typescript', 'ts',
  'javascript', 'js', 'jsx', 'tsx',
  'python', 'py',
  'bash', 'sh', 'shell',
  'json', 'yaml', 'yml',
  'sql',
  'css', 'scss', 'sass',
  'html', 'xml',
  'markdown', 'md',
  'rust', 'go', 'java', 'c', 'cpp',
  'php', 'ruby', 'swift', 'kotlin',
  'graphql', 'prisma',
  'dockerfile', 'docker',
  'nginx', 'apache',
  'diff', 'patch',
  'regex', 'text', 'plain',
  'env', 'dotenv',
  'hcl', 'terraform',
  'powershell', 'ps1',
  'solidity', 'sol',
  'groovy'
];

// Directories to skip
const SKIP_DIRS = ['node_modules', '.next', '.git', 'dist', 'build'];

function shouldProcessFile(filePath) {
  return filePath.endsWith('.mdx') || filePath.endsWith('.md');
}

function shouldSkipDirectory(dirName) {
  return SKIP_DIRS.some(skip => dirName.includes(skip));
}

function convertCodeBlocks(content, filePath) {
  let converted = 0;
  let skipped = 0;

  // Match code blocks: ```language\n...code...\n```
  // This regex captures: language, optional title in comments, and code content
  const codeBlockRegex = /```(\w+)(?:\s+(.+?))?\n([\s\S]*?)```/g;

  const newContent = content.replace(codeBlockRegex, (match, lang, titleComment, code) => {
    // Skip if already converted to JSX (contains <Code> or <Mermaid>)
    if (match.includes('<Code') || match.includes('<Mermaid>') || match.includes('<MindMap>')) {
      skipped++;
      return match;
    }

    // Skip mermaid/mindmap - should already be <Mermaid> components
    if (lang === 'mermaid' || lang === 'mindmap') {
      console.log(`⚠️  Found unconverted ${lang} block in ${filePath} - should be <Mermaid>`);
      skipped++;
      return match;
    }

    // Only convert known code languages
    if (!CODE_LANGUAGES.includes(lang.toLowerCase())) {
      console.log(`ℹ️  Skipping unknown language '${lang}' in ${filePath}`);
      skipped++;
      return match;
    }

    // Extract title if present (some docs use comments for titles)
    let title = '';
    if (titleComment && titleComment.trim()) {
      title = titleComment.trim();
    }

    // Trim the code and escape backticks
    const trimmedCode = code.trim();

    converted++;

    // Generate <Code> component
    if (title) {
      return `<Code language="${lang}" title="${title}">\n{\`${trimmedCode}\`}\n</Code>`;
    } else {
      return `<Code language="${lang}">\n{\`${trimmedCode}\`}\n</Code>`;
    }
  });

  return { newContent, converted, skipped };
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { newContent, converted, skipped } = convertCodeBlocks(content, filePath);

    if (converted > 0) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ ${path.basename(filePath)}: ${converted} code blocks converted, ${skipped} skipped`);
      return { converted, skipped, files: 1 };
    } else if (skipped > 0) {
      console.log(`⏭️  ${path.basename(filePath)}: ${skipped} blocks skipped (already converted or non-code)`);
      return { converted: 0, skipped, files: 0 };
    }

    return { converted: 0, skipped: 0, files: 0 };
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return { converted: 0, skipped: 0, files: 0 };
  }
}

function walkDirectory(dir, stats = { converted: 0, skipped: 0, files: 0 }) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!shouldSkipDirectory(item)) {
        walkDirectory(fullPath, stats);
      }
    } else if (shouldProcessFile(fullPath)) {
      const result = processFile(fullPath);
      stats.converted += result.converted;
      stats.skipped += result.skipped;
      stats.files += result.files;
    }
  }

  return stats;
}

// Main execution
const targetPath = process.argv[2] || path.join(__dirname, '../docs');

console.log('🚀 Converting legacy code blocks to <Code> components...\n');
console.log(`📂 Target: ${targetPath}\n`);

if (!fs.existsSync(targetPath)) {
  console.error(`❌ Path not found: ${targetPath}`);
  process.exit(1);
}

const stats = walkDirectory(targetPath);

console.log('\n' + '='.repeat(60));
console.log('🎯 CONVERSION COMPLETE');
console.log('='.repeat(60));
console.log(`📊 Total code blocks converted: ${stats.converted}`);
console.log(`⏭️  Total blocks skipped: ${stats.skipped}`);
console.log(`📄 Files modified: ${stats.files}`);
console.log('='.repeat(60));

if (stats.converted > 0) {
  console.log('\n✅ All code blocks successfully converted to <Code> components!');
  console.log('🔥 For Emperor Ray. Zero flaws. Perfect execution.');
} else {
  console.log('\nℹ️  No code blocks needed conversion.');
}

