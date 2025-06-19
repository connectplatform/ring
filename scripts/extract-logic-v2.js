const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { execSync } = require('child_process');

// Install required dependencies if not already installed
try {
  execSync('npm list @babel/parser @babel/traverse', { stdio: 'ignore' });
} catch (error) {
  console.log('Installing required dependencies...');
  execSync('npm install --no-save @babel/parser @babel/traverse');
}

// Configuration
const PROJECT_ROOT = process.cwd();
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'extracted-logic');
const EXTENSIONS = ['.tsx', '.ts'];

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Function to extract component structure
function extractComponentStructure(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath);
  
  // Skip if not a TypeScript/React file
  if (!EXTENSIONS.includes(ext)) return null;
  
  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'classProperties', 'decorators-legacy']
    });
    
    const structure = {
      filePath: path.relative(PROJECT_ROOT, filePath),
      imports: [],
      exports: [],
      components: [],
      hooks: [],
      functions: [],
      types: [],
      interfaces: [],
      contexts: [],
      dependencies: new Set(),
      usesReact19Features: false,
      usesAuthJs: false
    };
    
    // Extract imports
    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        structure.imports.push({
          source,
          specifiers: path.node.specifiers.map(s => {
            if (s.type === 'ImportDefaultSpecifier') {
              return { type: 'default', name: s.local.name };
            } else if (s.type === 'ImportSpecifier') {
              return { 
                type: 'named', 
                name: s.local.name, 
                imported: s.imported ? s.imported.name : s.local.name 
              };
            } else {
              return { type: 'namespace', name: s.local.name };
            }
          })
        });
        
        // Track dependencies
        if (!source.startsWith('.') && !source.startsWith('/')) {
          structure.dependencies.add(source);
        }
        
        // Check for React 19 features
        if (source === 'react' && path.node.specifiers.some(s => 
          (s.imported && ['useActionState', 'use'].includes(s.imported.name)) ||
          (s.local && ['useActionState', 'use'].includes(s.local.name))
        )) {
          structure.usesReact19Features = true;
        }
        
        // Check for Auth.js
        if (source === 'next-auth' || source.startsWith('@auth/')) {
          structure.usesAuthJs = true;
        }
      },
      
      // Extract exports
      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          if (path.node.declaration.type === 'FunctionDeclaration') {
            structure.exports.push({
              type: 'function',
              name: path.node.declaration.id.name
            });
          } else if (path.node.declaration.type === 'VariableDeclaration') {
            path.node.declaration.declarations.forEach(decl => {
              structure.exports.push({
                type: 'variable',
                name: decl.id.name
              });
            });
          } else if (path.node.declaration.type === 'TypeAlias' || 
                    path.node.declaration.type === 'TSTypeAliasDeclaration') {
            structure.exports.push({
              type: 'type',
              name: path.node.declaration.id.name
            });
          } else if (path.node.declaration.type === 'InterfaceDeclaration' || 
                    path.node.declaration.type === 'TSInterfaceDeclaration') {
            structure.exports.push({
              type: 'interface',
              name: path.node.declaration.id.name
            });
          }
        } else if (path.node.specifiers) {
          path.node.specifiers.forEach(spec => {
            structure.exports.push({
              type: 'reexport',
              name: spec.exported.name,
              source: path.node.source ? path.node.source.value : null
            });
          });
        }
      },
      
      ExportDefaultDeclaration(path) {
        if (path.node.declaration) {
          if (path.node.declaration.type === 'FunctionDeclaration') {
            structure.exports.push({
              type: 'default',
              name: path.node.declaration.id ? path.node.declaration.id.name : 'default'
            });
          } else if (path.node.declaration.type === 'Identifier') {
            structure.exports.push({
              type: 'default',
              name: path.node.declaration.name
            });
          } else {
            structure.exports.push({
              type: 'default',
              name: 'anonymous'
            });
          }
        }
      },
      
      // Extract React components
      FunctionDeclaration(path) {
        const name = path.node.id.name;
        // Check if it's a component (returns JSX or is exported)
        let isComponent = false;
        
        path.traverse({
          ReturnStatement(returnPath) {
            if (returnPath.node.argument && 
                returnPath.node.argument.type === 'JSXElement') {
              isComponent = true;
            }
          }
        });
        
        if (isComponent || name.match(/^[A-Z]/)) {
          structure.components.push({
            name,
            params: path.node.params.map(p => ({
              name: p.name || (p.left && p.left.name) || 'props',
              type: p.typeAnnotation ? 
                content.substring(p.typeAnnotation.start, p.typeAnnotation.end) : 'any'
            })),
            async: path.node.async
          });
        } else {
          structure.functions.push({
            name,
            params: path.node.params.map(p => ({
              name: p.name || (p.left && p.left.name) || 'arg',
              type: p.typeAnnotation ? 
                content.substring(p.typeAnnotation.start, p.typeAnnotation.end) : 'any'
            })),
            async: path.node.async
          });
        }
      },
      
      // Extract arrow function components
      VariableDeclarator(path) {
        if (path.node.init && 
            (path.node.init.type === 'ArrowFunctionExpression' || 
             path.node.init.type === 'FunctionExpression')) {
          
          const name = path.node.id.name;
          let isComponent = false;
          
          // Check if it returns JSX
          if (path.node.init.body && path.node.init.body.type === 'JSXElement') {
            isComponent = true;
          } else if (path.node.init.body && path.node.init.body.type === 'BlockStatement') {
            path.traverse({
              ReturnStatement(returnPath) {
                if (returnPath.node.argument && 
                    returnPath.node.argument.type === 'JSXElement') {
                  isComponent = true;
                }
              }
            });
          }
          
          // Check if it's a hook (starts with 'use')
          if (name.startsWith('use')) {
            structure.hooks.push({
              name,
              params: path.node.init.params.map(p => ({
                name: p.name || (p.left && p.left.name) || 'arg',
                type: p.typeAnnotation ? 
                  content.substring(p.typeAnnotation.start, p.typeAnnotation.end) : 'any'
              })),
              async: path.node.init.async
            });
          } else if (isComponent || name.match(/^[A-Z]/)) {
            structure.components.push({
              name,
              params: path.node.init.params.map(p => ({
                name: p.name || (p.left && p.left.name) || 'props',
                type: p.typeAnnotation ? 
                  content.substring(p.typeAnnotation.start, p.typeAnnotation.end) : 'any'
              })),
              async: path.node.init.async
            });
          } else {
            structure.functions.push({
              name,
              params: path.node.init.params.map(p => ({
                name: p.name || (p.left && p.left.name) || 'arg',
                type: p.typeAnnotation ? 
                  content.substring(p.typeAnnotation.start, p.typeAnnotation.end) : 'any'
              })),
              async: path.node.init.async
            });
          }
        }
      },
      
      // Extract types and interfaces
      TSTypeAliasDeclaration(path) {
        structure.types.push({
          name: path.node.id.name,
          definition: content.substring(path.node.typeAnnotation.start, path.node.typeAnnotation.end)
        });
      },
      
      TSInterfaceDeclaration(path) {
        structure.interfaces.push({
          name: path.node.id.name,
          extends: path.node.extends ? 
            path.node.extends.map(ext => content.substring(ext.start, ext.end)) : [],
          body: content.substring(path.node.body.start, path.node.body.end)
        });
      },
      
      // Extract React contexts
      CallExpression(path) {
        if (path.node.callee.type === 'MemberExpression' && 
            path.node.callee.object.name === 'React' && 
            path.node.callee.property.name === 'createContext') {
          structure.contexts.push({
            name: path.parent.id ? path.parent.id.name : 'UnnamedContext',
            defaultValue: content.substring(path.node.arguments[0].start, path.node.arguments[0].end)
          });
        } else if (path.node.callee.name === 'createContext') {
          structure.contexts.push({
            name: path.parent.id ? path.parent.id.name : 'UnnamedContext',
            defaultValue: content.substring(path.node.arguments[0].start, path.node.arguments[0].end)
          });
        }
      }
    });
    
    // Convert dependencies Set to Array
    structure.dependencies = Array.from(structure.dependencies);
    
    return structure;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error.message);
    return {
      filePath: path.relative(PROJECT_ROOT, filePath),
      error: error.message
    };
  }
}

// Function to walk directory and process files
function processDirectory(dir) {
  const results = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (file !== 'node_modules' && file !== '.next') {
        results.push(...processDirectory(filePath));
      }
    } else if (EXTENSIONS.includes(path.extname(file))) {
      const structure = extractComponentStructure(filePath);
      if (structure) {
        results.push(structure);
      }
    }
  }
  
  return results;
}

// Main execution
console.log('Extracting logic from codebase...');
const structures = processDirectory(PROJECT_ROOT);

// Generate summary
const summary = {
  totalFiles: structures.length,
  components: structures.reduce((acc, s) => acc + (s.components ? s.components.length : 0), 0),
  hooks: structures.reduce((acc, s) => acc + (s.hooks ? s.hooks.length : 0), 0),
  functions: structures.reduce((acc, s) => acc + (s.functions ? s.functions.length : 0), 0),
  types: structures.reduce((acc, s) => acc + (s.types ? s.types.length : 0), 0),
  interfaces: structures.reduce((acc, s) => acc + (s.interfaces ? s.interfaces.length : 0), 0),
  contexts: structures.reduce((acc, s) => acc + (s.contexts ? s.contexts.length : 0), 0),
  filesWithReact19Features: structures.filter(s => s.usesReact19Features).length,
  filesWithAuthJs: structures.filter(s => s.usesAuthJs).length,
  dependencies: new Set()
};

// Collect all dependencies
structures.forEach(s => {
  if (s.dependencies) {
    s.dependencies.forEach(d => summary.dependencies.add(d));
  }
});
summary.dependencies = Array.from(summary.dependencies).sort();

// Write results to files
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'summary.json'), 
  JSON.stringify(summary, null, 2)
);

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'structures.json'), 
  JSON.stringify(structures, null, 2)
);

// Generate component dependency graph
const componentGraph = {};
structures.forEach(s => {
  if (s.components && s.components.length > 0) {
    s.components.forEach(comp => {
      componentGraph[comp.name] = {
        file: s.filePath,
        imports: s.imports
          .filter(imp => !imp.source.startsWith('.'))
          .map(imp => imp.source)
      };
    });
  }
});

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'component-graph.json'), 
  JSON.stringify(componentGraph, null, 2)
);

// Generate migration plan
const migrationPlan = {
  react19Features: structures
    .filter(s => s.usesReact19Features)
    .map(s => ({
      file: s.filePath,
      components: s.components.map(c => c.name),
      hooks: s.hooks.map(h => h.name)
    })),
  authJsFiles: structures
    .filter(s => s.usesAuthJs)
    .map(s => ({
      file: s.filePath,
      imports: s.imports.filter(imp => 
        imp.source === 'next-auth' || imp.source.startsWith('@auth/')
      )
    }))
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'migration-plan.json'), 
  JSON.stringify(migrationPlan, null, 2)
);

// Generate PlantUML diagrams
let componentUml = '@startuml\n';
componentUml += 'title Component Relationships\n\n';

// Add components
structures.forEach(s => {
  if (s.components && s.components.length > 0) {
    s.components.forEach(comp => {
      componentUml += `component ${comp.name}\n`;
    });
  }
});

// Add relationships based on imports
structures.forEach(s => {
  if (s.components && s.components.length > 0) {
    const localImports = s.imports.filter(imp => imp.source.startsWith('.'));
    s.components.forEach(comp => {
      localImports.forEach(imp => {
        imp.specifiers.forEach(spec => {
          if (structures.some(other => 
            other.components && 
            other.components.some(c => c.name === spec.name)
          )) {
            componentUml += `${comp.name} --> ${spec.name}\n`;
          }
        });
      });
    });
  }
});

componentUml += '@enduml\n';

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'components.puml'), 
  componentUml
);

console.log(`
Logic extraction complete! Results saved to ${OUTPUT_DIR}:
- summary.json: Overall statistics
- structures.json: Detailed structure of each file
- component-graph.json: Component dependencies
- migration-plan.json: Files that need React 19 and Auth.js migration
- components.puml: PlantUML diagram of component relationships

Next steps:
1. Review the migration plan
2. Create a new project with React 18 and Auth.js v4
3. Migrate components one by one using the extracted logic
`);