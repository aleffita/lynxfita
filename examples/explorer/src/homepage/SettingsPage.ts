/**
 * Super-App Settings & Federation Diagnostics Page
 * Configures mTLS identities, Certificate Revocation Lists (CRL),
 * and inspects active Cordis plugin registries.
 */

import type { ThemeManager } from '../lib/theme_context.js';
import type { LynxFitaContext } from '@lynxfita/core';

export interface SettingsViewState {
  activeRole: 'viewer' | 'top-patron' | 'canary';
  crlRevoked: boolean;
  activeFederationBundle: string;
}

export function renderSettingsPage(
  context: LynxFitaContext,
  themeManager: ThemeManager,
  state: SettingsViewState
): string {
  const theme = themeManager.getColors();
  const services = context.getServices();

  return `
<main style="padding: 1.5rem; max-width: 1000px; margin: 0 auto; color: ${theme.text};">
  <div style="margin-bottom: 2rem;">
    <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem 0;">Settings & Diagnostics</h2>
    <p style="font-size: 0.9rem; color: ${theme.textMuted}; margin: 0;">
      Ed25519 Release Integrity, Module Federation Channels, and Cordis Service Registry.
    </p>
  </div>

  <div style="display: flex; flex-direction: column; gap: 1.5rem;">
    <!-- Ed25519 Release Integrity & OTA Card -->
    <section style="
      background: ${theme.surface};
      border: 1px solid ${theme.border};
      border-radius: 12px;
      padding: 1.5rem;
    ">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 0.25rem 0;">
            Ed25519 Cryptographic Release Integrity & OTA Channels
          </h3>
          <p style="font-size: 0.85rem; color: ${theme.textMuted}; margin: 0;">
            Release authenticity and bundle provenance verified via Ed25519 digital signatures and SHA-256 digests.
          </p>
        </div>
        <span style="
          background: ${state.crlRevoked ? 'rgba(229, 62, 62, 0.2)' : 'rgba(72, 187, 120, 0.2)'};
          color: ${state.crlRevoked ? '#e53e3e' : '#48bb78'};
          border: 1px solid ${state.crlRevoked ? '#e53e3e' : '#48bb78'};
          border-radius: 9999px;
          padding: 4px 10px;
          font-size: 0.75rem;
          font-weight: 700;
        ">
          ${state.crlRevoked ? 'SIGNATURE REJECTED (CERTIFICATE REVOKED)' : 'ED25519 SIGNATURE VALID (CERTIFICATE VALID)'}
        </span>
      </div>

      <div style="display: flex; gap: 1rem; margin-bottom: 1.25rem;">
        <label style="
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 10px 14px;
          background: rgba(0,0,0,0.15);
          border: 1px solid ${state.activeRole === 'viewer' ? theme.accent : theme.border};
          border-radius: 8px;
          cursor: pointer;
        ">
          <input type="radio" name="mtlsRole" value="viewer" ${state.activeRole === 'viewer' ? 'checked' : ''} onchange="window.lynxfitaSetRole('viewer')">
          <div>
            <div style="font-weight: 600; font-size: 0.9rem;">Stable Release</div>
            <div style="font-size: 0.75rem; color: ${theme.textMuted};">Production forecast bundle</div>
          </div>
        </label>

        <label style="
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 10px 14px;
          background: rgba(0,0,0,0.15);
          border: 1px solid ${state.activeRole === 'top-patron' ? theme.accent : theme.border};
          border-radius: 8px;
          cursor: pointer;
        ">
          <input type="radio" name="mtlsRole" value="top-patron" ${state.activeRole === 'top-patron' ? 'checked' : ''} onchange="window.lynxfitaSetRole('top-patron')">
          <div>
            <div style="font-weight: 600; font-size: 0.9rem;">Top-Patron Channel</div>
            <div style="font-size: 0.75rem; color: ${theme.textMuted};">SIMD FFI + Canary OTA access</div>
          </div>
        </label>

        <label style="
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 10px 14px;
          background: rgba(0,0,0,0.15);
          border: 1px solid ${state.activeRole === 'canary' ? theme.accent : theme.border};
          border-radius: 8px;
          cursor: pointer;
        ">
          <input type="radio" name="mtlsRole" value="canary" ${state.activeRole === 'canary' ? 'checked' : ''} onchange="window.lynxfitaSetRole('canary')">
          <div>
            <div style="font-weight: 600; font-size: 0.9rem;">Canary Channel</div>
            <div style="font-size: 0.75rem; color: ${theme.textMuted};">Experimental WASI components</div>
          </div>
        </label>
      </div>

      <div style="display: flex; gap: 0.75rem;">
        <button
          id="btn-revoke-crl"
          style="
            background: #e53e3e;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
          "
          onclick="window.lynxfitaToggleCrlRevocation()"
        >
          ${state.crlRevoked ? 'Restore Valid Release Signature' : 'Simulate Tampered Signature (Revoke Certificate / Rollback)'}
        </button>
      </div>
    </section>

    <!-- Module Federation Channel Card -->
    <section style="
      background: ${theme.surface};
      border: 1px solid ${theme.border};
      border-radius: 12px;
      padding: 1.5rem;
    ">
      <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 0.5rem 0;">
        Module Federation & Bundle OTA Channel
      </h3>
      <p style="font-size: 0.85rem; color: ${theme.textMuted}; margin: 0 0 1rem 0;">
        Remote bundle resolution and automatic Cordis Fiber rollback to embedded baseline on invalidation.
      </p>

      <div style="display: flex; gap: 1rem; align-items: center;">
        <span style="font-size: 0.85rem; color: ${theme.textMuted};">Active Bundle:</span>
        <code style="
          background: rgba(0,0,0,0.2);
          padding: 4px 10px;
          border-radius: 6px;
          color: ${theme.accent};
          font-size: 0.85rem;
        ">${state.activeFederationBundle}</code>
        <button
          style="
            background: transparent;
            border: 1px solid ${theme.border};
            color: ${theme.text};
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 0.8rem;
            cursor: pointer;
          "
          onclick="window.lynxfitaSyncFederation()"
        >
          Reconcile Federation &check;
        </button>
      </div>
    </section>

    <!-- Cordis Service Registry Card -->
    <section style="
      background: ${theme.surface};
      border: 1px solid ${theme.border};
      border-radius: 12px;
      padding: 1.5rem;
    ">
      <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 0.5rem 0;">
        Cordis Service Registry (Endogenous Context)
      </h3>
      <p style="font-size: 0.85rem; color: ${theme.textMuted}; margin: 0 0 1rem 0;">
        Active services mounted on LynxFitaContext with registered effect disposers.
      </p>

      <div style="
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.75rem;
      ">
        ${Array.from(services.entries() as Iterable<[string, any]>).map(([name, svc]: [string, any]) => `
          <div style="
            background: rgba(0,0,0,0.15);
            border: 1px solid ${theme.border};
            border-radius: 8px;
            padding: 10px;
          ">
            <div style="font-weight: 700; font-size: 0.85rem; color: ${theme.accent}; font-family: monospace;">
              ctx.${name}
            </div>
            <div style="font-size: 0.72rem; color: ${theme.textMuted}; margin-top: 4px;">
              ${(svc as any).constructor?.name || 'Service'}
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  </div>
</main>
`;
}
