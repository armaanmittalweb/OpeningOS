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

// 1) Syntax checks for every shipped JS file.
for (const dir of [jsDir, vendorDir]) {
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
    childProcess.execFileSync(process.execPath, ['--check', path.join(dir, file)], { stdio: 'pipe' });
  }
}

// 2) Static product-hardening and responsive UI checks.
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(index.includes('vendor/chess.min.js'), 'index.html must load the bundled chess engine');
assert(!index.includes('cdnjs.cloudflare.com/ajax/libs/chess.js'), 'critical chess logic must not rely on the CDN');
assert(index.includes('Content-Security-Policy'), 'index.html should include the shipped CSP meta tag');
assert(fs.existsSync(path.join(root, 'vendor', 'chess.min.js')), 'vendor/chess.min.js is missing');
assert(index.includes('js/product.js') && index.includes('js/product_plus.js') && index.includes('js/product_release.js') && index.includes('js/production_ready.js') && index.includes('js/cloud_sync.js') && index.includes('js/saas_client.js') && index.includes('js/graph_native.js') && index.includes('js/advanced_review.js') && index.includes('js/engine_integration.js') && index.includes('js/launch.js') && index.includes('js/ui_polish.js') && index.includes('js/fsrs.js') && index.includes('js/idb_store.js') && index.includes('js/accessibility.js') && index.includes('js/observability.js') && index.includes('js/graph_native.js') && index.includes('js/saas_client.js') && index.includes('js/stockfish_client.js'), 'product completion, SaaS, graph, engine, cloud, production, launch, and UI polish layers must be loaded');
assert(index.includes('mobile-tabbar'), 'mobile bottom tabbar must be present');

const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
assert(styles.includes('Final responsive polish layer'), 'final responsive polish CSS layer is missing');
assert(!/var\(--border|var\(--panel/.test(styles), 'styles.css contains stale undefined design tokens');
assert(styles.includes('--mobile-nav-h') && styles.includes('position: fixed') && styles.includes('safe-area-inset-bottom'), 'mobile navigation/responsive safe-area polish is missing');
assert(styles.includes(':focus-visible'), 'keyboard focus-visible styles are required');
assert(styles.includes('.mobile-tabbar') && styles.includes('display: grid'), 'mobile tabbar CSS is missing');
const definedVars = new Set([...styles.matchAll(/--([A-Za-z0-9_-]+)\s*:/g)].map(m => m[1]));
const usedVars = new Set([...styles.matchAll(/var\(--([A-Za-z0-9_-]+)/g)].map(m => m[1]));
const missingVars = [...usedVars].filter(v => !definedVars.has(v));
assert(missingVars.length === 0, 'Undefined CSS custom properties: ' + missingVars.join(', '));

const uxPolish = fs.readFileSync(path.join(jsDir, 'ui_polish.js'), 'utf8');
for (const required of ['featureChecks', 'runUXChecklist', 'appendAssurancePanel', 'enhanceInteractive']) {
  assert(uxPolish.includes(required), `UX polish layer missing: ${required}`);
}

const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
for (const asset of ['./vendor/chess.min.js', './js/idb_store.js', './js/fsrs.js', './js/analysis_engine.js', './js/graph_native.js', './js/saas_client.js', './js/stockfish_client.js', './js/product.js', './js/product_plus.js', './js/product_release.js', './js/production_ready.js', './js/cloud_sync.js', './js/launch.js', './js/ui_polish.js', './js/accessibility.js', './js/observability.js']) {
  assert(serviceWorker.includes(asset), `service worker must cache ${asset}`);
}


assert(fs.existsSync(path.join(root, '.github', 'workflows', 'ci.yml')), 'CI workflow is missing');
const pagesWorkflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'pages.yml'), 'utf8');
assert(pagesWorkflow.includes('push:') && pagesWorkflow.includes('deploy-pages'), 'GitHub Pages workflow should deploy automatically on push');
assert(fs.existsSync(path.join(root, '.nojekyll')), '.nojekyll is required for predictable GitHub Pages static hosting');
assert(fs.existsSync(path.join(root, 'DEPLOYMENT_GITHUB_STUDENT.md')), 'GitHub student deployment guide is missing');
assert(fs.existsSync(path.join(root, 'APPWRITE_SETUP.md')), 'Optional Appwrite setup guide is missing');
assert(fs.existsSync(path.join(root, 'SECURITY.md')), 'Security policy is missing');
assert(fs.existsSync(path.join(root, 'PRIVACY.md')), 'Privacy notice is missing');
assert(fs.existsSync(path.join(root, 'UI_QUALITY_CHECKLIST.md')), 'UI quality checklist is missing');
assert(fs.existsSync(path.join(root, 'tsconfig.json')), 'TypeScript scaffold is missing');
assert(fs.existsSync(path.join(root, 'playwright.config.ts')), 'Playwright E2E scaffold is missing');
assert(fs.existsSync(path.join(root, 'server', 'migrations', '001_init.sql')), 'Backend database migration is missing');
assert(fs.existsSync(path.join(root, 'server', 'migrations', '002_saas_complete.sql')), 'SaaS database migration is missing');
assert(fs.existsSync(path.join(root, 'server', 'src', 'server.ts')), 'Backend API scaffold is missing');
for (const file of ['server/migrations/002_production_saas.sql','server/src/services/engine.ts','server/src/services/importers.ts','server/src/services/session.ts','server/src/services/permissions.ts','server/src/services/billing.ts','js/saas_client.js','js/graph_native.js','js/stockfish_client.js','FULL_PRODUCT_IMPLEMENTATION.md','BACKEND_PRODUCTION_DEPLOYMENT.md','PRODUCT_COMPLETION_MATRIX.md','docker-compose.yml']) assert(fs.existsSync(path.join(root, file)), `Full-stack product file missing: ${file}`);

const views = fs.readFileSync(path.join(jsDir, 'views.js'), 'utf8');
for (const removed of [
  'Manual entry coming soon',
  'Lichess connection is on the roadmap',
  'Chess.com connection is on the roadmap',
  'Marked as alternate',
]) {
  assert(!views.includes(removed), `Prototype placeholder still present: ${removed}`);
}

const data = fs.readFileSync(path.join(jsDir, 'data.js'), 'utf8');
for (const required of [
  'exportSnapshot()',
  'importSnapshot(snapshot)',
  'addAlternateToCard(cardId, sanMove, fen)',
  'ignoreDeviation(gameId, dev)',
  'updateUserLine(id, patch)',
  'deleteUserLine(id)',
  'duplicateLine(id)',
  'exportCoachPack(studentId = null)',
  'importCoachPack(pack)',
  'insertMoveAt(lineId, index, san)',
  'removeMoveAt(lineId, ply)',
  'splitLineFromPly(lineId, ply',
  'addSideVariation(lineId, ply',
  'mergeLineWithTransposition(lineId, targetLineId',
  'markPositionCritical(cardId',
  'setIdeaCard(cardId, patch)',
  'graphSnapshot()',
  'deepReviewGame(game)',
  'auditTrail(limit = 100)',
  '_hydrateFromIndexedDB(key)',
]) {
  assert(data.includes(required), `Required data method missing: ${required}`);
}
assert(!data.includes('transpositionsFor(fen) { return []; }'), 'transposition lookup must not be stubbed');
for (const file of ['README.md', 'DEPLOYMENT.md', 'APPWRITE_SETUP.md', 'SECURITY.md', 'PRIVACY.md', 'LAUNCH_CHECKLIST.md', 'vercel.json', 'netlify.toml', '.github/workflows/deploy-pages.yml']) {
  assert(fs.existsSync(path.join(root, file)), `Deployment/product file missing: ${file}`);
}

const cloud = fs.readFileSync(path.join(jsDir, 'cloud_sync.js'), 'utf8');
for (const required of [
  'showSetupModal',
  'pushSnapshot',
  'pullSnapshot',
  'Settings → Cloud Sync'.replace('Settings → Cloud Sync','Cloud Sync'),
]) {
  assert(cloud.includes(required), `Cloud sync layer missing: ${required}`);
}

const saas = fs.readFileSync(path.join(jsDir, 'saas_client.js'), 'utf8');
for (const required of ['signup:', 'requestPasswordReset', 'passkeyRegisterOptions', 'createCoachInvite', 'createShare', 'checkout', 'adminOverview', 'graphPush']) {
  assert(saas.includes(required), `SaaS client missing: ${required}`);
}
const graphNative = fs.readFileSync(path.join(jsDir, 'graph_native.js'), 'utf8');
for (const required of ['graph-native source-of-truth', 'move_edges', 'line_paths', 'edgeIds', 'mergeGraphs', 'importGraphBundle']) {
  assert(graphNative.includes(required), `Graph-native module missing: ${required}`);
}
const advancedReview = fs.readFileSync(path.join(jsDir, 'advanced_review.js'), 'utf8');
for (const required of ['lineCandidates', 'confidence', 'rankedRepairs', 'prep-quality', 'matchGameToRepertoireGraph']) {
  assert(advancedReview.includes(required), `Advanced review module missing: ${required}`);
}
const engine = fs.readFileSync(path.join(jsDir, 'engine_integration.js'), 'utf8');
for (const required of ['Stockfish', 'analysis/quick', 'validateMove', 'legal', 'scoreDropCp']) {
  assert(engine.includes(required), `Engine integration missing: ${required}`);
}
const serverTs = fs.readFileSync(path.join(root, 'server', 'src', 'server.ts'), 'utf8');
for (const required of ['/auth/signup', '/auth/password-reset/request', '/auth/passkeys/register/options', '/sync/changes', '/graph/snapshot', '/coach/invitations/accept', '/shares/:token/clone', '/imports/jobs', '/analysis/quick', '/billing/checkout', '/admin/overview']) {
  assert(serverTs.includes(required), `Backend route missing: ${required}`);
}
const obs = fs.readFileSync(path.join(jsDir, 'observability.js'), 'utf8');
for (const required of ['window_error', 'unhandled_rejection', 'storage_quota_warning', 'OOSObservability']) {
  assert(obs.includes(required), `Observability layer missing: ${required}`);
}
const prod = fs.readFileSync(path.join(jsDir, 'production_ready.js'), 'utf8');
for (const required of ['healthReport', 'repairIntegrity', 'showDataSafetyCenter', 'exportPgnBundle']) {
  assert(prod.includes(required), `Production readiness layer missing: ${required}`);
}
const launch = fs.readFileSync(path.join(jsDir, 'launch.js'), 'utf8');
for (const required of [
  'openingos-share-pack-v1',
  'openingos-coach-pack-v1',
  'showReliabilityCenter',
  'exportFullBackup',
]) {
  assert(launch.includes(required), `Launch layer missing: ${required}`);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const script of ['test', 'lint', 'build', 'validate:deploy', 'test:e2e']) assert(pkg.scripts[script], `package script missing: ${script}`);
assert(fs.existsSync(path.join(root, 'src', 'domain', 'graph.ts')), 'Domain graph TypeScript model is missing');
assert(fs.existsSync(path.join(root, 'src', 'domain', 'fsrs.ts')), 'Domain FSRS TypeScript model is missing');
assert(fs.existsSync(path.join(root, 'src', 'domain', 'review.ts')), 'Domain review TypeScript model is missing');

// 3) Runtime smoke checks for the local-first product loop.
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
const context = {
  console,
  Date,
  Math,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  localStorage: createStorage(),
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const rel of ['vendor/chess.min.js', 'js/profile.js', 'js/pgn.js', 'js/fsrs.js', 'js/analysis_engine.js', 'js/engine_integration.js', 'js/data.js', 'js/graph_native.js', 'js/advanced_review.js', 'js/practice.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), context, { filename: rel });
}

context.OOSProfiles.init();
context.OOSProfiles.create({ name: 'Smoke Tester' });
context.OOSData.init();

const line = context.OOSData.addUserLine({
  name: 'Smoke Caro-Kann',
  eco: 'B12',
  opening: 'Caro-Kann',
  color: 'b',
  tag: 'must-know',
  repId: 'rep-b-e4',
  moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5'],
});
assert(line && line.id, 'addUserLine should return a saved line');
let cards = context.OOSData.positionsForLine(line.id);
assert(cards.length === 3, 'Black line should create three trainable black-move cards');

const session = new context.OOSPractice.PracticeSession(cards, { shuffle: false, max: 10 });
let evalResult = session.evaluate('c6');
assert(evalResult.kind === 'correct', 'Practice should accept the saved repertoire move');
context.OOSData.addAlternateToCard(cards[0].id, 'e6', '');
evalResult = session.evaluate('e6');
assert(evalResult.kind === 'correct-alt', 'Practice should accept persisted alternate moves');
context.OOSData.grade(cards[0].id, 3, { mode: 'smoke', result: 'correct' });
assert(context.OOSData.reviewEvents(5).length === 1, 'Grading should write a review event');

const game = context.OOSData.addUserGame({
  vs: 'Opponent',
  yourColor: 'b',
  pgn: '1. e4 c6 2. d4 d5 3. Nc3',
  lineId: line.id,
});
const devs = context.OOSData.deviationsForGame(game);
assert(devs.length >= 1, 'Game review should detect a deviation');
context.OOSData.ignoreDeviation(game.id, devs[0]);
assert(context.OOSData.isDeviationIgnored(game.id, devs[0].ply), 'Ignored deviation should persist');

const student = context.OOSData.addStudent({ name: 'Student One', rating: 1400 });
const assignment = context.OOSData.addAssignment({ studentId: student.id, lineId: line.id, mode: 'Daily', due: 'Sunday', message: 'Focus on ...c6.' });
const pack = context.OOSData.exportCoachPack(student.id);
assert(pack.schema === 'openingos-coach-pack-v1', 'Coach pack should use the v1 schema');
assert(pack.assignments.length === 1 && pack.lines.length === 1, 'Coach pack should include assignment and referenced line');
const imported = context.OOSData.importCoachPack(pack);
assert(imported.lines.length === 1, 'Coach pack import should add a line');
assert(imported.assignments.length === 1, 'Coach pack import should add an assignment');
assert(context.OOSData.activeAssignments().length >= 1, 'Active assignments should be queryable');



const insertRes = context.OOSData.insertMoveAt(line.id, 2, 'Nf3');
assert(insertRes.ok, 'insertMoveAt should insert a legal move and rebuild line graph');
const removeRes = context.OOSData.removeMoveAt(line.id, 3);
assert(removeRes.ok, 'removeMoveAt should remove an arbitrary move');
const branch = context.OOSData.addSideVariation(line.id, 2, ['Nf3']);
assert(branch && branch.parentLineId === line.id, 'Side variation should create a true branch line');
context.OOSData.markPositionCritical(cards[0].id, true, 'smoke');
assert(context.OOSData.positionFlag(cards[0].id).critical, 'Critical position flag should persist');
context.OOSData.setIdeaCard(cards[0].id, { idea: 'Smoke idea', plan: 'Smoke plan', hook: 'Smoke hook' });
assert(context.OOSData.ideaCardFor(cards[0].id).idea === 'Smoke idea', 'Idea card fields should persist');
const graph = context.OOSData.graphSnapshot();
assert(graph.positions && graph.move_edges && graph.line_paths, 'Graph snapshot should expose positions, move_edges, and line_paths');
const graphNativeRuntime = context.OOSData.graphNativeSnapshot();
assert(graphNativeRuntime.schema === 'openingos-graph-native-v2', 'Graph-native snapshot should expose v2 schema');
assert(Object.keys(graphNativeRuntime.move_edges).length >= 1, 'Graph-native snapshot should persist move edges');
const deep = context.OOSData.deepReviewGame(game);
assert(deep.matches && deep.moments !== undefined, 'Deep game review should return matches and moments');

const snapshot = context.OOSData.exportSnapshot();
assert(snapshot.schema === 'openingos-local-v4-graph', 'Backup snapshot should include the graph v4 schema');
context.OOSData.importSnapshot(snapshot);
assert(context.OOSData.line(line.id), 'Backup restore should keep the saved repertoire line');

console.log('OpeningOS smoke checks passed');
