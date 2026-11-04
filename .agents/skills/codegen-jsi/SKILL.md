---
name: codegen-jsi
description: Code generation procedures synthesizing typed C++20 JSI HostObject specs from TypeScript module definitions in LynxFita.
---

# JSI Codegen Skill

## When to Use
Use when:
- Defining new native host module interfaces in TypeScript.
- Synthesizing C++20 headers implementing the `HostObject` interface.
- Ensuring typed method signatures, `InvokeMethod` dispatch logic, and `GetProperty` tables match TypeScript specifications.

## Invocation Protocol
```typescript
import { JsiCodeGenerator, ModuleSpec } from '@lynxfita/codegen';

const gen = new JsiCodeGenerator();
const spec: ModuleSpec = {
  name: 'DeviceTelemetry',
  className: 'DeviceTelemetry',
  methods: [
    { name: 'getBatteryLevel', parameters: [], returnType: 'number' },
    { name: 'setSamplingRate', parameters: [{ name: 'rateHz', type: 'number' }], returnType: 'void' }
  ]
};

const header = gen.generateCppHeader(spec);
```

## Invariants
1. Output headers reside in `src/native/include/lynxfita/generated/`.
2. Generated classes subclass `lynxfita::HostObject`.
3. Parameter types (`string`, `number`, `boolean`, `buffer`) must be strictly checked and unmarshaled from `JsiValueVariant`.
4. Derived C++ host modules must only implement the declared pure virtual methods; `InvokeMethod` is fully synthesized.
