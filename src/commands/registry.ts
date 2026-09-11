import toolManifest from "./toolManifest.json";

interface ToolManifestEntry {
    description: string;
    params: Record<string, unknown> | null;
}

const manifest = toolManifest as Record<string, ToolManifestEntry>;

export type CommandHandler = (
    params?: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

interface Command {
    name: string;
    handler: CommandHandler;
    // Setting this exposes the command as /commandAlias in chat.
    commandAlias?: string;
}

const commands = new Map<string, Command>();

export function registerCommand(
    name: string,
    handler: CommandHandler,
    commandAlias?: string,
): void {
    commands.set(name, { name, handler, commandAlias });
}

export async function runCommand(
    name: string,
    params?: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
    const command = commands.get(name);
    if (!command) {
        return null;
    }
    return command.handler(params);
}

export function listCommands(): { name: string; description: string }[] {
    return Array.from(commands.values())
        .filter((command) => command.commandAlias)
        .map(({ name, commandAlias }) => ({
            name: commandAlias!,
            description: manifest[name]?.description ?? "",
        }));
}

function buildExampleParams(
    params: Record<string, unknown>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(params).map(([paramName, paramSchema]) => {
            const schema = paramSchema as {
                default?: unknown;
                options?: Record<string, unknown>;
            };
            const exampleValue =
                schema.default ?? Object.keys(schema.options ?? {})[0] ?? null;
            return [paramName, exampleValue];
        }),
    );
}

export function formatAgentTools(): string {
    return Object.entries(manifest)
        .map(([name, tool]) => {
            if (!tool.params) {
                return `- ${name}: ${tool.description}`;
            }
            const example = { name, params: buildExampleParams(tool.params) };
            return `- ${name}: ${tool.description} Params schema: ${JSON.stringify(tool.params)} Example call: ${JSON.stringify(example)}`;
        })
        .join("\n");
}

export function findCommandInText(text: string): string | null {
    for (const token of text.trim().split(/\s+/)) {
        if (token.length > 1 && token.startsWith("/")) {
            const typed = token.slice(1).toLowerCase();
            for (const command of commands.values()) {
                if (command.commandAlias?.toLowerCase() === typed) {
                    return command.name;
                }
            }
        }
    }
    return null;
}

// toolManifest.json and registerCommand() calls are two separately-maintained
// sources of truth joined only by matching name strings - call this once all
// commands are registered to catch drift between them immediately.
export function assertManifestConsistency(): void {
    const manifestNames = new Set(Object.keys(manifest));
    const registeredNames = new Set(commands.keys());

    for (const name of manifestNames) {
        if (!registeredNames.has(name)) {
            console.error(
                `[commands] toolManifest.json has "${name}" but no command is registered with that name.`,
            );
        }
    }
    for (const name of registeredNames) {
        if (!manifestNames.has(name)) {
            console.error(
                `[commands] Command "${name}" is registered but missing from toolManifest.json.`,
            );
        }
    }
}
