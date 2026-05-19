const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = path.resolve(__dirname, '..');
const jsDir = path.join(root, 'js');
const vendorDir = path.join(root, 'vendor');

for (const dir of [jsDir, vendorDir]) {
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
    childProcess.execFileSync(process.execPath, ['--check', path.join(dir, file)], { stdio: 'pipe' });
  }
}

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const worldCore = fs.readFileSync(path.join(jsDir, 'world_class_product_core.js'), 'utf8');
const productAuth = fs.readFileSync(path.join(jsDir, 'product_auth.js'), 'utf8');
const api = fs.readFileSync(path.join(jsDir, 'api.js'), 'utf8');
const views = fs.readFileSync(path.join(jsDir, 'views.js'), 'utf8');
const serverTs = fs.readFileSync(path.join(root, 'server', 'src', 'server.ts'), 'utf8');
const importersTs = fs.readFileSync(path.join(root, 'server', 'src', 'importers.ts'), 'utf8');
const emailTs = fs.readFileSync(path.join(root, 'server', 'src', 'email.ts'), 'utf8');

// Core app load order and production assets.
for (const required of ['vendor/chess.min.js', 'js/product_auth.js', 'js/player_experience_audit.js', 'js/world_class_product_core.js', 'js/app.js']) {
  assert(index.includes(required), `index.html must load ${required}`);
}
assert(index.indexOf('js/world_class_product_core.js') > index.indexOf('js/app.js'), 'World-class core should load after app.js so it can enhance rendered pages');
assert(sw.includes('oos-v25-repertoire-workspace-tree-folders'), 'Service worker cache version must be bumped for the world-class core release');
assert(sw.includes('./js/world_class_product_core.js'), 'Service worker must cache the world-class product core');
assert(!fs.existsSync(path.join(root, 'Dockerfile')), 'Root Dockerfile must not exist; it can make DigitalOcean deploy the wrong component');
assert(fs.existsSync(path.join(root, 'Dockerfile.frontend')), 'Frontend Dockerfile should remain renamed as Dockerfile.frontend');

// Product-language and UX consolidation.
for (const required of ['OpeningOS — world-class product core', 'ensureShell', 'wc-sidebar', 'wc-topbar', 'enhanceToday', 'enhanceRepertoire', 'showProductImportWizard', 'practiceRepairSet', 'sanitizeLanguage', 'openKeyboardHelp']) {
  assert(worldCore.includes(required), `World-class core missing ${required}`);
}
for (const required of ['.wc-sidebar', '.wc-topbar', '.wc-command-center', '.wc-enhanced-repertoire', '.wc-position-dock', '.wc-import-cockpit', '.wc-repair-inbox', '.wc-trust-panel']) {
  assert(styles.includes(required), `World-class CSS missing ${required}`);
}
assert(!worldCore.includes('JWT'), 'User-facing world-class core should not expose JWT language');
assert(!worldCore.includes("if ($('#wcSidebar')) { updateActiveNav(); updateSyncTrust(); return; }"), 'World-class shell must not recursively call updateSyncTrust from ensureShell');

// Account/product auth should stay user-facing and hide connection details behind advanced controls.
for (const required of ['Create account', 'Sign in', 'Continue offline', 'Connection settings', 'friendlyError', 'Use at least 10 characters']) {
  assert(productAuth.includes(required), `Product auth missing ${required}`);
}
assert(!productAuth.includes('Backend API'), 'Product auth should not show Backend API as user-facing copy');

// Import and review must use cloud first but still support graceful fallback.
for (const required of ['backendImportGames', '/imports/jobs', 'lichessUserGames', 'chesscomUserGames', 'Trying direct browser import']) {
  assert(api.includes(required), `Import API missing ${required}`);
}
for (const required of ['Fetching games', 'Parsing games', 'Matching repertoire', 'Finding repair moments', 'duplicates skipped']) {
  assert(worldCore.includes(required), `Import cockpit missing ${required}`);
}
for (const required of ['normalizeChesscomGame', 'normalizeLichessGame', 'pgnInJson=true', 'summary', 'rate-limiting']) {
  assert(importersTs.includes(required), `Backend import normalization missing ${required}`);
}

// Repertoire editor and game repair capabilities.
for (const required of ['insertMoveAt', 'removeMoveAt', 'addSideVariation', 'addOpponentReplyFromPosition', 'splitLineFromPly', 'setLineRetired', 'markPositionCritical', 'setIdeaCard']) {
  assert(fs.readFileSync(path.join(jsDir, 'data.js'), 'utf8').includes(required), `Data model/editor missing ${required}`);
}
for (const required of ['Position tools', 'Insert here', 'Add reply branch', 'Create side variation', 'Split from here', 'Retire line', 'Edit idea card fields']) {
  assert(views.includes(required), `Repertoire workspace missing ${required}`);
}


// Repertoire UI must stay board-first, folder-aware, and notes-safe.
const dataJs = fs.readFileSync(path.join(jsDir, 'data.js'), 'utf8');
for (const required of ['addFolder', 'updateFolder', 'deleteFolder', 'moveLineToFolder', 'userFolders']) {
  assert(dataJs.includes(required), `Folder management missing ${required}`);
}
for (const required of ['buildVariationMap', 'rep-flow-map', 'Add branch here', 'Move line', 'notesDock', 'makeNotesPanelDraggable']) {
  assert(views.includes(required), `Repertoire premium workspace missing ${required}`);
}
for (const required of ['oos-v25-repertoire-workspace-tree-folders', 'rep-flow-map', 'notes-dock-floating', '--oos-rep-board-size', 'bs-close']) {
  assert(styles.includes(required) || sw.includes(required), `Workspace polish missing ${required}`);
}
const appJs = fs.readFileSync(path.join(jsDir, 'app.js'), 'utf8');
assert(appJs.includes('bs-close'), 'Mobile quick-actions sheet needs a visible close button');

// Backend should expose production route surfaces and real email adapter.
for (const required of ['/health/db', '/auth/signup', '/auth/login', '/imports/jobs', '/imports/fetch-games', '/sync/snapshot', '/graph/snapshot', '/shares', '/coach/invitations']) {
  assert(serverTs.includes(required), `Backend route missing ${required}`);
}
assert(emailTs.includes('nodemailer.createTransport'), 'Email adapter should send through SMTP when configured');
assert(serverTs.includes('IMPORT_RATE_LIMIT_MAX'), 'Import endpoints should be rate limited');

// Repository/deployment hygiene.
for (const f of ['.gitattributes', '.github/workflows/ci.yml', '.github/workflows/e2e.yml', '.github/workflows/deploy-pages.yml', '.github/workflows/deploy-backend-do.yml', '.do/app.yaml']) {
  assert(fs.existsSync(path.join(root, f)), `${f} missing`);
}
const ciWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const e2eWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'e2e.yml'), 'utf8');
const pwConfig = fs.readFileSync(path.join(root, 'playwright.config.ts'), 'utf8');
assert(!ciWorkflow.includes('Playwright E2E product flows'), 'Push CI should remain fast; full E2E belongs in manual/PR workflow');
assert(e2eWorkflow.includes('workflow_dispatch') && e2eWorkflow.includes('pull_request'), 'E2E workflow should be manual and PR-based');
assert(e2eWorkflow.includes('playwright install chromium'), 'E2E workflow should install Chromium only by default');
assert(pwConfig.includes("process.env.CI\n    ? [{ name: 'chromium-desktop'"), 'Playwright CI should run Chromium-only by default');
const doSpec = fs.readFileSync(path.join(root, '.do', 'app.yaml'), 'utf8');
for (const required of ['source_dir: server', 'build_command: npm install && npm run build', 'run_command: npm run start', 'http_port: 8787', 'PGSSLMODE', 'DATABASE_SSL_REJECT_UNAUTHORIZED']) {
  assert(doSpec.includes(required), `DigitalOcean app spec missing ${required}`);
}

// Runtime smoke: local repertoire + practice still works.
function createStorage() {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] || null; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(String(k)); },
    clear() { map.clear(); },
  };
}
const context = { console, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval, localStorage: createStorage() };
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const rel of ['vendor/chess.min.js', 'js/profile.js', 'js/pgn.js', 'js/fsrs.js', 'js/analysis_engine.js', 'js/engine_integration.js', 'js/data.js', 'js/graph_native.js', 'js/advanced_review.js', 'js/practice.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), context, { filename: rel });
}
context.OOSProfiles.init();
context.OOSProfiles.create({ name: 'Smoke Tester' });
context.OOSData.init();
const line = context.OOSData.addUserLine({ name: 'Smoke Caro-Kann', eco: 'B12', opening: 'Caro-Kann', color: 'b', tag: 'must-know', repId: 'rep-b-e4', moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5'] });
assert(line && line.id, 'addUserLine should return a line');
const cards = context.OOSData.positionsForLine(line.id);
assert(cards.length === 3, 'Black line should create three trainable cards');
const session = new context.OOSPractice.PracticeSession(cards, { shuffle: false, max: 10 });
assert(session.evaluate('c6').kind === 'correct', 'Practice should accept repertoire move');
context.OOSData.addAlternateToCard(cards[0].id, 'e6', '');
assert(session.evaluate('e6').kind === 'correct-alt', 'Practice should accept persisted alternate');
console.log('OpeningOS product smoke checks passed');
