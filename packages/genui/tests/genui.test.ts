/**
 * LynxFita GenUI & A2UI v0.9 Specification Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { LynxFitaContext } from '@lynxfita/core';
import {
  A2UiSurfaceRenderer,
  LynxFitaCockpitCatalog,
  GenUiService,
  type A2UiMessage,
  type A2UiUserAction,
} from '../dist/index.js';

test('A2UI surface renderer consumes createSurface, updateDataModel, and updateComponents', async () => {
  const renderer = new A2UiSurfaceRenderer('cockpit-main', LynxFitaCockpitCatalog);

  const messages: A2UiMessage[] = [
    {
      version: 'v0.9',
      type: 'createSurface',
      surfaceId: 'cockpit-main',
      catalogId: LynxFitaCockpitCatalog.catalogId,
    },
    {
      version: 'v0.9',
      type: 'updateDataModel',
      surfaceId: 'cockpit-main',
      data: {
        telemetry: {
          bandwidth: '42.5 GB/s',
          latency: '0.36 μs',
          activeFibers: 3,
        },
      },
    },
    {
      version: 'v0.9',
      type: 'updateComponents',
      surfaceId: 'cockpit-main',
      components: [
        {
          id: 'root',
          type: 'Container',
          props: { direction: 'column', gap: 12 },
          children: ['telemetry-card', 'action-btn'],
        },
        {
          id: 'telemetry-card',
          type: 'Card',
          props: { title: 'Unified Data Plane Telemetry', subtitle: 'Stationary DMA & SIMD Metrics' },
          children: ['metric-bandwidth', 'metric-latency'],
        },
        {
          id: 'metric-bandwidth',
          type: 'Metric',
          props: { label: 'Peak Bandwidth', value: '0' },
          bindings: { value: 'telemetry.bandwidth' },
        },
        {
          id: 'metric-latency',
          type: 'Metric',
          props: { label: 'In-Place SIMD Latency', value: '0', unit: 'μs' },
          bindings: { value: 'telemetry.latency' },
        },
        {
          id: 'action-btn',
          type: 'Button',
          props: { label: 'Trigger AOT Compilation', variant: 'primary' },
          actions: {
            onPress: { action: 'COMPILE_AOT_BUNDLE', payload: { target: 'weather' } },
          },
        },
      ],
    },
  ];

  for (const msg of messages) {
    renderer.applyMessage(msg);
  }

  // Verify resolved tree with reactive bindings
  const tree = renderer.resolveTree();
  assert.ok(tree);
  assert.equal(tree.type, 'Container');
  assert.equal(tree.children.length, 2);

  const cardNode = tree.children[0];
  assert.equal(cardNode.type, 'Card');
  assert.equal(cardNode.props.title, 'Unified Data Plane Telemetry');

  // Verify binding resolved
  const bandwidthNode = cardNode.children[0];
  assert.equal(bandwidthNode.props.value, '42.5 GB/s');

  const latencyNode = cardNode.children[1];
  assert.equal(latencyNode.props.value, '0.36 μs');

  // Verify HTML rendering contains resolved values
  const html = renderer.renderHtml();
  assert.ok(html.includes('Unified Data Plane Telemetry'));
  assert.ok(html.includes('42.5 GB/s'));
  assert.ok(html.includes('0.36 μs'));
  assert.ok(html.includes('Trigger AOT Compilation'));
});

test('A2UI surface renderer rejects components not authorized in catalog', () => {
  const renderer = new A2UiSurfaceRenderer('unauthorized-test', LynxFitaCockpitCatalog);

  assert.throws(
    () => {
      renderer.applyMessage({
        version: 'v0.9',
        type: 'updateComponents',
        surfaceId: 'unauthorized-test',
        components: [
          {
            id: 'root',
            type: 'ArbitraryMaliciousScriptExecution', // Not in catalog
            props: { script: 'eval("rm -rf")' },
          },
        ],
      });
    },
    /not defined in active A2UI Catalog/
  );
});

test('A2UI surface renderer dispatches user actions back to handler', async () => {
  const renderer = new A2UiSurfaceRenderer('actions-test', LynxFitaCockpitCatalog);

  renderer.applyMessage({
    version: 'v0.9',
    type: 'createSurface',
    surfaceId: 'actions-test',
    catalogId: LynxFitaCockpitCatalog.catalogId,
  });

  renderer.applyMessage({
    version: 'v0.9',
    type: 'updateComponents',
    surfaceId: 'actions-test',
    components: [
      {
        id: 'btn-reconcile',
        type: 'Button',
        props: { label: 'Reconcile Remote OTA Bundle' },
        actions: {
          onPress: { action: 'RECONCILE_OTA', payload: { version: '2.3.0' } },
        },
      },
    ],
  });

  const capturedActions: A2UiUserAction[] = [];
  renderer.onAction((action) => {
    capturedActions.push(action);
  });

  await renderer.dispatchAction('btn-reconcile', 'onPress', { triggeredBy: 'user' });

  assert.equal(capturedActions.length, 1);
  assert.equal(capturedActions[0].action, 'RECONCILE_OTA');
  assert.equal(capturedActions[0].payload?.version, '2.3.0');
  assert.equal(capturedActions[0].payload?.triggeredBy, 'user');
});

test('GenUiService integrates with Cordis context and event bus', async () => {
  const ctx = new LynxFitaContext();
  const genUi = new GenUiService(ctx);

  const capturedEvents: unknown[] = [];
  ctx.on('genui:action', (evt) => {
    capturedEvents.push(evt);
  });

  genUi.applyMessages([
    {
      version: 'v0.9',
      type: 'createSurface',
      surfaceId: 'cordis-surface',
      catalogId: LynxFitaCockpitCatalog.catalogId,
    },
    {
      version: 'v0.9',
      type: 'updateComponents',
      surfaceId: 'cordis-surface',
      components: [
        {
          id: 'root',
          type: 'StatusBadge',
          props: { text: 'Stationary DMA Active', variant: 'success' },
        },
      ],
    },
  ]);

  const html = genUi.renderSurfaceHtml('cordis-surface');
  assert.ok(html.includes('Stationary DMA Active'));
});
