/**
 * LynxFita Codegen: WIT Universal IR & Code Generation Tests
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWitSpec,
  JsiCodeGenerator
} from '../dist/index.js';

const SAMPLE_WIT = `
interface weather-sensor {
  compute-advection: func(wind-speed: f32) -> f32;
  read-temperature: func() -> f32;
}
`;

test('parseWitSpec parses interface and methods into ModuleSpec IR', () => {
  const spec = parseWitSpec(SAMPLE_WIT);
  assert.equal(spec.name, 'WeatherSensor');
  assert.equal(spec.className, 'WeatherSensor');
  assert.equal(spec.methods.length, 2);

  assert.equal(spec.methods[0]?.name, 'computeAdvection');
  assert.equal(spec.methods[0]?.parameters.length, 1);
  assert.equal(spec.methods[0]?.parameters[0]?.name, 'windSpeed');
  assert.equal(spec.methods[0]?.returnType, 'number');

  assert.equal(spec.methods[1]?.name, 'readTemperature');
  assert.equal(spec.methods[1]?.returnType, 'number');
});

test('JsiCodeGenerator generates typed Cordis Service with inject coeffects', () => {
  const codegen = new JsiCodeGenerator();
  const spec = codegen.parseWit(SAMPLE_WIT);
  const serviceCode = codegen.generateCordisService(spec);

  assert.ok(serviceCode.includes("export class WeatherSensorService extends Service"));
  assert.ok(serviceCode.includes("public static provide = 'weathersensor'"));
  assert.ok(serviceCode.includes("public static inject = ['dma']"));
  assert.ok(serviceCode.includes("public async computeAdvection(windSpeed: number): number"));
});

test('JsiCodeGenerator generates Stationary DMA Layout', () => {
  const codegen = new JsiCodeGenerator();
  const spec = codegen.parseWit(SAMPLE_WIT);
  const dmaCode = codegen.generateDmaLayout(spec, 0x2000);

  assert.ok(dmaCode.includes("WEATHERSENSOR_DMA_LAYOUT"));
  assert.ok(dmaCode.includes("BASE_OFFSET: 0x2000"));
  assert.ok(dmaCode.includes("SLOT_COMPUTE_ADVECTION: 0x2000"));
  assert.ok(dmaCode.includes("SLOT_READ_TEMPERATURE: 0x2010"));
});

test('JsiCodeGenerator generates C++20 JSI HostObject Header', () => {
  const codegen = new JsiCodeGenerator();
  const spec = codegen.parseWit(SAMPLE_WIT);
  const cppCode = codegen.generateCppHeader(spec);

  assert.ok(cppCode.includes("class NativeWeatherSensorSpec"));
  assert.ok(cppCode.includes("virtual double computeAdvection(double windSpeed) = 0;"));
  assert.ok(cppCode.includes("virtual double readTemperature() = 0;"));
});
