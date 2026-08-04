const LANGUAGE_STORAGE_KEY = "voiceAssistant.language";
const DEFAULT_LANGUAGE = "en-US";
const AI_ENABLED_STORAGE_KEY = "voiceAssistant.aiEnabled";

const settingsPage = document.querySelector<HTMLDivElement>("#settings-page")!;
const languageSelect =
    document.querySelector<HTMLSelectElement>("#language-select")!;
const aiEnabledToggle =
    document.querySelector<HTMLInputElement>("#ai-enabled-toggle")!;
const settingsBackButton = document.querySelector<HTMLButtonElement>(
    "#settings-back-button",
)!;
const settingsSaveButton = document.querySelector<HTMLButtonElement>(
    "#settings-save-button",
)!;
const settingsCancelButton = document.querySelector<HTMLButtonElement>(
    "#settings-cancel-button",
)!;

export let appliedLanguage =
    localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? DEFAULT_LANGUAGE;
languageSelect.value = appliedLanguage;

export let appliedAiEnabled =
    localStorage.getItem(AI_ENABLED_STORAGE_KEY) !== "false";
aiEnabledToggle.checked = appliedAiEnabled;

let onLanguageApplied: ((lang: string) => void) | null = null;

export function setOnLanguageApplied(callback: (lang: string) => void): void {
    onLanguageApplied = callback;
}

export function openSettingsPage(): void {
    settingsPage.classList.remove("hidden");
}

function closeSettingsDiscardingChanges(): void {
    languageSelect.value = appliedLanguage;
    aiEnabledToggle.checked = appliedAiEnabled;
    settingsPage.classList.add("hidden");
}

settingsBackButton.addEventListener("click", closeSettingsDiscardingChanges);
settingsCancelButton.addEventListener("click", closeSettingsDiscardingChanges);

settingsSaveButton.addEventListener("click", () => {
    appliedLanguage = languageSelect.value;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, appliedLanguage);
    onLanguageApplied?.(appliedLanguage);

    appliedAiEnabled = aiEnabledToggle.checked;
    localStorage.setItem(AI_ENABLED_STORAGE_KEY, String(appliedAiEnabled));

    settingsPage.classList.add("hidden");
});
