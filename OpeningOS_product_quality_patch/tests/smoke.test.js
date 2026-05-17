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

// Syntax check the shipped browser JavaScript.
for (const dir of [jsDir, vendorDir]) {
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
    childProcess.execFileSync(process.execPath, ['--check', path.join(dir, file)], { stdio: 'pipe' });
  }
}

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(jsDir, 'app.js'), 'utf8');
const api = fs.readFileSync(path.join(jsDir, 'api.js'), 'utf8');
const saas = fs.readFileSync(path.join(jsDir, 'saas_client.js'), 'utf8');
const enterprise = fs.readFileSync(path.join(jsDir, 'enterprise_api.js'), 'utf8');
const views = fs.readFileSync(path.join(jsDir, 'views.js'), 'utf8');
const serverTs = fs.readFileSync(path.join(root, 'server', 'src', 'server.ts'), 'utf8');

assert(index.includes('vendor/chess.min.js'), 'index.html must load bundled chess.js');
assert(index.includes('js/saas_client.js') && index.includes('js/enterprise_api.js'), 'SaaS clients must be loaded');
assert(index.includes('https://monkfish-app-yxidj.ondigitalocean.app'), 'CSP must allow deployed DigitalOcean backend');
assert(!fs.existsSync(path.join(root, 'Dockerfile')), 'Root Dockerfile must not exist; it makes DigitalOcean deploy the frontend Docker image for the API');
assert(fs.existsSync(path.join(root, 'Dockerfile.frontend')), 'Frontend Dockerfile should be renamed to Dockerfile.frontend');

for (const required of ['OOS_DEFAULT_BACKEND', 'showAccountGateway', 'Create account', 'Continue local-only', 'maybeShowAccountNudge']) {
  assert(app.includes(required), `Account-first app flow missing: ${required}`);
}
for (const required of ['DEFAULT_BACKEND_URL', 'backendImportGames', '/imports/jobs', 'lichessUserGames', 'chesscomUserGames']) {
  assert(api.includes(required), `Importer/backend fallback missing: ${required}`);
}
assert((saas.includes('DEFAULT_BACKEND_URL') || saas.includes('DEFAULT_BACKEND')) && fs.readFileSync(path.join(jsDir, 'deployment_config.js'), 'utf8').includes('monkfish-app-yxidj'), 'SaaS client should default to deployed backend through deployment_config.js');
assert(enterprise.includes('OOSDeployment') && fs.readFileSync(path.join(jsDir, 'deployment_config.js'), 'utf8').includes('monkfish-app-yxidj'), 'Enterprise API client should default to deployed backend through deployment_config.js');
assert(views.includes('backend securely fetches'), 'Import wizard should explain backend fallback');
for (const required of ['/auth/signup', '/auth/login', '/imports/jobs', '/imports/fetch-games', 'fetchRemoteGames', 'fetchChesscomGames', 'fetchLichessGames', '/sync/snapshot', '/graph/snapshot']) {
  assert(serverTs.includes(required), `Backend route/import feature missing: ${required}`);
}
for (const required of ['Product hardening pass', '.rep-layout', '.editor-grid', '.account-gateway', '.cloud-account-banner']) {
  assert(styles.includes(required), `Product UI hardening CSS missing: ${required}`);
}

assert(fs.existsSync(path.join(root, '.github', 'workflows', 'ci.yml')), 'CI workflow missing');
assert(fs.existsSync(path.join(root, '.github', 'workflows', 'deploy-pages.yml')), 'Pages workflow missing');
assert(fs.existsSync(path.join(root, '.github', 'workflows', 'deploy-backend-do.yml')), 'DigitalOcean backend workflow missing');
assert(!fs.existsSync(path.join(root, '.github', 'workflows', 'pages.yml')), 'Duplicate pages.yml workflow should be removed');
assert(fs.existsSync(path.join(root, '.do', 'app.yaml')), 'DigitalOcean app spec missing');
const doSpec = fs.readFileSync(path.join(root, '.do', 'app.yaml'), 'utf8');
for (const required of ['source_dir: server', 'build_command: npm install && npm run build', 'run_command: npm run start', 'http_port: 8787']) {
  assert(doSpec.includes(required), `DigitalOcean app spec missing: ${required}`);
}

assert(fs.existsSync(path.join(root, 'server', 'migrations', '003_fix_safe_rls.sql')), 'Safe RLS migration fix missing');
assert(fs.existsSync(path.join(root, 'PRODUCT_FIX_REPORT_2026_05_17.md')), 'Product fix report missing');

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
