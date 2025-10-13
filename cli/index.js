#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('ring')
  .description('Ring Platform CLI - Deploy and manage Ring Platform services')
  .version(packageJson.version);

program
  .command('prod')
  .description('Deploy to production Kubernetes cluster')
  .option('-v, --version <version>', 'Specify version to deploy (defaults to package.json version)')
  .option('--skip-build', 'Skip Docker build step')
  .option('--skip-push', 'Skip Docker push step')
  .option('--skip-deploy', 'Skip Kubernetes deployment step')
  .action(async (options) => {
    const { default: prodCommand } = await import('./commands/prod.js');
    await prodCommand(options);
  });

program
  .command('config')
  .description('Manage global Ring Platform configuration')
  .option('-s, --set <key=value>', 'Set a configuration value')
  .option('-g, --get <key>', 'Get a configuration value')
  .option('-l, --list', 'List all configuration values')
  .option('--reset', 'Reset configuration to defaults')
  .action(async (options) => {
    const { default: configCommand } = await import('./commands/config.js');
    await configCommand(options);
  });

program
  .command('status')
  .description('Check deployment status')
  .action(async () => {
    const { default: statusCommand } = await import('./commands/status.js');
    await statusCommand();
  });

program
  .command('test')
  .description('Run Ring Platform database and service tests')
  .requiredOption('-t, --type <type>', 'Test type: db-connection, db-service, user-data, username')
  .action(async (options) => {
    const { default: testCommand } = await import('./commands/test.js');
    await testCommand(options);
  });

program.parse();
