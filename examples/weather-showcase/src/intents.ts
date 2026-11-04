/**
 * LynxFita Weather Showcase - MVI Intents
 * Unidirectional intent declarations for user interactions and telemetry updates.
 */

export type WeatherIntent =
  | { type: 'REFRESH_WEATHER'; payload?: { lat?: number; lon?: number } }
  | { type: 'TOGGLE_THEME' }
  | { type: 'UPDATE_COORDINATES'; payload: { lat: number; lon: number; city?: string; country?: string } }
  | { type: 'GRANT_LOCATION_PERMISSION' }
  | { type: 'TRIGGER_LOCATION_ERROR'; payload: { message: string } }
  | { type: 'SIMULATE_OFFLINE_FALLBACK' };

export const Intents = {
  refreshWeather: (lat?: number, lon?: number): WeatherIntent => {
    if (lat !== undefined && lon !== undefined) {
      return {
        type: 'REFRESH_WEATHER',
        payload: { lat, lon }
      };
    }
    return { type: 'REFRESH_WEATHER' };
  },
  toggleTheme: (): WeatherIntent => ({
    type: 'TOGGLE_THEME'
  }),
  updateCoordinates: (lat: number, lon: number, city?: string, country?: string): WeatherIntent => {
    const payload: { lat: number; lon: number; city?: string; country?: string } = { lat, lon };
    if (city !== undefined) payload.city = city;
    if (country !== undefined) payload.country = country;
    return {
      type: 'UPDATE_COORDINATES',
      payload
    };
  },
  grantLocationPermission: (): WeatherIntent => ({
    type: 'GRANT_LOCATION_PERMISSION'
  }),
  triggerLocationError: (message: string): WeatherIntent => ({
    type: 'TRIGGER_LOCATION_ERROR',
    payload: { message }
  }),
  simulateOfflineFallback: (): WeatherIntent => ({
    type: 'SIMULATE_OFFLINE_FALLBACK'
  })
};
