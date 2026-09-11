import MarkdownIt from "markdown-it";
import {
    findCommandInText,
    formatAgentTools,
    listCommands,
    peekBodySizes,
    runCommand,
} from "./commands";
import {
    appliedAiEnabled,
    appliedLanguage,
    openSettingsPage,
    setOnLanguageApplied,
} from "./settings";

const markdownRenderer = new MarkdownIt({ html: false });

const commandSuggestions = document.querySelector<HTMLDivElement>(
    "#command-suggestions",
)!;
const micButton = document.querySelector<HTMLButtonElement>("#mic-button")!;
const micIcon = document.querySelector<SVGElement>("#mic-icon")!;
const micStopIcon = document.querySelector<SVGElement>("#mic-stop-icon")!;
const micModePopup = document.querySelector<HTMLDivElement>("#mic-mode-popup")!;
const micModeSendButton =
    document.querySelector<HTMLButtonElement>("#mic-mode-send")!;
const micModeDictateButton =
    document.querySelector<HTMLButtonElement>("#mic-mode-dictate")!;
const textInput = document.querySelector<HTMLInputElement>("#text-input")!;
const sendButton = document.querySelector<HTMLButtonElement>("#send-button")!;
const messages = document.querySelector<HTMLDivElement>("#messages")!;
const menuButton = document.querySelector<HTMLButtonElement>("#menu-button")!;
const menuDropdown = document.querySelector<HTMLDivElement>("#menu-dropdown")!;
const settingsMenuItem = document.querySelector<HTMLButtonElement>(
    "#settings-menu-item",
)!;

function closeMenu(): void {
    menuDropdown.classList.add("hidden");
    menuButton.setAttribute("aria-expanded", "false");
}

menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = !menuDropdown.classList.contains("hidden");
    if (isOpen) {
        closeMenu();
    } else {
        menuDropdown.classList.remove("hidden");
        menuButton.setAttribute("aria-expanded", "true");
    }
});

document.addEventListener("click", (event) => {
    const target = event.target as Node;
    if (!menuButton.contains(target) && !menuDropdown.contains(target)) {
        closeMenu();
    }
});

settingsMenuItem.addEventListener("click", () => {
    closeMenu();
    openSettingsPage();
});

const ASSISTANT_PROSE_CLASSES =
    "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_p:not(:last-child)]:mb-2 [&_a]:underline [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1";

function addSystemNotice(text: string): void {
    const notice = document.createElement("div");
    notice.className =
        "mb-2 text-center text-xs text-neutral-500 dark:text-neutral-400";
    notice.textContent = text;
    messages.appendChild(notice);
    messages.scrollTop = messages.scrollHeight;
}

function addMessage(text: string, sender: "user" | "assistant"): void {
    const row = document.createElement("div");
    row.className = `mb-2 flex ${sender === "user" ? "justify-end" : "justify-start"}`;

    const bubble = document.createElement("div");
    bubble.className =
        sender === "user"
            ? "px-2.5 py-2 rounded-lg max-w-[80%] bg-blue-600 text-white"
            : `px-2.5 py-2 rounded-lg max-w-[80%] bg-black/5 dark:bg-white/5 ${ASSISTANT_PROSE_CLASSES}`;

    if (sender === "assistant") {
        bubble.innerHTML = markdownRenderer.render(text);
        for (const link of bubble.querySelectorAll("a")) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        }
    } else {
        bubble.textContent = text;
    }

    row.appendChild(bubble);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
}

const AGENT_RESPONSE_SCHEMA = {
    type: "object",
    properties: {
        type: { type: "string", enum: ["answer", "execute"] },
        answer: { type: "string" },
        commands: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    params: { type: "object" },
                },
                required: ["name"],
            },
        },
    },
    required: ["type"],
};

interface AgentResponse {
    type: "answer" | "execute";
    answer?: string;
    // Untrusted model output - shape isn't guaranteed, parse defensively.
    commands?: unknown[];
}

const MAX_AGENT_ROUNDS = 4;
const PROMPT_TIMEOUT_MS = 60000;

const GUARDRAILS = `- Never mention a command's name, that a command exists, or that you looked something up, in an "answer" value - not even if the user asks directly what commands, tools, or capabilities you have. Describe what you can help with in plain terms instead (e.g. "I can read this page's title and content").
- Keep answers short by default - a sentence or two of genuinely useful content, not just one or two words. This default is overridden whenever the user asks for detail, depth, elaboration, a specific length, or a word/sentence count in any way (not just the exact words "elaborate" or "go into detail") - in that case, give a full answer honoring what they asked for, even if it becomes much longer than usual.`;

let conversationHistory: LanguageModelPrompt[] = [];

async function createLanguageModelSession(
    history: LanguageModelPrompt[] = [],
): Promise<LanguageModelSession | null> {
    if (typeof LanguageModel === "undefined") {
        addSystemNotice("LanguageModel is not available in this context.");
        return null;
    }
    const availability = await LanguageModel.availability();
    if (availability !== "available") {
        addSystemNotice(
            `Gemini Nano is not ready yet (status: ${availability}).`,
        );
        return null;
    }
    return LanguageModel.create({
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        initialPrompts: [
            {
                role: "system",
                content: `You are Sidekick, an AI assistant built into a Chrome browser extension side panel.

ROLE:
- You are always attached to the user's active browser tab. When the user says "this site", "this page", or asks a question without naming a subject, assume they mean the active tab, not a URL they need to provide.
- Every message already includes the tab's title, URL, and description under "Current tab" - that is command.read.meta_data's result, already given to you. Never request it again unless told the page changed.
- Each message also lists other commands you can use to read more, each with a name and its own params description (if any).

RESPONSE FORMAT:
- Respond only as JSON: {"type": "answer", "answer": "..."} when you can answer the user directly, or {"type": "execute", "commands": [{"name": commandName, "params": paramsObject}]} when you need to run one or more of the listed commands first.
- paramsObject must match the exact param names that specific command lists (not a generic key) - if a command lists no params, use an empty object {} for it.
- If a command's result does not answer the question, do not settle for an incomplete answer - request a different command (or the same command with different params) instead of giving up.
- If a command's result is empty, missing, or malformed, do not fabricate placeholder content or mention any command's name in your answer - say plainly that you do not have that information, or request the command again.

GUARDRAILS:
${GUARDRAILS}`,
            },
            ...history,
        ],
    });
}

let languageModelSession = await createLanguageModelSession();

const micIdleClasses = ["bg-black/5", "dark:bg-white/10", "text-inherit"];
const micListeningClasses = ["bg-red-600", "dark:bg-red-700", "text-white"];

let voiceMode: "send" | "dictate" = "send";
let dictationBuffer = "";
let lastTabUrl: string | undefined;
let cachedBodySizes: { text: number; full: number } | null = null;

const resetButton = document.querySelector<HTMLButtonElement>("#reset-button")!;

resetButton.addEventListener("click", () => {
    if (!confirm("Reset this conversation? This can't be undone.")) {
        return;
    }
    messages.innerHTML = "";
    textInput.value = "";
    dictationBuffer = "";
    lastTabUrl = undefined;
    cachedBodySizes = null;
    conversationHistory = [];
    void createLanguageModelSession().then((session) => {
        languageModelSession = session;
    });
});

function closeMicMenu(): void {
    micModePopup.classList.add("hidden");
    micButton.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", (event) => {
    const target = event.target as Node;
    if (!micButton.contains(target) && !micModePopup.contains(target)) {
        closeMicMenu();
    }
});

async function runAgentLoop(userText: string): Promise<void> {
    const session = languageModelSession;
    if (!session) {
        return;
    }

    try {
        const metaData = await runCommand("command.read.meta_data");
        const currentUrl =
            metaData && typeof metaData.url === "string"
                ? metaData.url
                : undefined;
        const tabChanged = Boolean(
            currentUrl && lastTabUrl && currentUrl !== lastTabUrl,
        );

        if (!lastTabUrl || tabChanged || cachedBodySizes === null) {
            cachedBodySizes = await peekBodySizes();
        }
        const bodySizes = cachedBodySizes;
        lastTabUrl = currentUrl ?? lastTabUrl;

        const toolsText = bodySizes
            ? `${formatAgentTools()}\n(command.read.body sizes right now — text: ~${bodySizes.text} chars, full: ~${bodySizes.full} chars)`
            : formatAgentTools();

        const tabChangedNote = tabChanged
            ? "\n\nNote: the active tab changed since your last message - any previously fetched body content no longer applies to this page."
            : "";
        const guardrailReminder = `Guardrail reminder:\n${GUARDRAILS}${tabChangedNote}`;
        let roundContent = `Current tab: ${JSON.stringify(metaData)}\n\nUser message: ${userText}`;

        for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
            const prompt = `You can use these commands to get more context if needed:\n${toolsText}\n\n${roundContent}\n\n${guardrailReminder}`;
            console.log(`round ${round} prompt sent:`, prompt);

            let response: string;
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                PROMPT_TIMEOUT_MS,
            );
            try {
                response = await session.prompt(prompt, {
                    responseConstraint: AGENT_RESPONSE_SCHEMA,
                    signal: controller.signal,
                });
            } catch (error) {
                console.log("prompt failed:", error);
                const errorName =
                    error instanceof DOMException ? error.name : undefined;
                if (errorName === "AbortError") {
                    addSystemNotice(
                        "That took too long, reconnecting the assistant.",
                    );
                    void createLanguageModelSession(conversationHistory).then(
                        (newSession) => {
                            languageModelSession = newSession;
                        },
                    );
                } else if (errorName === "QuotaExceededError") {
                    addSystemNotice(
                        "That was too much for Sidekick to process at once.",
                    );
                } else {
                    addSystemNotice("An error occurred.");
                }
                return;
            } finally {
                clearTimeout(timeoutId);
            }
            console.log("raw response:", response);

            const parsed = JSON.parse(response) as AgentResponse;
            console.log("parsed response:", parsed);

            if (parsed.type === "answer") {
                addMessage(parsed.answer ?? "", "assistant");
                conversationHistory.push({
                    role: "assistant",
                    content: parsed.answer ?? "",
                });
                return;
            }

            const validEntries = (parsed.commands ?? []).flatMap((entry) => {
                const isValidEntry =
                    typeof entry === "object" &&
                    entry !== null &&
                    !Array.isArray(entry) &&
                    typeof (entry as { name?: unknown }).name === "string";
                if (!isValidEntry) {
                    console.log("Skipping malformed command entry:", entry);
                    return [];
                }
                const { name, params } = entry as {
                    name: string;
                    params?: unknown;
                };
                const safeParams =
                    params &&
                    typeof params === "object" &&
                    !Array.isArray(params)
                        ? (params as Record<string, unknown>)
                        : undefined;
                return [{ name, safeParams }];
            });

            const resultEntries = await Promise.all(
                validEntries.map(
                    async ({ name, safeParams }) =>
                        [name, await runCommand(name, safeParams)] as const,
                ),
            );
            roundContent = `Command results: ${JSON.stringify(Object.fromEntries(resultEntries))}`;
        }

        addSystemNotice("Sidekick couldn't finish gathering context in time.");
    } finally {
        console.log("=".repeat(60));
    }
}

let isAgentBusy = false;
let isMicSendBlocking = false;

function updateSendButtonState(): void {
    sendButton.disabled = isAgentBusy || isMicSendBlocking;
}

async function sendMessage(text: string): Promise<void> {
    if (isAgentBusy) {
        addSystemNotice("Still working on the previous message - please wait.");
        return;
    }

    addMessage(text, "user");
    conversationHistory.push({ role: "user", content: text });

    const commandName = findCommandInText(text);
    if (commandName) {
        const result = await runCommand(commandName);
        addMessage(
            `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
            "assistant",
        );
        return;
    }

    if (appliedAiEnabled && languageModelSession) {
        isAgentBusy = true;
        updateSendButtonState();
        try {
            await runAgentLoop(text);
        } finally {
            isAgentBusy = false;
            updateSendButtonState();
        }
    }
}

function submitTextInput(): void {
    const text = textInput.value.trim();
    if (!text) {
        return;
    }
    textInput.value = "";
    dictationBuffer = "";
    hideCommandSuggestions();
    void sendMessage(text);
}

sendButton.addEventListener("click", submitTextInput);

let filteredCommands: { name: string; description: string }[] = [];
let highlightedCommandIndex = -1;

function hideCommandSuggestions(): void {
    commandSuggestions.classList.add("hidden");
    commandSuggestions.innerHTML = "";
    filteredCommands = [];
    highlightedCommandIndex = -1;
}

function selectCommandSuggestion(name: string): void {
    textInput.value = `/${name} `;
    hideCommandSuggestions();
    textInput.focus();
}

function renderCommandSuggestions(): void {
    commandSuggestions.innerHTML = "";
    filteredCommands.forEach((command, index) => {
        const item = document.createElement("button");
        item.type = "button";
        item.role = "option";
        item.className = `flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm cursor-pointer ${
            index === highlightedCommandIndex
                ? "bg-black/5 dark:bg-white/10"
                : ""
        }`;

        const name = document.createElement("span");
        name.className = "font-medium";
        name.textContent = `/${command.name}`;

        const description = document.createElement("span");
        description.className =
            "text-xs text-neutral-500 dark:text-neutral-400";
        description.textContent = command.description;

        item.append(name, description);

        // mousedown (not click) fires before the input would blur, so
        // preventing default here keeps focus on the input entirely.
        item.addEventListener("mousedown", (event) => {
            event.preventDefault();
            selectCommandSuggestion(command.name);
        });

        commandSuggestions.appendChild(item);
    });
    commandSuggestions.classList.remove("hidden");
}

function updateCommandSuggestions(): void {
    const match = /^\/(\S*)$/.exec(textInput.value);
    if (!match) {
        hideCommandSuggestions();
        return;
    }

    const prefix = match[1].toLowerCase();
    filteredCommands = listCommands().filter((command) =>
        command.name.toLowerCase().startsWith(prefix),
    );

    if (filteredCommands.length === 0) {
        hideCommandSuggestions();
        return;
    }

    highlightedCommandIndex = 0;
    renderCommandSuggestions();
}

textInput.addEventListener("input", updateCommandSuggestions);
textInput.addEventListener("blur", hideCommandSuggestions);

textInput.addEventListener("keydown", (event) => {
    const suggestionsOpen = !commandSuggestions.classList.contains("hidden");

    if (suggestionsOpen) {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            highlightedCommandIndex =
                (highlightedCommandIndex + 1) % filteredCommands.length;
            renderCommandSuggestions();
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            highlightedCommandIndex =
                (highlightedCommandIndex - 1 + filteredCommands.length) %
                filteredCommands.length;
            renderCommandSuggestions();
            return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            selectCommandSuggestion(
                filteredCommands[highlightedCommandIndex].name,
            );
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            hideCommandSuggestions();
            return;
        }
    }

    if (event.key === "Enter") {
        event.preventDefault();
        submitTextInput();
    }
});

const SpeechRecognitionCtor =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;

if (!SpeechRecognitionCtor) {
    addSystemNotice("SpeechRecognition is not available in this context.");
} else {
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = appliedLanguage;

    setOnLanguageApplied((lang) => {
        recognition.lang = lang;
    });

    let userStoppedListening = true;

    function updateMicUI(isListening: boolean): void {
        if (isListening) {
            micButton.classList.remove(...micIdleClasses);
            micButton.classList.add(...micListeningClasses);
            micIcon.classList.add("hidden");
            micStopIcon.classList.remove("hidden");
            textInput.placeholder = "Listening...";
        } else {
            micButton.classList.remove(...micListeningClasses);
            micButton.classList.add(...micIdleClasses);
            micIcon.classList.remove("hidden");
            micStopIcon.classList.add("hidden");
            textInput.placeholder = "Type or speak...";
        }
        isMicSendBlocking = isListening && voiceMode === "send";
        updateSendButtonState();
    }

    function startListening(mode: "send" | "dictate"): void {
        voiceMode = mode;
        dictationBuffer = "";
        userStoppedListening = false;
        closeMicMenu();
        try {
            recognition.start();
        } catch {
            // already starting/running; ignore and wait for onstart/onend
        }
    }

    recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            if (voiceMode === "send") {
                if (result.isFinal) {
                    void sendMessage(transcript);
                } else {
                    interim += transcript;
                }
            } else {
                if (result.isFinal) {
                    dictationBuffer = dictationBuffer
                        ? `${dictationBuffer} ${transcript}`
                        : transcript;
                } else {
                    interim += transcript;
                }
            }
        }

        if (voiceMode === "send") {
            textInput.value = interim;
        } else {
            textInput.value = interim
                ? `${dictationBuffer} ${interim}`.trim()
                : dictationBuffer;
        }
    };

    recognition.onerror = (event) => {
        addSystemNotice(`Error: ${event.error}`);
    };

    recognition.onstart = () => {
        updateMicUI(true);
    };

    recognition.onend = () => {
        if (!userStoppedListening) {
            // Chrome can end the session on its own (e.g. after a pause in
            // speech) even with continuous=true. Keep going until the user
            // explicitly clicks stop.
            try {
                recognition.start();
            } catch {
                // already starting/running; ignore and wait for onstart/onend
            }
            return;
        }
        updateMicUI(false);
    };

    micButton.addEventListener("click", (event) => {
        if (!userStoppedListening) {
            userStoppedListening = true;
            recognition.stop();
            return;
        }
        event.stopPropagation();
        const isOpen = !micModePopup.classList.contains("hidden");
        if (isOpen) {
            closeMicMenu();
        } else {
            micModePopup.classList.remove("hidden");
            micButton.setAttribute("aria-expanded", "true");
        }
    });

    micModeSendButton.addEventListener("click", () => startListening("send"));
    micModeDictateButton.addEventListener("click", () =>
        startListening("dictate"),
    );
}
