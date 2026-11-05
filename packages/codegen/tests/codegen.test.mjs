import test from 'node:test';
import assert from 'node:assert/strict';
import { JsiCodeGenerator, parseTypeScriptSpec } from '../dist/index.js';

test('JsiCodeGenerator produces clean C++ header', () => {
  const gen = new JsiCodeGenerator();
  const spec = {
    name: 'HardwareSensor',
    className: 'HardwareSensor',
    methods: [
      {
        name: 'readTemperature',
        parameters: [{ name: 'sensorId', type: 'string' }],
        returnType: 'number'
      },
      {
        name: 'calibrate',
        parameters: [],
        returnType: 'boolean'
      }
    ]
  };

  const header = gen.generateCppHeader(spec);

  assert.ok(header.includes('class NativeHardwareSensorSpec : public HostObject'));
  assert.ok(header.includes('virtual double readTemperature(std::string sensorId) = 0;'));
  assert.ok(header.includes('virtual bool calibrate() = 0;'));
  assert.ok(header.includes('"readTemperature", "calibrate"'));
  assert.ok(header.includes('JsiValueVariant InvokeMethod(const std::string& method_name'));
  assert.ok(header.includes('JsiValueVariant GetProperty(const std::string& name) override'));
  assert.ok(header.includes('method_name == "readTemperature"'));
  assert.ok(header.includes('this->readTemperature(arg_sensorId)'));
});

test('parseTypeScriptSpec parses real TypeScript interface definitions', () => {
  const tsSource = `
    export interface NativeWeatherTelemetrySpec {
      getCurrentTemperature(city: string): number;
      streamRadarData(channel: number): Promise<Uint8Array>;
      toggleSatelliteMode(active: boolean): void;
    }
  `;

  const spec = parseTypeScriptSpec(tsSource);
  assert.equal(spec.name, 'WeatherTelemetry');
  assert.equal(spec.className, 'WeatherTelemetry');
  assert.equal(spec.methods.length, 3);

  // Method 1
  assert.equal(spec.methods[0].name, 'getCurrentTemperature');
  assert.equal(spec.methods[0].parameters[0].name, 'city');
  assert.equal(spec.methods[0].parameters[0].type, 'string');
  assert.equal(spec.methods[0].returnType, 'number');
  assert.equal(spec.methods[0].isAsync, false);

  // Method 2 (async with Promise<Uint8Array>)
  assert.equal(spec.methods[1].name, 'streamRadarData');
  assert.equal(spec.methods[1].parameters[0].name, 'channel');
  assert.equal(spec.methods[1].parameters[0].type, 'number');
  assert.equal(spec.methods[1].returnType, 'buffer');
  assert.equal(spec.methods[1].isAsync, true);

  // Method 3 (void)
  assert.equal(spec.methods[2].name, 'toggleSatelliteMode');
  assert.equal(spec.methods[2].parameters[0].name, 'active');
  assert.equal(spec.methods[2].parameters[0].type, 'boolean');
  assert.equal(spec.methods[2].returnType, 'void');
  assert.equal(spec.methods[2].isAsync, false);
});

test('JsiCodeGenerator generates typed TypeScript binding', () => {
  const gen = new JsiCodeGenerator();
  const spec = parseTypeScriptSpec(`
    export interface NativeDeviceSpec {
      getDeviceId(): string;
      calibrate(factor: number): Promise<boolean>;
    }
  `);

  const tsBinding = gen.generateTypeScriptBinding(spec);
  assert.ok(tsBinding.includes('export interface DeviceInterface'));
  assert.ok(tsBinding.includes('getDeviceId(): string;'));
  assert.ok(tsBinding.includes('calibrate(factor: number): Promise<boolean>;'));
  assert.ok(tsBinding.includes('export class DeviceBinding implements DeviceInterface'));
  assert.ok(tsBinding.includes('public async calibrate(factor: number): Promise<boolean>'));
});

test('parseTypeScriptSpec supports function property signatures', () => {
  const tsSource = `
    export interface NativeSensorSpec {
      computeReading: (sensorId: string, gain: number) => number;
      streamData: (active: boolean) => Promise<Uint8Array>;
    }
  `;
  const spec = parseTypeScriptSpec(tsSource);
  assert.equal(spec.name, 'Sensor');
  assert.equal(spec.methods.length, 2);
  assert.equal(spec.methods[0].name, 'computeReading');
  assert.equal(spec.methods[0].parameters.length, 2);
  assert.equal(spec.methods[0].returnType, 'number');
  assert.equal(spec.methods[1].isAsync, true);
  assert.equal(spec.methods[1].returnType, 'buffer');
});

test('JsiCodeGenerator generates typed arguments for number parameters in C++ header', () => {
  const gen = new JsiCodeGenerator();
  const spec = parseTypeScriptSpec(`
    export interface NativeSensorSpec {
      computeReading: (sensorId: string, gain: number) => number;
    }
  `);

  const header = gen.generateCppHeader(spec);
  assert.ok(header.includes('auto arg_gain_typed = arg_gain;'));
  assert.ok(header.includes('this->computeReading(arg_sensorId, arg_gain_typed)'));
});


