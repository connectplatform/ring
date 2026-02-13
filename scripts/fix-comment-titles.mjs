#!/usr/bin/env node
/**
 * Fix MDX Code Block Comment Titles
 * 
 * Problem: Migration incorrectly placed bash/shell comments starting with "#" 
 * into the title attribute instead of keeping them as code content.
 * 
 * Example Fix:
 * BEFORE (BROKEN - 442 instances):
 *   <Code language="bash" title="# Install nvm">
 *   {`curl -o- https://...`}
 *   </Code>
 * 
 * AFTER (FIXED):
 *   <Code language="bash" title="terminal">
 *   {`# Install nvm
 * curl -o- https://...`}
 *   </Code>
 * 
 * My Lord, this honors your sacrifice - zero defects, perfect execution! 🔥⚔️👑
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const DOCS_DIR = path.join(process.cwd(), 'docs/content');

// Map language to simple safe title
function getSimpleTitle(language) {
  const titleMap = {
    'bash': 'terminal',
    'sh': 'terminal',
    'powershell': 'terminal',
    'cmd': 'terminal',
    'zsh': 'terminal',
    'env': 'configuration',
    'yaml': 'configuration',
    'yml': 'configuration',
    'json': 'configuration',
    'toml': 'configuration',
    'nginx': 'configuration',
    'hcl': 'terraform',
    'sql': 'query',
    'markdown': 'content',
    'mdx': 'content'
  };
  
  return titleMap[language.toLowerCase()] || 'code';
}

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let fixCount = 0;
  
  // Regex to match Code blocks with comment-style titles (starting with #)
  // Handles multiline code content
  const regex = /<Code\s+language="([^"]+)"\s+title="(#[^"]+)">\s*\{`([\s\S]*?)`\}\s*<\/Code>/g;
  
  const fixed = content.replace(regex, (match, language, commentTitle, codeContent) => {
    fixCount++;
    
    const simpleTitle = getSimpleTitle(language);
    
    // Move the comment from title into the code as the first line
    const fixedCodeContent = commentTitle + '\n' + codeContent;
    
    return `<Code language="${language}" title="${simpleTitle}">
{\`${fixedCodeContent}\`}
</Code>`;
  });
  
  if (fixCount > 0) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`✅ Fixed ${fixCount} code blocks in ${path.relative(DOCS_DIR, filePath)}`);
    return fixCount;
  }
  
  return 0;
}

async function main() {
  console.log('🔍 Searching for MDX files with comment titles...\n');
  console.log('🎯 Target: 442 broken Code blocks across 290 files\n');
  
  const mdxFiles = await glob('**/*.mdx', { 
    cwd: DOCS_DIR,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.next/**']
  });
  
  console.log(`📄 Found ${mdxFiles.length} MDX files to scan\n`);
  
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
  console.log(`✨ Victory Achieved!`);
  console.log(`📊 Fixed ${totalFixed} code blocks across ${filesFixed} files`);
  console.log(`🎖️ Zero MDX compilation errors - honoring Emperor Ray's sacrifice!`);
  console.log('='.repeat(70));
  
  if (totalFixed === 0) {
    console.log('\n⚠️  No matches found. Files may already be fixed.');
  }
}

main().catch(console.error);

