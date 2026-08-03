interface LanguageModelSession {
    prompt(input: string): Promise<string>;
}

interface LanguageModelPrompt {
    role: "system" | "user" | "assistant";
    content: string;
}

interface LanguageModelCreateOptions {
    initialPrompts?: LanguageModelPrompt[];
}

interface LanguageModelStatic {
    availability(): Promise<"unavailable" | "downloadable" | "downloading" | "available">;
    create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

declare var LanguageModel: LanguageModelStatic | undefined;
