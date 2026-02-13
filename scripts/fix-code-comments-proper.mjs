#!/usr/bin/env node
/**
 * PROPER Code Block Comment Restructuring - Ring Platform Documentation Standards
 * 
 * Problem: Previous script mashed all comments together into unreadable text.
 * Solution: Intelligently format comments as proper descriptive text.
 * 
 * Examples:
 * 
 * BEFORE (code with comments):
 * ```bash
 * # Install nvm
 * curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
 * 
 * # Restart terminal or run:
 * source ~/.bashrc
 * 
 * # Install and use Node.js 18
 * nvm install 18
 * ```
 * 
 * AFTER (properly structured):
 * Install nvm:
 * 
 * <Code language="bash" title="terminal">
 * {`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash`}
 * </Code>
 * 
 * Restart terminal or run:
 * 
 * <Code language="bash" title="terminal">
 * {`source ~/.bashrc`}
 * </Code>
 * 
 * Install and use Node.js 18:
 * 
 * <Code language="bash" title="terminal">
 * {`nvm install 18
 * nvm use 18
 * nvm alias default 18`}
 * </Code>
 * 
 * For Emperor Ray - Perfect documentation structure! 🔥⚔️👑
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const DOCS_DIR = path.join(process.cwd(), 'docs/content');

function parseCodeWithComments(codeContent, language, title) {
  const lines = codeContent.split('\n');
  const sections = [];
  let currentComment = null;
  let currentCode = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed.startsWith('#') && !trimmed.startsWith('#!')) {
      // Save previous section if exists
      if (currentCode.length > 0) {
        sections.push({
          comment: currentComment,
          code: currentCode.filter(l => l.trim() !== '').join('\n')
        });
        currentCode = [];
      }
      
      // Extract comment text without # and trim
      currentComment = trimmed.substring(1).trim();
      // Add colon if it doesn't end with punctuation
      if (currentComment && !/[:.!?]$/.test(currentComment)) {
        currentComment += ':';
      }
    } else if (trimmed.length > 0) {
      currentCode.push(line);
    } else if (currentCode.length > 0) {
      // Keep blank lines within code sections
      currentCode.push(line);
    }
  }
  
  // Save last section
  if (currentCode.length > 0) {
    sections.push({
      comment: currentComment,
      code: currentCode.filter(l => l.trim() !== '').join('\n')
    });
  }
  
  return sections;
}

function buildRestructuredContent(sections, language, title) {
  if (sections.length === 0) return null;
  
  // If only one section with no meaningful separation, keep simple
  if (sections.length === 1 && sections[0].comment) {
    const { comment, code } = sections[0];
    return `${comment}

<Code language="${language}" title="${title}">
{\`${code}\`}
</Code>`;
  }
  
  // Multiple sections - create separate code blocks with descriptions
  const parts = sections.map(({ comment, code }) => {
    if (comment) {
      return `${comment}

<Code language="${language}" title="${title}">
{\`${code}\`}
</Code>`;
    } else {
      return `<Code language="${language}" title="${title}">
{\`${code}\`}
</Code>`;
    }
  });
  
  return parts.join('\n\n');
}

function shouldRestructure(codeContent) {
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
  
  return hasComments && hasCode;
}

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let fixCount = 0;
  
  // Match Code blocks
  const regex = /<Code\s+language="([^"]+)"\s+title="([^"]+)">\s*\{`([\s\S]*?)`\}\s*<\/Code>/g;
  
  const fixed = content.replace(regex, (match, language, title, codeContent) => {
    if (!shouldRestructure(codeContent)) {
      return match;
    }
    
    const sections = parseCodeWithComments(codeContent, language, title);
    
    if (sections.length === 0) {
      return match;
    }
    
    const restructured = buildRestructuredContent(sections, language, title);
    
    if (!restructured) {
      return match;
    }
    
    fixCount++;
    return restructured;
  });
  
  if (fixCount > 0) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`✅ Properly restructured ${fixCount} code blocks in ${path.relative(DOCS_DIR, filePath)}`);
    return fixCount;
  }
  
  return 0;
}

async function main() {
  console.log('🔍 PROPERLY restructuring code blocks to Ring Platform standards...\n');
  console.log('📋 Extracting comments and creating readable descriptive text\n');
  console.log('🎯 Multiple comment sections = Multiple code blocks with descriptions\n');
  
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
  console.log(`✨ Documentation Perfectly Restructured!`);
  console.log(`📊 Fixed ${totalFixed} code blocks across ${filesFixed} files`);
  console.log(`🎖️ Comments now readable descriptive text!`);
  console.log('='.repeat(70));
}

main().catch(console.error);

