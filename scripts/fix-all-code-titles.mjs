#!/usr/bin/env node
/**
 * Comprehensive MDX Code Block Title Fix
 * 
 * Fixes two migration errors:
 * 1. Comment lines moved to title (already partially fixed)
 * 2. First command line moved to title, rest left in content (NEW FIX)
 * 
 * Examples:
 * 
 * ERROR TYPE 1: Comment as title
 * <Code language="bash" title="# Comment with https://url.com">
 * {`actual command`}
 * </Code>
 * 
 * ERROR TYPE 2: Command as title  
 * <Code language="bash" title="curl https://example.com | bash">
 * {`next command`}
 * </Code>
 * 
 * Both should become:
 * <Code language="bash" title="terminal">
 * {`# Comment with https://url.com
 * actual command`}
 * </Code>
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const DOCS_DIR = path.join(process.cwd(), 'docs/content');

function getSimpleTitle(language) {
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

function shouldFixTitle(title, language) {
  // Check if title has problematic characters that shouldn't be in JSX attributes
  const hasProblematicChars = 
    title.includes('://') ||     // URLs
    title.includes('.com') ||    // Domains  
    title.includes('.org') ||
    title.includes('.io') ||
    title.includes('.git') ||
    title.includes('@') ||       // Imports/decorators
    title.includes('|') ||       // Pipes
    title.includes('>') ||       // Redirects
    title.includes('<') ||       // Redirects
    title.includes('&&') ||      // Command chains
    title.includes('curl ') ||   // Common commands
    title.includes('git ') ||
    title.includes('npm ') ||
    title.includes('docker ') ||
    title.includes('brew ') ||
    title.includes('apt ') ||
    title.includes('sudo ') ||
    title.includes('echo ') ||
    title.includes('cd ') ||
    title.includes('mkdir ') ||
    (title.includes('(') && title.includes(')')) || // Function calls
    title.match(/\s{2,}/) ||     // Multiple spaces
    title.length > 60;           // Very long titles (likely commands)
    
  return hasProblematicChars;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let fixCount = 0;
  
  // Pattern to match Code blocks
  const codeBlockRegex = /<Code\s+language="([^"]+)"\s+title="([^"]*)">\s*\{`([\s\S]*?)`\}\s*<\/Code>/g;
  
  content = content.replace(codeBlockRegex, (match, language, title, code) => {
    if (shouldFixTitle(title, language)) {
      fixCount++;
      const simpleTitle = getSimpleTitle(language);
      
      // Restore title to code content
      let fixedContent;
      if (code.trim()) {
        // Content exists, prepend title
        fixedContent = `${title}\n${code}`;
      } else {
        // No content, title IS the content
        fixedContent = title;
      }
      
      return `<Code language="${language}" title="${simpleTitle}">
{\`${fixedContent}\`}
</Code>`;
    }
    return match;
  });
  
  if (fixCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed ${fixCount} blocks in ${path.relative(DOCS_DIR, filePath)}`);
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

