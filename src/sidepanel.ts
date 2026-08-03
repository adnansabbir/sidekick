import MarkdownIt from "markdown-it";

const markdownRenderer = new MarkdownIt({ html: false });

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
const settingsPage = document.querySelector<HTMLDivElement>("#settings-page")!;
const settingsBackButton = document.querySelector<HTMLButtonElement>(
    "#settings-back-button",
)!;
const settingsSaveButton = document.querySelector<HTMLButtonElement>(
    "#settings-save-button",
)!;
const settingsCancelButton = document.querySelector<HTMLButtonElement>(
    "#settings-cancel-button",
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
    settingsPage.classList.remove("hidden");
});

const LANGUAGE_STORAGE_KEY = "voiceAssistant.language";
const DEFAULT_LANGUAGE = "en-US";

const languageSelect =
    document.querySelector<HTMLSelectElement>("#language-select")!;

let appliedLanguage =
    localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? DEFAULT_LANGUAGE;
languageSelect.value = appliedLanguage;

let onLanguageApplied: ((lang: string) => void) | null = null;

function closeSettingsDiscardingChanges(): void {
    languageSelect.value = appliedLanguage;
    settingsPage.classList.add("hidden");
}

settingsBackButton.addEventListener("click", closeSettingsDiscardingChanges);
settingsCancelButton.addEventListener("click", closeSettingsDiscardingChanges);

settingsSaveButton.addEventListener("click", () => {
    appliedLanguage = languageSelect.value;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, appliedLanguage);
    onLanguageApplied?.(appliedLanguage);
    settingsPage.classList.add("hidden");
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

async function createLanguageModelSession(): Promise<LanguageModelSession | null> {
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
        initialPrompts: [
            {
                role: "system",
                content:
                    "Keep responses short by default — a sentence or two of genuinely useful content, not just one or two words. Only give a longer, more detailed answer when the user explicitly asks you to elaborate, explain more, or go into detail.",
            },
        ],
    });
}

let languageModelSession = await createLanguageModelSession();

const micIdleClasses = ["bg-black/5", "dark:bg-white/10", "text-inherit"];
const micListeningClasses = ["bg-red-600", "dark:bg-red-700", "text-white"];

let voiceMode: "send" | "dictate" = "send";
let dictationBuffer = "";

const resetButton = document.querySelector<HTMLButtonElement>("#reset-button")!;

resetButton.addEventListener("click", () => {
    if (!confirm("Reset this conversation? This can't be undone.")) {
        return;
    }
    messages.innerHTML = "";
    textInput.value = "";
    dictationBuffer = "";
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

async function sendMessage(text: string): Promise<void> {
    addMessage(text, "user");
    if (languageModelSession) {
        const response = await languageModelSession.prompt(text);
        addMessage(response, "assistant");
    }
}

function submitTextInput(): void {
    const text = textInput.value.trim();
    if (!text) {
        return;
    }
    textInput.value = "";
    dictationBuffer = "";
    void sendMessage(text);
}

sendButton.addEventListener("click", submitTextInput);

textInput.addEventListener("keydown", (event) => {
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

    onLanguageApplied = (lang) => {
        recognition.lang = lang;
    };

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
        sendButton.disabled = isListening && voiceMode === "send";
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
