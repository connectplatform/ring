const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PROJECT_ROOT = process.cwd();
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'extracted-logic');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'concatenated-code.md');

// File extensions to include
const CODE_EXTENSIONS = ['.tsx', '.ts', '.js', '.jsx', '.json', '.md', '.yml', '.yaml'];
const CONFIG_FILES = ['package.json', 'tsconfig.json', 'tailwind.config.js', 'next.config.js', '.env.example', 'README.md'];

// Directories to skip
const SKIP_DIRS = [
  'node_modules', 
  '.next', 
  '.git', 
  'dist', 
  'build', 
  '.cache',
  'coverage',
  '.nyc_output',
  'extracted-logic'
];

// Files to skip
const SKIP_FILES = [
  '.DS_Store',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
];

// Priority order for file types (higher priority = shown first)
const FILE_PRIORITY = {
  'README.md': 1000,
  'package.json': 900,
  'tsconfig.json': 850,
  'next.config.js': 800,
  'tailwind.config.js': 750,
  '.env.example': 700,
  // Pages/App Router files
  'layout.tsx': 600,
  'page.tsx': 590,
  'loading.tsx': 580,
  'error.tsx': 570,
  'not-found.tsx': 560,
  // API routes
  'route.ts': 550,
  // Components
  '.tsx': 500,
  '.ts': 450,
  '.jsx': 400,
  '.js': 350,
  '.json': 300,
  '.md': 200,
  '.yml': 100,
  '.yaml': 100
};

// Get file priority
function getFilePriority(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath);
  
  // Check for exact filename matches first
  if (FILE_PRIORITY[fileName]) {
    return FILE_PRIORITY[fileName];
  }
  
  // Check for extension matches
  if (FILE_PRIORITY[ext]) {
    return FILE_PRIORITY[ext];
  }
  
  // Default priority
  return 0;
}

// Check if file should be included
function shouldIncludeFile(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath);
  const relativePath = path.relative(PROJECT_ROOT, filePath);
  
  // Skip files in excluded directories
  if (SKIP_DIRS.some(dir => relativePath.includes(dir))) {
    return false;
  }
  
  // Skip specific files
  if (SKIP_FILES.includes(fileName)) {
    return false;
  }
  
  // Include config files
  if (CONFIG_FILES.includes(fileName)) {
    return true;
  }
  
  // Include files with relevant extensions
  if (CODE_EXTENSIONS.includes(ext)) {
    return true;
  }
  
  return false;
}

// Get file category for organization
function getFileCategory(filePath) {
  const relativePath = path.relative(PROJECT_ROOT, filePath);
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath);
  
  // Configuration files
  if (CONFIG_FILES.includes(fileName)) {
    return 'Configuration';
  }
  
  // Documentation
  if (ext === '.md') {
    return 'Documentation';
  }
  
  // API routes
  if (relativePath.includes('/api/') || fileName === 'route.ts') {
    return 'API Routes';
  }
  
  // App router files
  if (relativePath.includes('/app/') && ['layout.tsx', 'page.tsx', 'loading.tsx', 'error.tsx', 'not-found.tsx'].includes(fileName)) {
    return 'App Router';
  }
  
  // Pages (if using pages router)
  if (relativePath.includes('/pages/')) {
    return 'Pages';
  }
  
  // Components
  if (relativePath.includes('/components/') || ext === '.tsx') {
    return 'Components';
  }
  
  // Hooks
  if (relativePath.includes('/hooks/') || fileName.startsWith('use')) {
    return 'Hooks';
  }
  
  // Utils/lib
  if (relativePath.includes('/utils/') || relativePath.includes('/lib/')) {
    return 'Utilities';
  }
  
  // Types
  if (relativePath.includes('/types/') || fileName.includes('.types.')) {
    return 'Types';
  }
  
  // Styles
  if (relativePath.includes('/styles/') || ext === '.css') {
    return 'Styles';
  }
  
  // Database/models
  if (relativePath.includes('/models/') || relativePath.includes('/db/')) {
    return 'Database';
  }
  
  // Other TypeScript/JavaScript files
  if (['.ts', '.js', '.jsx'].includes(ext)) {
    return 'Scripts';
  }
  
  return 'Other';
}

// Extract file content with metadata
function extractFileContent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    const stats = fs.statSync(filePath);
    const lines = content.split('\n').length;
    
    return {
      path: relativePath,
      fullPath: filePath,
      size: stats.size,
      lines,
      content,
      category: getFileCategory(filePath),
      priority: getFilePriority(filePath),
      lastModified: stats.mtime
    };
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

// Walk directory and collect files
function collectFiles(dir) {
  const files = [];
  
  try {
    const entries = fs.readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        if (!SKIP_DIRS.includes(entry)) {
          files.push(...collectFiles(fullPath));
        }
      } else if (shouldIncludeFile(fullPath)) {
        const fileData = extractFileContent(fullPath);
        if (fileData) {
          files.push(fileData);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return files;
}

// Generate table of contents
function generateTableOfContents(filesByCategory) {
  let toc = '# Table of Contents\n\n';
  
  Object.keys(filesByCategory).sort().forEach(category => {
    toc += `## ${category}\n`;
    filesByCategory[category].forEach(file => {
      toc += `- [${file.path}](#${file.path.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}) (${file.lines} lines)\n`;
    });
    toc += '\n';
  });
  
  return toc;
}

// Generate project summary
function generateProjectSummary(files) {
  const totalFiles = files.length;
  const totalLines = files.reduce((sum, file) => sum + file.lines, 0);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  
  const categories = {};
  const extensions = {};
  
  files.forEach(file => {
    // Count by category
    categories[file.category] = (categories[file.category] || 0) + 1;
    
    // Count by extension
    const ext = path.extname(file.path);
    extensions[ext] = (extensions[ext] || 0) + 1;
  });
  
  let summary = '# Project Summary\n\n';
  summary += `**Total Files:** ${totalFiles}\n`;
  summary += `**Total Lines:** ${totalLines.toLocaleString()}\n`;
  summary += `**Total Size:** ${(totalSize / 1024).toFixed(2)} KB\n\n`;
  
  summary += '## Files by Category\n';
  Object.entries(categories)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
      summary += `- **${category}:** ${count} files\n`;
    });
  
  summary += '\n## Files by Extension\n';
  Object.entries(extensions)
    .sort(([,a], [,b]) => b - a)
    .forEach(([ext, count]) => {
      summary += `- **${ext || 'no extension'}:** ${count} files\n`;
    });
  
  summary += '\n---\n\n';
  
  return summary;
}

// Generate the concatenated extract
function generateExtract() {
  console.log('🔍 Scanning codebase...');
  const files = collectFiles(PROJECT_ROOT);
  
  console.log(`📁 Found ${files.length} files to extract`);
  
  // Sort files by priority and then by path
  files.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.path.localeCompare(b.path);
  });
  
  // Group files by category
  const filesByCategory = {};
  files.forEach(file => {
    if (!filesByCategory[file.category]) {
      filesByCategory[file.category] = [];
    }
    filesByCategory[file.category].push(file);
  });
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  console.log('📝 Generating concatenated extract...');
  
  let output = '';
  
  // Add header
  output += `# Codebase Extract\n\n`;
  output += `Generated on: ${new Date().toISOString()}\n`;
  output += `Project Root: ${PROJECT_ROOT}\n\n`;
  
  // Add project summary
  output += generateProjectSummary(files);
  
  // Add table of contents
  output += generateTableOfContents(filesByCategory);
  
  // Add file contents
  output += '# File Contents\n\n';
  
  Object.keys(filesByCategory).sort().forEach(category => {
    output += `## ${category}\n\n`;
    
    filesByCategory[category].forEach(file => {
      output += `### ${file.path}\n\n`;
      output += `**Lines:** ${file.lines} | **Size:** ${file.size} bytes | **Modified:** ${file.lastModified.toISOString()}\n\n`;
      
      // Determine language for syntax highlighting
      const ext = path.extname(file.path);
      let language = '';
      switch (ext) {
        case '.tsx': language = 'tsx'; break;
        case '.ts': language = 'typescript'; break;
        case '.jsx': language = 'jsx'; break;
        case '.js': language = 'javascript'; break;
        case '.json': language = 'json'; break;
        case '.md': language = 'markdown'; break;
        case '.yml':
        case '.yaml': language = 'yaml'; break;
        case '.css': language = 'css'; break;
        default: language = '';
      }
      
      output += `\`\`\`${language}\n`;
      output += file.content;
      if (!file.content.endsWith('\n')) {
        output += '\n';
      }
      output += '```\n\n';
      output += '---\n\n';
    });
  });
  
  // Write the extract
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
  
  // Generate additional metadata files
  const metadata = {
    generatedAt: new Date().toISOString(),
    projectRoot: PROJECT_ROOT,
    totalFiles: files.length,
    totalLines: files.reduce((sum, file) => sum + file.lines, 0),
    totalSize: files.reduce((sum, file) => sum + file.size, 0),
    categories: Object.keys(filesByCategory).reduce((acc, cat) => {
      acc[cat] = filesByCategory[cat].length;
      return acc;
    }, {}),
    files: files.map(f => ({
      path: f.path,
      category: f.category,
      lines: f.lines,
      size: f.size,
      lastModified: f.lastModified
    }))
  };
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'extract-metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  console.log(`✅ Extract complete!`);
  console.log(`📄 Main extract: ${OUTPUT_FILE}`);
  console.log(`📊 Metadata: ${path.join(OUTPUT_DIR, 'extract-metadata.json')}`);
  console.log(`📈 Total: ${files.length} files, ${metadata.totalLines.toLocaleString()} lines`);
}

// Run the extraction
if (require.main === module) {
  generateExtract();
}

module.exports = { generateExtract }; 