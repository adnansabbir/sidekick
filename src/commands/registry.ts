export type CommandHandler = () => void | Promise<void>;

interface Command {
    name: string;
    description: string;
    handler: CommandHandler;
}

const commands = new Map<string, Command>();

export function registerCommand(
    name: string,
    description: string,
    handler: CommandHandler,
): void {
    commands.set(name, { name, description, handler });
}

export async function runCommand(name: string): Promise<boolean> {
    const command = commands.get(name);
    if (!command) {
        return false;
    }
    await command.handler();
    return true;
}

export function listCommands(): { name: string; description: string }[] {
    return Array.from(commands.values(), ({ name, description }) => ({
        name,
        description,
    }));
}

// Finds the first /word token anywhere in the text that matches a
// registered command name. Slashes that don't match anything registered
// (a URL, a path, unrelated punctuation) are ignored, not flagged.
export function findCommandInText(text: string): string | null {
    for (const token of text.trim().split(/\s+/)) {
        if (token.length > 1 && token.startsWith("/")) {
            const name = token.slice(1).toLowerCase();
            if (commands.has(name)) {
                return name;
            }
        }
    }
    return null;
}
