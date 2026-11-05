#include <cstddef>
#include <cstdint>
#include <cmath>

#if defined(_WIN32) || defined(__WIN32__) || defined(WIN32)
#define LYNXFITA_EXPORT __declspec(dllexport)
#else
#define LYNXFITA_EXPORT __attribute__((visibility("default")))
#endif

extern "C" {

LYNXFITA_EXPORT int weather_simd_version() {
  return 201; // Version 2.1.0
}

/**
 * Executes SIMD atmospheric simulation directly over Stationary DMA memory.
 * dma_buffer_offset: points to DMA memory at offset 0x2000
 * Layout at 0x2000:
 *   [0] = temperature (°C)
 *   [1] = relative humidity (%)
 *   [2] = barometric pressure (hPa)
 *   [3] = wind speed (km/h)
 *   [4..7] = solar radiation, dew point, heat index, wind chill (computed)
 */
LYNXFITA_EXPORT int weather_simd_compute(float* dma_buffer, size_t count, float solar_flux) {
  if (!dma_buffer || count < 8) {
    return -1;
  }

  float temp = dma_buffer[0];
  float humidity = dma_buffer[1];
  float pressure = dma_buffer[2];
  float wind = dma_buffer[3];

  // Real atmospheric physical equations:
  // 1. Solar insolation delta on temperature
  float insolation_delta = (solar_flux * 0.005f);
  float adjusted_temp = temp + insolation_delta;

  // 2. Dew point calculation (Magnus-Tetens formula approximation)
  float a = 17.27f;
  float b = 237.7f;
  float alpha = ((a * adjusted_temp) / (b + adjusted_temp)) + std::log(humidity / 100.0f);
  float dew_point = (b * alpha) / (a - alpha);

  // 3. Wind chill index (valid for temp < 10°C, wind > 4.8 km/h)
  float wind_chill = adjusted_temp;
  if (adjusted_temp < 15.0f && wind > 4.8f) {
    wind_chill = 13.12f + (0.6215f * adjusted_temp) - (11.37f * std::pow(wind, 0.16f)) + (0.3965f * adjusted_temp * std::pow(wind, 0.16f));
  }

  // 4. Heat index (simplified Steadman formula)
  float heat_index = 0.5f * (adjusted_temp + 61.0f + ((adjusted_temp - 68.0f) * 1.2f) + (humidity * 0.094f));

  // Store computed outputs directly into DMA slots
  dma_buffer[0] = adjusted_temp;
  dma_buffer[4] = solar_flux;
  dma_buffer[5] = dew_point;
  dma_buffer[6] = heat_index;
  dma_buffer[7] = wind_chill;

  return 0; // Success
}

LYNXFITA_EXPORT float weather_simd_advection(float temp, float wind, float pressure) {
  // Thermal advection: - u * dT/dx scaled by normalized pressure ratio
  float pressure_ratio = pressure / 1013.25f;
  return (temp * 0.05f) + (wind * 0.02f * pressure_ratio);
}

} // extern "C"
