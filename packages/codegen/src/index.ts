import ts from 'typescript';

export interface ParameterSpec {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'buffer';
}

export interface MethodSpec {
  name: string;
  parameters: ParameterSpec[];
  returnType: 'string' | 'number' | 'boolean' | 'void' | 'buffer';
  isAsync?: boolean;
}

export interface ModuleSpec {
  name: string;
  className: string;
  methods: MethodSpec[];
}

/**
 * Parses TypeScript source code containing an interface spec:
 * interface Native<Name>Spec { ... }
 */
export function parseTypeScriptSpec(sourceCode: string): ModuleSpec {
  const sourceFile = ts.createSourceFile(
    'spec.ts',
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  let targetInterface: ts.InterfaceDeclaration | undefined;

  function findInterface(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node)) {
      if (node.name.text.startsWith('Native') || node.name.text.endsWith('Spec') || !targetInterface) {
        targetInterface = node;
      }
    }
    ts.forEachChild(node, findInterface);
  }

  findInterface(sourceFile);

  if (!targetInterface) {
    throw new Error('No valid interface declaration found in TypeScript spec source code');
  }

  const rawName = targetInterface.name.text;
  let cleanName = rawName;
  if (cleanName.startsWith('Native')) {
    cleanName = cleanName.substring(6);
  }
  if (cleanName.endsWith('Spec')) {
    cleanName = cleanName.substring(0, cleanName.length - 4);
  }
  if (!cleanName) {
    cleanName = rawName;
  }

  const methods: MethodSpec[] = [];

  for (const member of targetInterface.members) {
    if (ts.isMethodSignature(member) && member.name) {
      const methodName = member.name.getText(sourceFile);
      const parameters: ParameterSpec[] = [];

      for (const param of member.parameters) {
        const paramName = param.name.getText(sourceFile);
        const typeText = param.type ? param.type.getText(sourceFile).trim() : 'any';
        parameters.push({
          name: paramName,
          type: normalizeType(typeText)
        });
      }

      let returnTypeStr = member.type ? member.type.getText(sourceFile).trim() : 'void';
      let isAsync = false;

      if (returnTypeStr.startsWith('Promise<') && returnTypeStr.endsWith('>')) {
        isAsync = true;
        returnTypeStr = returnTypeStr.substring(8, returnTypeStr.length - 1).trim();
      }

      methods.push({
        name: methodName,
        parameters,
        returnType: normalizeReturnType(returnTypeStr),
        isAsync
      });
    } else if (ts.isPropertySignature(member) && member.name && member.type && ts.isFunctionTypeNode(member.type)) {
      const methodName = member.name.getText(sourceFile);
      const fnType = member.type as ts.FunctionTypeNode;
      const parameters: ParameterSpec[] = [];

      for (const param of fnType.parameters) {
        const paramName = param.name.getText(sourceFile);
        const typeText = param.type ? param.type.getText(sourceFile).trim() : 'any';
        parameters.push({
          name: paramName,
          type: normalizeType(typeText)
        });
      }

      let returnTypeStr = fnType.type ? fnType.type.getText(sourceFile).trim() : 'void';
      let isAsync = false;

      if (returnTypeStr.startsWith('Promise<') && returnTypeStr.endsWith('>')) {
        isAsync = true;
        returnTypeStr = returnTypeStr.substring(8, returnTypeStr.length - 1).trim();
      }

      methods.push({
        name: methodName,
        parameters,
        returnType: normalizeReturnType(returnTypeStr),
        isAsync
      });
    }
  }

  return {
    name: cleanName,
    className: cleanName,
    methods
  };
}

function normalizeType(typeText: string): 'string' | 'number' | 'boolean' | 'buffer' {
  const lower = typeText.toLowerCase();
  if (lower === 'string') return 'string';
  if (lower === 'number') return 'number';
  if (lower === 'boolean' || lower === 'bool') return 'boolean';
  if (lower.includes('uint8array') || lower.includes('buffer') || lower.includes('arraybuffer')) {
    return 'buffer';
  }
  return 'string';
}

function normalizeReturnType(typeText: string): 'string' | 'number' | 'boolean' | 'void' | 'buffer' {
  const lower = typeText.toLowerCase();
  if (lower === 'void') return 'void';
  if (lower === 'string') return 'string';
  if (lower === 'number') return 'number';
  if (lower === 'boolean' || lower === 'bool') return 'boolean';
  if (lower.includes('uint8array') || lower.includes('buffer') || lower.includes('arraybuffer')) {
    return 'buffer';
  }
  return 'void';
}

export class JsiCodeGenerator {
  public parseSpec(sourceCode: string): ModuleSpec {
    return parseTypeScriptSpec(sourceCode);
  }

  public generateCppHeader(spec: ModuleSpec): string {
    const methodDeclarations = spec.methods.map(m => {
      const cppReturnType = this.mapToCppType(m.returnType);
      const cppParams = m.parameters.map(p => `${this.mapToCppType(p.type)} ${p.name}`).join(', ');
      if (m.isAsync) {
        return `  virtual ${cppReturnType} ${m.name}(${cppParams}) = 0; // Async (Promise-compatible)`;
      }
      return `  virtual ${cppReturnType} ${m.name}(${cppParams}) = 0;`;
    }).join('\n');

    const methodNamesList = spec.methods.map(m => `"${m.name}"`).join(', ');

    const dispatchBranches = spec.methods.map(m => {
      const argChecks = m.parameters.map((p, i) => {
        if (p.type === 'string') {
          return `      if (args.size() <= ${i} || !std::holds_alternative<std::string>(args[${i}])) {
        throw std::invalid_argument("${m.name}: expected string for argument '${p.name}'");
      }
      auto arg_${p.name} = std::get<std::string>(args[${i}]);`;
        }
        if (p.type === 'number') {
          return `      if (args.size() <= ${i}) {
        throw std::invalid_argument("${m.name}: missing argument '${p.name}'");
      }
      double arg_${p.name} = 0.0;
      if (std::holds_alternative<double>(args[${i}])) {
        arg_${p.name} = std::get<double>(args[${i}]);
      } else if (std::holds_alternative<int64_t>(args[${i}])) {
        arg_${p.name} = static_cast<double>(std::get<int64_t>(args[${i}]));
      } else {
        throw std::invalid_argument("${m.name}: expected number for argument '${p.name}'");
      }
      auto arg_${p.name}_typed = ${this.mapToCppType(p.type) === 'int64_t' ? `static_cast<int64_t>(arg_${p.name})` : `arg_${p.name}`};`;
        }
        if (p.type === 'boolean') {
          return `      if (args.size() <= ${i} || !std::holds_alternative<bool>(args[${i}])) {
        throw std::invalid_argument("${m.name}: expected boolean for argument '${p.name}'");
      }
      auto arg_${p.name} = std::get<bool>(args[${i}]);`;
        }
        if (p.type === 'buffer') {
          return `      if (args.size() <= ${i} || !std::holds_alternative<std::vector<uint8_t>>(args[${i}])) {
        throw std::invalid_argument("${m.name}: expected buffer for argument '${p.name}'");
      }
      auto arg_${p.name} = std::get<std::vector<uint8_t>>(args[${i}]);`;
        }
        return '';
      }).join('\n');

      const callArgs = m.parameters.map(p => `arg_${p.name}`).join(', ');
      const invocation = m.returnType === 'void'
        ? `      this->${m.name}(${callArgs});\n      return std::monostate{};`
        : `      return this->${m.name}(${callArgs});`;

      return `    if (method_name == "${m.name}") {
${argChecks}
${invocation}
    }`;
    }).join('\n\n');

    return `// Auto-generated by @lynxfita/codegen. DO NOT EDIT DIRECTLY.
#pragma once

#include <lynxfita/jsi_types.h>
#include <string>
#include <vector>
#include <memory>
#include <stdexcept>

namespace lynxfita::generated {

class Native${spec.className}Spec : public HostObject {
 public:
  ~Native${spec.className}Spec() override = default;

  std::string GetName() const override { return "${spec.name}"; }

  std::vector<std::string> GetPropertyNames() const override {
    return {${methodNamesList}};
  }

  JsiValueVariant GetProperty(const std::string& name) override {
    if (name == "name") {
      return GetName();
    }
    return std::monostate{};
  }

  void SetProperty(const std::string& /*name*/, const JsiValueVariant& /*value*/) override {
    // Read-only native module specification
  }

  JsiValueVariant InvokeMethod(const std::string& method_name, const std::vector<JsiValueVariant>& args) override {
${dispatchBranches}
    throw std::runtime_error("Method not found in Native${spec.className}Spec: " + method_name);
  }

  // Pure virtual methods to be implemented by concrete native host module
${methodDeclarations}
};

} // namespace lynxfita::generated
`;
  }

  public generateTypeScriptBinding(spec: ModuleSpec): string {
    const methodSignatures = spec.methods.map(m => {
      const params = m.parameters.map(p => `${p.name}: ${this.mapToTsType(p.type)}`).join(', ');
      const retType = m.isAsync ? `Promise<${this.mapToTsType(m.returnType)}>` : this.mapToTsType(m.returnType);
      return `  ${m.name}(${params}): ${retType};`;
    }).join('\n');

    const methodImplementations = spec.methods.map(m => {
      const params = m.parameters.map(p => `${p.name}: ${this.mapToTsType(p.type)}`).join(', ');
      const paramNames = m.parameters.map(p => p.name).join(', ');
      const retType = m.isAsync ? `Promise<${this.mapToTsType(m.returnType)}>` : this.mapToTsType(m.returnType);
      if (m.isAsync) {
        return `  public async ${m.name}(${params}): ${retType} {
    return Promise.resolve(this.hostObject.${m.name}(${paramNames}));
  }`;
      }
      return `  public ${m.name}(${params}): ${retType} {
    return this.hostObject.${m.name}(${paramNames});
  }`;
    }).join('\n\n');

    return `// Auto-generated by @lynxfita/codegen. DO NOT EDIT DIRECTLY.
export interface ${spec.className}Interface {
${methodSignatures}
}

export class ${spec.className}Binding implements ${spec.className}Interface {
  private hostObject: any;

  constructor(hostObject?: any) {
    this.hostObject = hostObject || (globalThis as any).${spec.name};
    if (!this.hostObject) {
      throw new Error("Native host object '${spec.name}' not found on globalThis");
    }
  }

${methodImplementations}
}
`;
  }

  private mapToCppType(tsType: string): string {
    switch (tsType) {
      case 'string': return 'std::string';
      case 'number': return 'double';
      case 'boolean': return 'bool';
      case 'buffer': return 'std::vector<uint8_t>';
      case 'void': return 'void';
      default: return 'lynxfita::JsiValueVariant';
    }
  }

  private mapToTsType(type: string): string {
    switch (type) {
      case 'string': return 'string';
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'buffer': return 'Uint8Array';
      case 'void': return 'void';
      default: return 'any';
    }
  }
}
