#!/usr/bin/env node
/**
 * Fix MDX Code Block Title Migration Errors
 * 
 * Problem: Migration script incorrectly moved first comment line from code content
 * to the title attribute, causing JSX syntax errors when comments contain URLs, 
 * dots, slashes, colons, etc.
 * 
 * Solution: Move those title comments back into the code block and use simple 
 * descriptive titles instead.
 * 
 * Example Fix:
 * BEFORE (BROKEN):
 *   <Code language="bash" title="# Download from https://example.com/releases">
 *   {`nvm install 18`}
 *   </Code>
 * 
 * AFTER (FIXED):
 *   <Code language="bash" title="terminal">
 *   {`# Download from https://example.com/releases
 * nvm install 18`}
 *   </Code>
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const DOCS_DIR = path.join(process.cwd(), 'docs/content');

// Regex to find Code blocks with titles containing special chars (comments or commands)
// Updated to handle multiline code blocks properly
const CODE_BLOCK_REGEX = /<Code\s+language="([^"]+)"\s+title="([^"]+)">\s*\{`([\s\S]*?)`\}\s*<\/Code>/g;

function hasProblematicChars(title) {
  // Check if title contains characters that break JSX attribute syntax
  // This includes: dots in filenames, URLs, paths, special chars, etc.
  return (
    title.includes('.env') ||     // Environment files
    title.includes('.local') ||   // .local files
    title.includes('.template') || // Template files
    title.includes('.json') ||    // JSON files
    title.includes('.yaml') ||
    title.includes('.yml') ||
    title.includes('.config') ||
    title.includes('.js') ||      // Code files
    title.includes('.ts') ||
    title.includes('.tsx') ||
    title.includes('.jsx') ||
    title.includes('.md') ||
    title.includes('.mdx') ||
    title.includes('://') ||      // URLs
    title.includes('.com') ||     // Domains
    title.includes('.org') ||
    title.includes('.io') ||
    title.includes('@') ||        // Imports/emails
    (title.includes('/') && !title.match(/^(terminal|code|configuration)$/)) || // Paths but not simple titles
    title.includes('\\') ||       // Windows paths
    (title.includes('(') && title.includes(')')) || // Function calls
    title.match(/\s{2,}/)         // Multiple spaces
  );
}

function getSimpleTitle(language) {
  // Map language to simple, safe title
  const titleMap = {
    'bash': 'terminal',
    'sh': 'terminal',
    'powershell': 'terminal',
    'cmd': 'terminal',
    'zsh': 'terminal',
    'javascript': 'code',
    'typescript': 'code',
    'jsx': 'code',
    'tsx': 'code',
    'css': 'styles',
    'scss': 'styles',
    'env': 'configuration',
    'yaml': 'configuration',
    'json': 'configuration',
    'toml': 'configuration',
    'sql': 'query',
    'python': 'code',
    'rust': 'code',
    'go': 'code',
    'java': 'code',
    'markdown': 'content',
    'mdx': 'content',
    'html': 'markup',
    'xml': 'markup',
    'nginx': 'configuration',
    'dockerfile': 'docker',
    'hcl': 'terraform'
  };
  
  return titleMap[language.toLowerCase()] || 'code';
}

function fixCodeBlock(match, language, title, content) {
  // If title contains problematic characters, move it to code content
  if (hasProblematicChars(title)) {
    const simpleTitle = getSimpleTitle(language);
    
    // If title is a comment (starts with #), prepend it to content
    // If it's a command/filename, also prepend as comment
    let fixedContent;
    if (title.startsWith('#')) {
      fixedContent = content ? `${title}\n${content}` : title;
    } else {
      // Command or filename - add as comment
      fixedContent = content ? `# ${title}\n${content}` : `# ${title}`;
    }
    
    return `<Code language="${language}" title="${simpleTitle}">
{\`${fixedContent}\`}
</Code>`;
  }
  
  // Otherwise, keep as is
  return match;
}

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let fixCount = 0;
  
  const fixed = content.replace(CODE_BLOCK_REGEX, (match, language, title, code) => {
    if (hasProblematicChars(title)) {
      fixCount++;
      return fixCodeBlock(match, language, title, code);
    }
    return match;
  });
  
  if (fixCount > 0) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`✅ Fixed ${fixCount} code blocks in ${path.relative(DOCS_DIR, filePath)}`);
    return fixCount;
  }
  
  return 0;
}

async function main() {
  console.log('🔍 Searching for MDX files with broken Code blocks...\n');
  
  const mdxFiles = await glob('**/*.mdx', { 
    cwd: DOCS_DIR,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.next/**']
  });
  
  console.log(`📄 Found ${mdxFiles.length} MDX files\n`);
  
  let totalFixed = 0;
  let filesFixed = 0;
  
  for (const file of mdxFiles) {
    const fixed = fixFile(file);
    if (fixed > 0) {
      totalFixed += fixed;
      filesFixed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✨ Complete!`);
  console.log(`📊 Fixed ${totalFixed} code blocks across ${filesFixed} files`);
  console.log('='.repeat(60));
}

main().catch(console.error);

