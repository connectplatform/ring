#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { WEB_ROOT, CLI_ROOT } from './paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkgPath = [
  join(WEB_ROOT, 'package.json'),
  join(CLI_ROOT, 'package.json'),
  join(__dirname, '../package.json'),
].find((p) => existsSync(p));
const packageJson = JSON.parse(readFileSync(pkgPath, 'utf8'));

const program = new Command();

program
  .name('ring')
  .description('Ring Platform CLI - Deploy and manage Ring Platform services')
  .version(packageJson.version);

program
  .command('prod')
  .description('Deploy to production Kubernetes cluster')
  .option('-v, --deploy-version <version>', 'Version to deploy (defaults to package.json version); use this to avoid clash with global --version')
  .option('--skip-build', 'Skip Docker build step')
  .option('--skip-push', 'Skip Docker push step')
  .option('--skip-deploy', 'Skip Kubernetes deployment step')
  .option('--skip-manifest-apply', 'Skip kubectl apply of k8s/deployment.yaml (replicas/strategy/image baseline)')
  .option(
    '--apply-k8s-secrets',
    'Apply RING_K8S_SECRETS_YAML or k8s/secrets.yaml to the cluster (Secret + ConfigMap) before rollout; required when adding keys locally'
  )
  .option(
    '--forge-buildkit',
    'Build+push via k3s-3 BuildKit → registry.ringdom.org/ringdom-clones/ring (Layer1 CI; prefer over local Colima/QEMU)'
  )
  .option('--from-forge', 'With --forge-buildkit: clone forge.ringdom.org/ringdom/ring on builder instead of rsyncing local tree')
  .option('--dry-run', 'Print all build/push/deploy commands without executing them')
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
  .command('upgrade')
  .description('Pull Ring Platform system updates from the configured upstream git repo (3-way merge, non-destructive)')
  .option('--apply', 'Apply the 3-way merge (default is a dry-run preview)')
  .option('-r, --repo <url>', 'Override the upstream git URL for this run (default: config upgrade.repoUrl)')
  .option('-b, --branch <branch>', 'Override the upstream branch for this run (default: config upgrade.branch)')
  .option('--force', 'Allow --apply even when the working tree has uncommitted changes')
  .action(async (options) => {
    const { default: upgradeCommand } = await import('./commands/upgrade.js');
    await upgradeCommand(options);
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
