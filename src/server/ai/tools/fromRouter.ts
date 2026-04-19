import "server-only";
import type { ZodTypeAny } from "zod";

// Minimal Zod -> JSON Schema converter for Anthropic's tool-use spec.
// Scope is narrow on purpose: only the Zod shapes actually used in the
// allow-listed tRPC procedures. If a new tool introduces an unsupported
// shape, extend this converter — do NOT pull in a heavyweight lib.

export type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  nullable?: boolean;
  additionalProperties?: boolean;
};

type ZodDef = {
  typeName?: string;
  innerType?: ZodTypeAny;
  values?: readonly string[];
  type?: ZodTypeAny;
  shape?: () => Record<string, ZodTypeAny>;
  checks?: Array<{ kind?: string }>;
  description?: string;
};

function getDef(schema: ZodTypeAny): ZodDef {
  // zod v3 exposes `_def`, zod v4 retains it — use a loose accessor.
  return (schema as unknown as { _def?: ZodDef })?._def ?? {};
}

export function zodToJsonSchema(schema: ZodTypeAny | undefined): JsonSchema {
  if (!schema) return { type: "object", properties: {}, additionalProperties: false };

  const def = getDef(schema);
  const typeName: string | undefined =
    def.typeName ??
    (schema as unknown as { constructor?: { name?: string } })?.constructor?.name;

  // Unwrap optional / nullable / default
  if (
    typeName === "ZodOptional" ||
    typeName === "ZodNullable" ||
    typeName === "ZodDefault"
  ) {
    const inner = def.innerType ?? def.type;
    const base = zodToJsonSchema(inner as ZodTypeAny);
    if (typeName === "ZodNullable") base.nullable = true;
    return base;
  }

  if (typeName === "ZodString") {
    const out: JsonSchema = { type: "string" };
    if (def.description) out.description = def.description;
    return out;
  }
  if (typeName === "ZodNumber") return { type: "number" };
  if (typeName === "ZodBoolean") return { type: "boolean" };
  if (typeName === "ZodEnum" || typeName === "ZodNativeEnum") {
    return { type: "string", enum: [...(def.values ?? [])] };
  }
  if (typeName === "ZodArray") {
    return { type: "array", items: zodToJsonSchema(def.type as ZodTypeAny) };
  }
  if (typeName === "ZodObject") {
    const shape = typeof def.shape === "function" ? def.shape() : {};
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      const innerDef = getDef(value);
      const innerName = innerDef.typeName;
      if (innerName !== "ZodOptional" && innerName !== "ZodDefault") {
        required.push(key);
      }
    }
    const out: JsonSchema = {
      type: "object",
      properties,
      additionalProperties: false,
    };
    if (required.length) out.required = required;
    return out;
  }
  if (typeName === "ZodUnion" || typeName === "ZodDiscriminatedUnion") {
    // Fall back to permissive string; tool-use inputs don't rely on this today.
    return { type: "string" };
  }

  return { type: "object", properties: {}, additionalProperties: true };
}
