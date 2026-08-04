import { registerCommand } from "./registry";

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
    });
    return tab;
}

async function readSiteMetadata(): Promise<void> {
    const tab = await getActiveTab();
    if (!tab?.id) {
        console.log("[/read] No active tab found.");
        return;
    }

    const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
            title: document.title,
            url: location.href,
            description:
                document
                    .querySelector('meta[name="description"]')
                    ?.getAttribute("content") ?? null,
        }),
    });

    console.log("[/read] site metadata:", result);
}

registerCommand(
    "read",
    "Log the current page's title, URL, and meta description",
    readSiteMetadata,
);
