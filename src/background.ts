chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Give every tab its own side panel document instance (separate chat,
// separate Nano session) instead of sharing one global panel across tabs.
async function assignPanelToTab(tabId: number): Promise<void> {
    await chrome.sidePanel.setOptions({
        tabId,
        path: "src/sidepanel.html",
        enabled: true,
    });
}

function assignPanelToAllTabs(): void {
    chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (tab.id !== undefined) {
                void assignPanelToTab(tab.id);
            }
        }
    });
}

// Only sweep every open tab on real install/update/browser-startup moments —
// not on every MV3 service worker wake, which happens far more often.
chrome.runtime.onInstalled.addListener(assignPanelToAllTabs);
chrome.runtime.onStartup.addListener(assignPanelToAllTabs);

chrome.tabs.onCreated.addListener((tab) => {
    if (tab.id !== undefined) {
        void assignPanelToTab(tab.id);
    }
});
