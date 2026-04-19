import "server-only";
import { zodToJsonSchema } from "./fromRouter";
import { TOOL_DEFINITIONS, TOOLS_BY_NAME } from "./definitions";
import type { ToolDefinition, AppCaller } from "./definitions";

export type { ToolDefinition, AppCaller };
export { TOOL_DEFINITIONS, TOOLS_BY_NAME };
export { buildAgentCaller, executeTool } from "./executor";

// Anthropic tool-use schema. See:
// https://docs.anthropic.com/en/docs/build-with-claude/tool-use
export type AnthropicToolSchema = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export function getToolSchemas(
  filter?: (tool: ToolDefinition) => boolean
): AnthropicToolSchema[] {
  const tools = filter ? TOOL_DEFINITIONS.filter(filter) : TOOL_DEFINITIONS;
  return tools.map((t) => {
    const schema = zodToJsonSchema(t.inputSchema);
    return {
      name: t.name,
      description: t.description,
      input_schema: {
        type: "object",
        properties: schema.properties ?? {},
        required: schema.required,
      },
    };
  });
}
