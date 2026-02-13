#!/usr/bin/env node
/**
 * Restructure Code Blocks to Follow Ring Platform Documentation Standards
 * 
 * Problem: Comments are embedded inside code blocks when they should be 
 * descriptive text outside the blocks, following Steps/Step component patterns.
 * 
 * Ring Platform Standard Pattern:
 * <Step>
 * ### Heading
 * 
 * Descriptive text explaining the step
 * 
 * <Code language="bash" title="terminal">
 * {`command without comments`}
 * </Code>
 * 
 * </Step>
 * 
 * This script extracts comments from code and converts them to proper MDX structure.
 * 
 * For Emperor Ray - Zero flaws, perfect documentation! 🔥⚔️👑
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const DOCS_DIR = path.join(process.cwd(), 'docs/content');

function extractComments(codeContent) {
  const lines = codeContent.split('\n');
  const comments = [];
  const codeLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') && !trimmed.startsWith('#!')) {
      // Extract comment without the # and leading/trailing whitespace
      comments.push(trimmed.substring(1).trim());
    } else if (trimmed.length > 0 || codeLines.length > 0) {
      // Keep the line if it's non-empty or if we've already started collecting code
      codeLines.push(line);
    }
  }
  
  // Remove trailing empty lines from code
  while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') {
    codeLines.pop();
  }
  
  return { comments, codeLines };
}

function shouldRestructure(codeContent) {
  // Check if code has comments that should be extracted
  const lines = codeContent.split('\n');
  let hasComments = false;
  let hasCode = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') && !trimmed.startsWith('#!')) {
      hasComments = true;
    } else if (trimmed.length > 0) {
      hasCode = true;
    }
  }
  
  // Only restructure if we have both comments and actual code
  return hasComments && hasCode;
}

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let fixCount = 0;
  
  // Match Code blocks with content
  const regex = /<Code\s+language="([^"]+)"\s+title="([^"]+)">\s*\{`([\s\S]*?)`\}\s*<\/Code>/g;
  
  const fixed = content.replace(regex, (match, language, title, codeContent) => {
    if (!shouldRestructure(codeContent)) {
      return match; // Keep as-is if no restructuring needed
    }
    
    const { comments, codeLines } = extractComments(codeContent);
    
    if (comments.length === 0 || codeLines.length === 0) {
      return match; // Keep as-is if nothing to extract
    }
    
    fixCount++;
    
    // Build the restructured version with comments as descriptive text
    const commentText = comments.join(' ');
    const cleanCode = codeLines.join('\n');
    
    return `${commentText}

<Code language="${language}" title="${title}">
{\`${cleanCode}\`}
</Code>`;
  });
  
  if (fixCount > 0) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`✅ Restructured ${fixCount} code blocks in ${path.relative(DOCS_DIR, filePath)}`);
    return fixCount;
  }
  
  return 0;
}

async function main() {
  console.log('🔍 Restructuring code blocks to Ring Platform standards...\n');
  console.log('📋 Extracting comments from code and converting to descriptive text\n');
  
  const mdxFiles = await glob('**/*.mdx', { 
    cwd: DOCS_DIR,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.next/**']
  });
  
  console.log(`📄 Scanning ${mdxFiles.length} MDX files\n`);
  
  let totalFixed = 0;
  let filesFixed = 0;
  
  for (const file of mdxFiles) {
    const fixed = fixFile(file);
    if (fixed > 0) {
      totalFixed += fixed;
      filesFixed++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`✨ Documentation Restructured!`);
  console.log(`📊 Fixed ${totalFixed} code blocks across ${filesFixed} files`);
  console.log(`🎖️ Comments now appear as descriptive text, not code!`);
  console.log('='.repeat(70));
}

main().catch(console.error);

