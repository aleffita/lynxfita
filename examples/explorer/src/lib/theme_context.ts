/**
 * Super-App Theme Context
 * Manages Light/Dark themes with #f9d65d gold brand accent.
 */

export interface ThemeColors {
  bg: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
}

export const DARK_THEME: ThemeColors = {
  bg: '#14141e',
  surface: '#1c1c28',
  border: '#2c2c3e',
  text: '#ffffff',
  textMuted: '#9494a8',
  accent: '#f9d65d',
  accentHover: '#e0c04c',
};

export const LIGHT_THEME: ThemeColors = {
  bg: '#f4f5f8',
  surface: '#ffffff',
  border: '#e2e4ea',
  text: '#1a1a24',
  textMuted: '#6c7080',
  accent: '#d4a820',
  accentHover: '#b89018',
};

export class ThemeManager {
  private currentMode: 'dark' | 'light' = 'dark';
  private listeners = new Set<(mode: 'dark' | 'light') => void>();

  public getMode(): 'dark' | 'light' {
    return this.currentMode;
  }

  public getColors(): ThemeColors {
    return this.currentMode === 'dark' ? DARK_THEME : LIGHT_THEME;
  }

  public toggle(): 'dark' | 'light' {
    this.currentMode = this.currentMode === 'dark' ? 'light' : 'dark';
    for (const l of this.listeners) {
      l(this.currentMode);
    }
    return this.currentMode;
  }

  public subscribe(fn: (mode: 'dark' | 'light') => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
}
