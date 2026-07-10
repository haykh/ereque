export type GLSLFunctionArgAccessor = "in" | "out" | "inout";

type GLSLRawChunk = Array<string | StringTemplate> | string | StringTemplate;

export class StringTemplate {
  constructor(private body: Array<string>) {}

  public render(context: Record<string, string> = {}): string {
    let rendered = this.body.join("\n");
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, "g");
      rendered = rendered.replace(regex, value);
    }
    return rendered;
  }

  public bake(context: Record<string, string> = {}): StringTemplate {
    return new StringTemplate(
      this.body.map((line) => {
        let renderedLine = line;
        for (const [key, value] of Object.entries(context)) {
          const regex = new RegExp(`\\$\\{${key}\\}`, "g");
          renderedLine = renderedLine.replace(regex, value);
        }
        return renderedLine;
      }),
    );
  }

  public static from(
    raw: Array<string | StringTemplate> | string | StringTemplate,
  ): StringTemplate {
    if (raw instanceof StringTemplate) {
      return raw;
    } else if (typeof raw === "string") {
      return new StringTemplate(raw.split("\n"));
    } else if (Array.isArray(raw)) {
      const lines: string[] = [];
      for (const item of raw) {
        if (item instanceof StringTemplate) {
          lines.push(...item.body);
        } else {
          lines.push(item);
        }
      }
      return new StringTemplate(lines);
    } else {
      throw new Error("Invalid input type for StringTemplate.from");
    }
  }

  public merge(other: GLSLRawChunk): StringTemplate {
    return new StringTemplate([
      ...this.body,
      ...StringTemplate.from(other).body,
    ]);
  }
}

export class GLSLMacro {
  constructor(
    private name: string,
    private value: string,
  ) {}

  public definition(): string {
    return `#ifndef ${this.name}\n  #define ${this.name} ${this.value}\n#endif`;
  }
}

export class GLSLUniform {
  constructor(
    private type: string,
    private name: string,
    private count?: number,
  ) {}
  public definition(): string {
    return this.count === undefined
      ? `uniform ${this.type} ${this.name};`
      : `uniform ${this.type} ${this.name}[${this.count}];`;
  }
}

export class GLSLVariable {
  constructor(
    protected type: string,
    protected name: string,
  ) {}

  public definition(): string {
    return `${this.type} ${this.name};`;
  }
}

export class GLSLFunctionArg extends GLSLVariable {
  private accessor: GLSLFunctionArgAccessor;

  constructor(accessor: GLSLFunctionArgAccessor, type: string, name: string) {
    super(type, name);
    this.accessor = accessor;
  }

  public declaration(): string {
    return `${this.accessor} ${this.type} ${this.name}`;
  }

  public reference(): string {
    return this.name;
  }
}

export type GLSLFunctionSignature = Array<GLSLFunctionArg | string>;
export type GLSLFunctionBody = StringTemplate | string | Array<string>;

const parseArg = (arg: GLSLFunctionArg | string): GLSLFunctionArg => {
  if (typeof arg !== "string") return arg;
  const parts = arg.split(" ");
  if (parts.length === 2) return new GLSLFunctionArg("in", parts[0], parts[1]);
  if (parts.length === 3) {
    if (!["in", "out", "inout"].includes(parts[0])) {
      throw new Error(
        `Invalid GLSLFunctionArg accessor: ${parts[0]}. Expected one of "in", "out", or "inout".`,
      );
    }
    return new GLSLFunctionArg(
      parts[0] as GLSLFunctionArgAccessor,
      parts[1],
      parts[2],
    );
  }
  throw new Error(
    `Invalid GLSLFunctionArg string format: ${arg}. Expected format: "type name" or "accessor type name".`,
  );
};

export class GLSLFunction {
  private args: Array<GLSLFunctionArg>;
  private body: StringTemplate;

  constructor(
    private returnType: string,
    private name: string,
    args: GLSLFunctionSignature,
    body: GLSLFunctionBody,
  ) {
    this.args = args.map(parseArg);
    if (typeof body === "string") {
      this.body = new StringTemplate(body.split("\n"));
    } else if (Array.isArray(body)) {
      this.body = new StringTemplate(body);
    } else {
      this.body = body;
    }
  }

  public bake(context: Record<string, string> = {}): GLSLFunction {
    const bakedBody = this.body.bake(context);
    return new GLSLFunction(this.returnType, this.name, this.args, bakedBody);
  }

  public definition(context: Record<string, string> = {}): string {
    const argsStr = this.args.map((arg) => arg.declaration()).join(", ");
    const bodyStr = this.body.render(context);
    const bodyLines = bodyStr.split("\n");
    const minIndent = Math.min(
      ...bodyLines
        .filter((line) => line.trim() !== "")
        .map((line) => line.match(/^(\s*)/)![1].length),
    );
    const indentedBody = bodyLines
      .map((line) => line.slice(minIndent))
      .map((line) => `  ${line}`)
      .join("\n");
    return `${this.returnType} ${this.name}(${argsStr}) {\n${indentedBody}\n}`;
  }

  public call(): string {
    const argsStr = this.args.map((arg) => arg.reference()).join(", ");
    return `${this.name}(${argsStr})`;
  }
}

export class GLSLCallable {
  constructor(
    private name: string,
    private args: GLSLFunctionArg[],
  ) {}

  public call(args?: string[]): string {
    const exprs = args ?? this.args.map((a) => a.reference());
    if (exprs.length !== this.args.length) {
      throw new Error(
        `${this.name} expects ${this.args.length} args, got ${exprs.length}`,
      );
    }
    return `${this.name}(${exprs.join(", ")})`;
  }
}

export type GLSLStructFields = Array<GLSLVariable | string>;

export class GLSLStruct {
  private fields: Array<GLSLVariable>;

  constructor(
    private name: string,
    fields: GLSLStructFields,
  ) {
    this.fields = fields.map((field) => {
      if (typeof field === "string") {
        const splitted = field.split(" ");
        if (splitted.length === 2) {
          return new GLSLVariable(splitted[0], splitted[1]);
        } else {
          throw new Error(
            `Invalid GLSLStruct field string format: ${field}. Expected format: "type name".`,
          );
        }
      } else {
        return field;
      }
    });
  }

  public definition(): string {
    const fieldsStr = this.fields
      .map((field) => field.definition())
      .join("\n  ");
    return `struct ${this.name} {\n  ${fieldsStr}\n};`;
  }
}

export class GLSLShaderChunk {
  private raw_preamble: StringTemplate;
  private raw_postamble: StringTemplate;

  constructor(
    private uniforms: Array<GLSLUniform> = [],
    private macros: Array<GLSLMacro> = [],
    private structs: Array<GLSLStruct> = [],
    private functions: Array<GLSLFunction> = [],
    raw_preamble: GLSLRawChunk = [],
    raw_postamble: GLSLRawChunk = [],
  ) {
    this.raw_preamble = StringTemplate.from(raw_preamble);
    this.raw_postamble = StringTemplate.from(raw_postamble);
  }

  public render(context: Record<string, string> = {}): string {
    const uniformsStr = this.uniforms
      .map((uniform) => uniform.definition())
      .join("\n");
    const macrosStr = this.macros.map((macro) => macro.definition()).join("\n");
    const structsStr = this.structs
      .map((struct) => struct.definition())
      .join("\n");
    const functionsStr = this.functions
      .map((func) => func.definition(context))
      .join("\n\n");
    return [
      this.raw_preamble.render(context),
      uniformsStr,
      macrosStr,
      structsStr,
      functionsStr,
      this.raw_postamble.render(context),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  public bake(context: Record<string, string> = {}): GLSLShaderChunk {
    return new GLSLShaderChunk(
      this.uniforms,
      this.macros,
      this.structs,
      this.functions.map((func) => func.bake(context)),
      this.raw_preamble.bake(context),
      this.raw_postamble.bake(context),
    );
  }

  public addPreamble(lines: GLSLRawChunk) {
    this.raw_preamble = this.raw_preamble.merge(lines);
  }

  public addPostamble(lines: GLSLRawChunk) {
    this.raw_postamble = this.raw_postamble.merge(lines);
  }

  public withPreamble(lines: GLSLRawChunk): GLSLShaderChunk {
    return new GLSLShaderChunk(
      this.uniforms,
      this.macros,
      this.structs,
      this.functions,
      this.raw_preamble.merge(lines),
      this.raw_postamble,
    );
  }

  public withPostamble(lines: GLSLRawChunk): GLSLShaderChunk {
    return new GLSLShaderChunk(
      this.uniforms,
      this.macros,
      this.structs,
      this.functions,
      this.raw_preamble,
      this.raw_postamble.merge(lines),
    );
  }

  public merge(other: GLSLShaderChunk): GLSLShaderChunk {
    return new GLSLShaderChunk(
      [...this.uniforms, ...other.uniforms],
      [...this.macros, ...other.macros],
      [...this.structs, ...other.structs],
      [...this.functions, ...other.functions],
      this.raw_preamble.merge(other.raw_preamble),
      this.raw_postamble.merge(other.raw_postamble),
    );
  }
}

export class GLSLContract {
  private args: GLSLFunctionArg[];
  constructor(
    private returnType: string,
    sig: GLSLFunctionSignature,
  ) {
    this.args = sig.map(parseArg);
  }

  implement(name: string, body: GLSLFunctionBody): GLSLFunction {
    return new GLSLFunction(this.returnType, name, this.args, body);
  }

  reference(name: string): GLSLCallable {
    return new GLSLCallable(name, this.args);
  }
}
