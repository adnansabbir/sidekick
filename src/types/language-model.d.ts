interface LanguageModelPromptOptions {
    responseConstraint?: object;
    signal?: AbortSignal;
}

interface LanguageModelSession {
    prompt(
        input: string,
        options?: LanguageModelPromptOptions,
    ): Promise<string>;
}

interface LanguageModelPrompt {
    role: "system" | "user" | "assistant";
    content: string;
}

interface LanguageModelExpectedOutput {
    type: "text";
    languages: string[];
}

interface LanguageModelCreateOptions {
    initialPrompts?: LanguageModelPrompt[];
    expectedOutputs?: LanguageModelExpectedOutput[];
}

interface LanguageModelStatic {
    availability(): Promise<
        "unavailable" | "downloadable" | "downloading" | "available"
    >;
    create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

declare var LanguageModel: LanguageModelStatic | undefined;
