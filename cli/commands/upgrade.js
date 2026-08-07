import { execSync, execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getConfig, setConfig } from '../config.js';
import { logger } from '../utils.js';
import { RING_ROOT, WEB_ROOT, PROJECT_ROOT } from '../paths.js';

/** Git root: Layer1 monorepo uses ring/; flat clones use project root. */
const GIT_ROOT = existsSync(join(RING_ROOT, '.git')) ? RING_ROOT : PROJECT_ROOT;
const HISTORY_FILE = join(GIT_ROOT, '.ring-upgrade-history.json');
const EXCLUDE_FILE = [
  join(WEB_ROOT, '.reggie-propagate-exclude.json'),
  join(GIT_ROOT, '.reggie-propagate-exclude.json'),
  join(PROJECT_ROOT, '.reggie-propagate-exclude.json'),
].find((p) => existsSync(p)) || join(PROJECT_ROOT, '.reggie-propagate-exclude.json');

/**
 * `ring upgrade` — pull Ring Platform system updates from the configured upstream repo.
 *
 * Strategy: 3-way merge keyed on the last-synced upstream commit (copier/cruft pattern).
 *   base   = upgrade.lastSyncedRef  (the upstream commit this clone last synced)
 *   theirs = <remote>/<branch> HEAD (new upstream)
 *   ours   = this clone's working tree
 * Only files changed between base..theirs are touched; `.reggie-propagate-exclude.json`
 * paths are always skipped; conflicts are left as standard git merge markers for review.
 * Nothing is committed — the developer reviews, then commits.
 */
export default async function upgradeCommand(options) {
  try {
    const cfg = getConfig();
    const up = cfg.upgrade || {};
    const repoUrl = options.repo || up.repoUrl;
    const branch = options.branch || up.branch || 'main';
    const remote = up.remote || 'ring-upstream';
    const apply = !!options.apply;
    const dryRun = !apply; // default is preview-only

    if (!repoUrl) {
      logger.error('No upstream repo configured. Set it with: ring config --set upgrade.repoUrl=<git-url>');
      process.exit(1);
    }

    // Guard: must be a git repo
    if (!existsSync(join(GIT_ROOT, '.git'))) {
      logger.error(`Not a git repository: ${GIT_ROOT}`);
      logger.info('`ring upgrade` syncs upstream system files via git. Initialize git first.');
      process.exit(1);
    }

    const git = (args, opts = {}) =>
      execFileSync('git', args, { cwd: GIT_ROOT, encoding: 'utf8', ...opts });

    logger.info(`⬆️  Ring upgrade — upstream: ${repoUrl} (${branch})`);

    // Warn on a dirty tree (3-way apply mixes badly with unrelated local edits)
    const dirty = git(['status', '--porcelain']).trim();
    if (dirty && apply) {
      logger.warn('⚠️  Working tree has uncommitted changes. Commit or stash before --apply to keep the upgrade reviewable.');
      if (!options.force) {
        logger.info('Re-run with --force to proceed anyway, or commit/stash first.');
        process.exit(1);
      }
    }

    // 1) Ensure upstream remote + fetch
    const remotes = git(['remote']).split('\n').map(s => s.trim());
    if (!remotes.includes(remote)) {
      logger.info(`🔗 Adding remote ${remote} → ${repoUrl}`);
      git(['remote', 'add', remote, repoUrl]);
    } else {
      git(['remote', 'set-url', remote, repoUrl]);
    }
    logger.info(`📡 Fetching ${remote}/${branch} …`);
    git(['fetch', '--quiet', remote, branch]);
    const theirs = git(['rev-parse', `${remote}/${branch}`]).trim();

    // 2) Resolve the 3-way base
    let base = up.lastSyncedRef && up.lastSyncedRef.trim();
    if (base) {
      try { git(['cat-file', '-e', `${base}^{commit}`]); }
      catch { logger.warn(`Configured lastSyncedRef ${base} not found; falling back to merge-base.`); base = ''; }
    }
    if (!base) {
      try { base = git(['merge-base', 'HEAD', theirs]).trim(); logger.info(`Using merge-base as sync base: ${base.slice(0, 12)}`); }
      catch { base = ''; }
    }
    if (theirs === base) {
      logger.success('✅ Already up to date with upstream.');
      return;
    }

    // 3) Build exclude pathspecs from .reggie-propagate-exclude.json
    const excludes = loadExcludes();
    const pathspecs = excludes.map(p => `:(exclude)${p}`);

    // 4) Compute the changed file set base..theirs (minus excludes)
    const baseRange = base ? `${base}..${theirs}` : theirs;
    const changed = git(['diff', '--name-status', baseRange, '--', '.', ...pathspecs])
      .split('\n').map(s => s.trim()).filter(Boolean);

    if (!changed.length) {
      logger.success('✅ No upstream system-file changes apply to this clone.');
      maybeRecord({ apply, dryRun, base, theirs, repoUrl, branch, files: [], conflicts: [] });
      return;
    }

    logger.info(`📦 ${changed.length} upstream change(s) since last sync${excludes.length ? ` (${excludes.length} clone-protected pathspecs skipped)` : ''}:`);
    for (const line of changed.slice(0, 60)) console.log('   ' + line);
    if (changed.length > 60) console.log(`   … and ${changed.length - 60} more`);

    if (dryRun) {
      logger.info('🔍 Dry run (default). Re-run with --apply to perform the 3-way merge.');
      logger.info('Tip: protect clone-specific files in .reggie-propagate-exclude.json before applying.');
      return;
    }

    // 5) Apply as a 3-way merge, leaving conflicts as standard git markers
    logger.info('🩹 Applying upstream changes (3-way merge) …');
    const patch = git(['diff', '--binary', baseRange, '--', '.', ...pathspecs]);
    const tmpPatch = join(GIT_ROOT, '.ring-upgrade.patch');
    writeFileSync(tmpPatch, patch);

    let conflicts = [];
    try {
      git(['apply', '--3way', '--whitespace=nowarn', tmpPatch], { stdio: 'pipe' });
      logger.success('✅ Upstream changes applied cleanly.');
    } catch (e) {
      // --3way leaves conflict markers and reports failed files on stderr
      const out = (e.stderr || e.stdout || '').toString();
      conflicts = [...out.matchAll(/(?:U\s+|conflicts in\s+|error: patch failed:\s+)(\S+)/g)].map(m => m[1]);
      logger.warn('⚠️  Some hunks need manual resolution (left as conflict markers / .orig files).');
      if (out.trim()) console.log(out.trim());
      logger.info('Resolve with: git status, then edit conflicted files. Review before committing.');
    } finally {
      try { execSync(`rm -f "${tmpPatch}"`); } catch { /* noop */ }
    }

    // 6) Record sync ref + history (only on apply)
    setConfig('upgrade.lastSyncedRef', theirs);
    maybeRecord({ apply: true, dryRun: false, base, theirs, repoUrl, branch, files: changed, conflicts });

    logger.success(`✅ Upgrade staged. New sync ref: ${theirs.slice(0, 12)}`);
    logger.info('Next: review `git diff`, run the build, then commit. Deploy with `ring prod`.');
  } catch (error) {
    logger.error('Upgrade failed:', error.message);
    process.exit(1);
  }
}

function loadExcludes() {
  if (!existsSync(EXCLUDE_FILE)) return [];
  try {
    const cfg = JSON.parse(readFileSync(EXCLUDE_FILE, 'utf8'));
    const files = cfg.customized_files || [];
    const dirs = (cfg.customized_directories || []).map(d => (d.endsWith('/') ? d + '**' : d));
    return [...files, ...dirs];
  } catch (e) {
    logger.warn('Could not parse .reggie-propagate-exclude.json; proceeding without clone exclusions.');
    return [];
  }
}

function maybeRecord({ apply, dryRun, base, theirs, repoUrl, branch, files, conflicts }) {
  if (!apply || dryRun) return;
  let history = { entries: [] };
  if (existsSync(HISTORY_FILE)) {
    try { history = JSON.parse(readFileSync(HISTORY_FILE, 'utf8')); } catch { history = { entries: [] }; }
  }
  history.entries = history.entries || [];
  history.entries.push({
    timestamp: new Date().toISOString(),
    tool: 'ring upgrade',
    repoUrl,
    branch,
    base_ref: base || null,
    synced_ref: theirs,
    files_changed: files.length,
    files,
    conflicts,
  });
  history.last_synced_ref = theirs;
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2) + '\n');
  logger.info(`📝 Recorded to ${HISTORY_FILE.replace(GIT_ROOT + '/', '')}`);
}
