const fs = require('fs');
const path = require('path');

// Function to recursively list all .ts and .tsx files, excluding .next and node_modules
function listFilesRecursively(dir) {
  const fileList = [];
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      if (file !== '.next' && file !== 'node_modules') {
        fileList.push(...listFilesRecursively(filePath));
      }
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Function to extract summaries from a file
function extractSummaries(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports = [];
  const constants = [];
  const functions = [];
  const exports = [];

  const lines = content.split('\n');
  lines.forEach((line) => {
    if (line.includes('import')) {
      imports.push(line.trim());
    } else if (line.includes('const')) {
      constants.push(line.trim());
    } else if (line.includes('function') || line.includes('async function') || line.includes('export function')) {
      functions.push(line.trim());
    } else if (line.includes('export')) {
      exports.push(line.trim());
    }
  });

  return { imports, constants, functions, exports };
}

// Main function to generate the file list and summaries
function generateFileListAndSummaries(dir) {
  const fileList = listFilesRecursively(dir);
  const output = [];

  fileList.forEach((filePath) => {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(dir, filePath);

    if (fileName === 'types.ts' || relativePath === 'middleware.ts' || relativePath === 'auth.ts' || relativePath === 'auth.config.ts') {
      // Include full content for specific files
      const content = fs.readFileSync(filePath, 'utf-8');
      output.push(`${filePath}:\n${content}`);
    } else {
      // Extract summaries for other files
      const summaries = extractSummaries(filePath);
      output.push(`${filePath}:\n${summaries.imports.join(', ')}, ${summaries.constants.join(', ')}, ${summaries.functions.join(', ')}, ${summaries.exports.join(', ')}`);
    }
  });

  fs.writeFileSync('fileListAndSummaries.txt', output.join('\n\n'));
}

// Example usage
const directoryPath = '.'; // Current directory
generateFileListAndSummaries(directoryPath);
