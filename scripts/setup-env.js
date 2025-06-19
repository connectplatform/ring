#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const templatePath = path.join(__dirname, '../env.local.template');
const envPath = path.join(__dirname, '../.env.local');

// Check for --force flag
const forceFlag = process.argv.includes('--force');

async function setupEnv() {
  console.log('🚀 Setting up Ring environment...');
  
  // Read template
  const template = fs.readFileSync(templatePath, 'utf8');
  
  // Check if .env.local exists
  if (fs.existsSync(envPath)) {
    if (!forceFlag) {
      console.log('⚠️  .env.local already exists!');
      console.log('\nOptions:');
      console.log('1. Use existing .env.local (recommended)');
      console.log('2. Create new .env.local (will overwrite existing)');
      console.log('3. View current .env.local');
      console.log('4. Exit setup');
      
      const answer = await new Promise(resolve => {
        rl.question('\nWhat would you like to do? (1-4): ', resolve);
      });
      
      switch (answer) {
        case '1':
          console.log('✅ Using existing .env.local');
          rl.close();
          return;
        case '2':
          console.log('⚠️  Overwriting existing .env.local...');
          break;
        case '3':
          try {
            const editor = process.env.EDITOR || 'code';
            execSync(`${editor} ${envPath}`);
            console.log('\n✨ Opened existing .env.local in your editor');
          } catch (error) {
            console.log('\n📝 Current .env.local contents:');
            console.log(fs.readFileSync(envPath, 'utf8'));
          }
          rl.close();
          return;
        case '4':
          console.log('Setup cancelled.');
          rl.close();
          return;
        default:
          console.log('Invalid option. Setup cancelled.');
          rl.close();
          return;
      }
    }
  }
  
  // Create or overwrite .env.local
  fs.writeFileSync(envPath, template);
  
  console.log('✅ Created .env.local from template');
  console.log('\n📝 Please update the following values in .env.local:');
  console.log('1. Firebase configuration (API keys, project ID, etc.)');
  console.log('2. NextAuth configuration (URL, secret)');
  console.log('3. Authentication providers (Google, Apple)');
  console.log('4. Vercel Blob token');
  console.log('5. Polygon RPC URL');
  
  // Open .env.local in default editor
  try {
    const editor = process.env.EDITOR || 'code';
    execSync(`${editor} ${envPath}`);
    console.log('\n✨ Opened .env.local in your default editor');
  } catch (error) {
    console.log('\n📝 Please edit .env.local manually');
  }
  
  rl.close();
}

setupEnv().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
}); 