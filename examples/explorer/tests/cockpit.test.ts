/**
 * Developer & Agent Cockpit Mini-App Unit & Integration Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { SuperAppExplorer } from '../dist/index.js';

test('SuperAppExplorer launches Developer Cockpit Mini-App in isolated Fiber', async () => {
  const explorer = new SuperAppExplorer();

  const route = await explorer.navigate('lynxfita://miniapp/developer-cockpit', 'Developer Cockpit');
  assert.equal(route.host, 'miniapp');
  assert.equal(explorer.containerManager.getActiveCount(), 1);

  const store = explorer.getCockpitStore();
  assert.ok(store, 'CockpitStore must be accessible on SuperAppExplorer');
  assert.equal(store.getState().activeTab, 'overview');

  // Verify HTML renders multi-repo cards
  const html = await explorer.renderHtmlPage();
  assert.ok(html.includes('Developer &amp; Agent Cockpit') || html.includes('Developer & Agent Cockpit'));
  assert.ok(html.includes('lynxfita-visualizer-3d'));
  assert.ok(html.includes('insights'));
});

test('CockpitStore handles remote federation reconciliation and deterministic rollback', async () => {
  const explorer = new SuperAppExplorer();
  await explorer.navigate('lynxfita://miniapp/developer-cockpit', 'Developer Cockpit');
  const store = explorer.getCockpitStore();
  assert.ok(store);

  // 1. Reconcile valid remote bundle
  await store.reconcileRemoteBundle(false);
  const stateVerified = store.getState();
  assert.equal(stateVerified.remoteFederation.status, 'verified');
  assert.equal(stateVerified.remoteFederation.activeSource, 'remote-federated');
  assert.equal(stateVerified.remoteFederation.lastReconciledVersion, '2.3.0-remote');
  assert.equal(stateVerified.remoteFederation.signatureValid, true);

  // 2. Simulate tampered bundle -> Trigger deterministic rollback to embedded baseline
  await store.reconcileRemoteBundle(true);
  const stateRollback = store.getState();
  assert.equal(stateRollback.remoteFederation.status, 'rollback');
  assert.equal(stateRollback.remoteFederation.activeSource, 'embedded-baseline');
  assert.equal(stateRollback.remoteFederation.lastReconciledVersion, '1.0.0-embedded');
  assert.equal(stateRollback.remoteFederation.signatureValid, false);
});

test('CockpitStore compiles source code to Hermes HBC bytecode', async () => {
  const explorer = new SuperAppExplorer();
  await explorer.navigate('lynxfita://miniapp/developer-cockpit', 'Developer Cockpit');
  const store = explorer.getCockpitStore();
  assert.ok(store);

  store.compileSnippet('function testKernel() { return 123.456; }');
  const state = store.getState();
  assert.ok(state.compiler.lastBytecodeSize > 0, 'Bytecode size must be non-zero');
  assert.ok(state.compiler.isHermesBytecode, 'Compiled output must have valid Hermes HBC magic');
  assert.ok(state.compiler.lastSha256.length === 64, 'Must produce valid 64-char SHA-256 hash');
});

test('CockpitStore manages A2UI dynamic agent surface and user action routing', async () => {
  const explorer = new SuperAppExplorer();
  await explorer.navigate('lynxfita://miniapp/developer-cockpit', 'Developer Cockpit');
  const store = explorer.getCockpitStore();
  assert.ok(store);

  store.setTab('genui');
  const html = await explorer.renderHtmlPage();
  assert.ok(html.includes('A2UI Agent-to-UI Dynamic Surface'));
  assert.ok(html.includes('Agent Dynamic Vitals'));
  assert.ok(html.includes('Stationary SIMD telemetry slot'));

  // Test action dispatch
  let actionFired = false;
  store.getRenderer().onAction((action) => {
    if (action.action === 'TRIGGER_AOT_BUILD') {
      actionFired = true;
    }
  });

  await store.getRenderer().dispatchAction('btn-compile', 'onPress');
  assert.ok(actionFired, 'A2UI user action must be received by listener');

  // Test state machine synchronization
  store.setTab('statemachine');
  const initialRound = store.getState().stateMachine.consensusRound;
  store.syncStateMachine();
  const nextRound = store.getState().stateMachine.consensusRound;
  assert.equal(nextRound, initialRound + 1);
  assert.ok(store.getState().stateMachine.lastRoll >= 3 && store.getState().stateMachine.lastRoll <= 18);

  const smHtml = await explorer.renderHtmlPage();
  assert.ok(smHtml.includes(`Round ${nextRound}`));
});
