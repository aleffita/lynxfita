/**
 * LynxFita A2UI Standard Catalog
 * Defines the vocabulary of authorized components and properties
 * that agents can assemble into dynamic cockpits and UI surfaces.
 */

import type { A2UiCatalog } from './types.js';

export const LYNXFITA_A2UI_CATALOG_ID = 'lynxfita.catalog.cockpit.v1';

export const LynxFitaCockpitCatalog: A2UiCatalog = {
  catalogId: LYNXFITA_A2UI_CATALOG_ID,
  version: '1.0.0',
  components: {
    Container: {
      type: 'Container',
      description: 'Flex container for grouping and aligning child components',
      properties: {
        direction: { type: 'string', enum: ['row', 'column'] },
        gap: { type: 'number' },
        padding: { type: 'number' },
      },
    },
    Card: {
      type: 'Card',
      description: 'Styled elevated container card with optional header and accent border',
      properties: {
        title: { type: 'string', required: true },
        subtitle: { type: 'string' },
        accentColor: { type: 'string' },
      },
    },
    Metric: {
      type: 'Metric',
      description: 'High-signal metric tile displaying key numerical telemetry or KPI',
      properties: {
        label: { type: 'string', required: true },
        value: { type: 'string', required: true },
        unit: { type: 'string' },
        trend: { type: 'string', enum: ['up', 'down', 'neutral'] },
        color: { type: 'string' },
      },
    },
    Button: {
      type: 'Button',
      description: 'Interactive button triggering an A2UI User Action back to the agent or host',
      properties: {
        label: { type: 'string', required: true },
        variant: { type: 'string', enum: ['primary', 'secondary', 'danger', 'ghost'] },
        disabled: { type: 'boolean' },
      },
      actions: ['onPress'],
    },
    StatusBadge: {
      type: 'StatusBadge',
      description: 'Compact badge displaying status states (idle, compiling, verified, error)',
      properties: {
        text: { type: 'string', required: true },
        variant: { type: 'string', enum: ['success', 'warning', 'error', 'info', 'neutral'] },
      },
    },
    MemorySlotView: {
      type: 'MemorySlotView',
      description: 'Real-time stationary DMA memory visualizer displaying slot range, hex, and bytes',
      properties: {
        offsetHex: { type: 'string', required: true },
        lengthBytes: { type: 'number', required: true },
        description: { type: 'string' },
      },
    },
    DagNode: {
      type: 'DagNode',
      description: 'Visual node in the Git state consensus graph displaying round, author, and virtual votes',
      properties: {
        nodeId: { type: 'string', required: true },
        round: { type: 'number', required: true },
        author: { type: 'string', required: true },
        isConsensus: { type: 'boolean' },
      },
    },
    CodeBlock: {
      type: 'CodeBlock',
      description: 'Preformatted code or manifest viewer',
      properties: {
        code: { type: 'string', required: true },
        language: { type: 'string' },
      },
    },
  },
};
