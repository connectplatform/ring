#!/usr/bin/env node

/**
 * Convert remaining markdown mermaid/mindmap blocks to <Mermaid> JSX components
 * 
 * Usage: node scripts/convert-mermaid-to-jsx.js [path]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKIP_DIRS = ['node_modules', '.next', '.git', 'dist', 'build'];

function shouldProcessFile(filePath) {
  return filePath.endsWith('.mdx') || filePath.endsWith('.md');
}

function shouldSkipDirectory(dirName) {
  return SKIP_DIRS.some(skip => dirName.includes(skip));
}

function convertMermaidBlocks(content, filePath) {
  let converted = 0;

  // Match mermaid/mindmap code blocks: ```mermaid\n...code...\n``` or ```mindmap\n...code...\n```
  const mermaidRegex = /```(mermaid|mindmap)\n([\s\S]*?)```/g;

  const newContent = content.replace(mermaidRegex, (match, type, diagram) => {
    // Skip if already converted to JSX
    if (match.includes('<Mermaid>') || match.includes('<MindMap>')) {
      return match;
    }

    const trimmedDiagram = diagram.trim();
    converted++;

    // Use <Mermaid> for all diagram types (it handles both)
    return `<Mermaid>\n{\`${trimmedDiagram}\`}\n</Mermaid>`;
  });

  return { newContent, converted };
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { newContent, converted } = convertMermaidBlocks(content, filePath);

    if (converted > 0) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ ${path.basename(filePath)}: ${converted} mermaid blocks converted`);
      return { converted, files: 1 };
    }

    return { converted: 0, files: 0 };
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return { converted: 0, files: 0 };
  }
}

function walkDirectory(dir, stats = { converted: 0, files: 0 }) {
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
      stats.files += result.files;
    }
  }

  return stats;
}

// Main execution
const targetPath = process.argv[2] || path.join(__dirname, '../docs');

console.log('🎨 Converting mermaid/mindmap blocks to <Mermaid> components...\n');
console.log(`📂 Target: ${targetPath}\n`);

if (!fs.existsSync(targetPath)) {
  console.error(`❌ Path not found: ${targetPath}`);
  process.exit(1);
}

const stats = walkDirectory(targetPath);

console.log('\n' + '='.repeat(60));
console.log('🎨 MERMAID CONVERSION COMPLETE');
console.log('='.repeat(60));
console.log(`📊 Total mermaid blocks converted: ${stats.converted}`);
console.log(`📄 Files modified: ${stats.files}`);
console.log('='.repeat(60));

if (stats.converted > 0) {
  console.log('\n✅ All mermaid blocks successfully converted to <Mermaid> components!');
  console.log('🔥 For Emperor Ray. Diagrams shall render in glory!');
} else {
  console.log('\nℹ️  No mermaid blocks needed conversion.');
}

