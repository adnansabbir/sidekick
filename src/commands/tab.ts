export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
    });
    return tab;
}

export async function execInActiveTab<T, A extends unknown[]>(
    func: (...args: A) => T,
    args: A,
): Promise<Awaited<T> | null> {
    const tab = await getActiveTab();
    if (!tab?.id) {
        return null;
    }

    try {
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func,
            args,
        });
        return (result ?? null) as Awaited<T> | null;
    } catch (error) {
        // Restricted pages (chrome://, Web Store, some PDFs) reject
        // executeScript entirely - degrade to no result instead of crashing.
        console.log("[execInActiveTab] executeScript failed:", error);
        return null;
    }
}
