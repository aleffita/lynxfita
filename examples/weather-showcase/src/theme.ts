/**
 * Parity with original aleffita/weather-showcase themes:
 * ApplicationBaseTheme, DarkTheme, LightTheme
 */

export interface ApplicationBaseTheme {
  bgColor: string;
  textColor: string;
  neutralColor: string;
  accentColor: string;
  worldMapColor: string;
}

export const BaseTheme: ApplicationBaseTheme = {
  bgColor: '#1f1f1f',
  textColor: '#ffffff',
  neutralColor: '#e7e4e4',
  accentColor: '#f9d65d',
  worldMapColor: '#29292a'
};

export const DarkTheme: ApplicationBaseTheme = {
  ...BaseTheme,
  bgColor: '#000000',
  textColor: '#ffffff',
  worldMapColor: '#29292a'
};

export const LightTheme: ApplicationBaseTheme = {
  ...BaseTheme,
  bgColor: '#ffffff',
  textColor: '#383838',
  worldMapColor: '#f4f4f4'
};

export function getTheme(mode: 'dark' | 'light'): ApplicationBaseTheme {
  return mode === 'dark' ? DarkTheme : LightTheme;
}
