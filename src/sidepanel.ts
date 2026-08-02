const micButton = document.querySelector<HTMLButtonElement>("#mic-button")!;
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

function addMessage(text: string): void {
    const bubble = document.createElement("div");
    bubble.className =
        "mb-2 px-2.5 py-2 rounded-lg max-w-[80%] bg-black/5 dark:bg-white/5";
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
}

const micIdleClasses = ["bg-black/5", "dark:bg-white/10", "text-inherit"];
const micListeningClasses = ["bg-red-600", "dark:bg-red-700", "text-white"];

let voiceMode: "send" | "dictate" = "send";
let dictationBuffer = "";

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

sendButton.addEventListener("click", () => {
    const text = textInput.value.trim();
    if (!text) {
        return;
    }
    addMessage(text);
    textInput.value = "";
    dictationBuffer = "";
});

const SpeechRecognitionCtor =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;

if (!SpeechRecognitionCtor) {
    addMessage("SpeechRecognition is not available in this context.");
} else {
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = appliedLanguage;

    onLanguageApplied = (lang) => {
        recognition.lang = lang;
    };

    let listening = false;

    function startListening(mode: "send" | "dictate"): void {
        voiceMode = mode;
        dictationBuffer = "";
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
                    addMessage(transcript);
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
        addMessage(`Error: ${event.error}`);
    };

    recognition.onstart = () => {
        listening = true;
        micButton.classList.remove(...micIdleClasses);
        micButton.classList.add(...micListeningClasses);
        textInput.placeholder = "Listening...";
    };

    recognition.onend = () => {
        listening = false;
        micButton.classList.remove(...micListeningClasses);
        micButton.classList.add(...micIdleClasses);
        textInput.placeholder = "Type or speak...";
    };

    micButton.addEventListener("click", (event) => {
        if (listening) {
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
