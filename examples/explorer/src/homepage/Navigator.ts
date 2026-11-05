/**
 * WeChat-Style Super-App Header Bar & Navigation Component
 */

import type { SuperAppNavigator } from '../lib/navigation.js';
import type { ThemeManager } from '../lib/theme_context.js';

export function renderHeaderBar(
  navigator: SuperAppNavigator,
  themeManager: ThemeManager,
  title?: string
): string {
  const current = navigator.getCurrentRoute();
  const canBack = navigator.canGoBack();
  const theme = themeManager.getColors();
  const displayTitle = title || current?.title || 'LynxFita Super-App';

  return `
<header style="
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 1.25rem;
  background: ${theme.surface};
  border-bottom: 1px solid ${theme.border};
  color: ${theme.text};
  user-select: none;
">
  <div style="display: flex; align-items: center; gap: 0.75rem;">
    ${canBack ? `
      <button id="nav-btn-back" style="
        background: transparent;
        border: 1px solid ${theme.border};
        border-radius: 6px;
        color: ${theme.text};
        padding: 6px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.85rem;
      " onclick="window.lynxfitaNavigateBack()">
        <span>&larr;</span> Back
      </button>
    ` : `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: ${theme.accent};
        display: flex;
        align-items: center;
        justify-content: center;
        color: #14141e;
        font-weight: 800;
        font-size: 1.1rem;
      ">&Lambda;</div>
    `}
    <div>
      <h1 style="font-size: 1.05rem; margin: 0; font-weight: 700; line-height: 1.2;">
        ${displayTitle}
      </h1>
      <span style="font-size: 0.72rem; color: ${theme.textMuted}; font-family: monospace;">
        ${current ? current.url : 'lynxfita://home'}
      </span>
    </div>
  </div>

  <div style="display: flex; align-items: center; gap: 0.5rem;">
    <button id="nav-btn-home" style="
      background: transparent;
      border: 1px solid ${theme.border};
      border-radius: 6px;
      color: ${theme.text};
      padding: 6px 10px;
      cursor: pointer;
      font-size: 0.8rem;
    " onclick="window.lynxfitaNavigate('lynxfita://home')">
      Home
    </button>
    <button id="nav-btn-settings" style="
      background: transparent;
      border: 1px solid ${theme.border};
      border-radius: 6px;
      color: ${theme.text};
      padding: 6px 10px;
      cursor: pointer;
      font-size: 0.8rem;
    " onclick="window.lynxfitaNavigate('lynxfita://settings')">
      Settings
    </button>
    <button id="nav-btn-theme" style="
      background: transparent;
      border: 1px solid ${theme.border};
      border-radius: 6px;
      color: ${theme.accent};
      padding: 6px 10px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
    " onclick="window.lynxfitaToggleTheme()">
      ${themeManager.getMode() === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  </div>
</header>
`;
}
