import test from 'node:test';
import assert from 'node:assert/strict';
import { JsiCodeGenerator } from '../dist/index.js';

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
});
