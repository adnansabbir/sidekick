chrome.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return;
    const tabId = tab.id;

    // Neither call is awaited — open() needs the click's user gesture,
    // which is lost the instant anything is awaited first.
    chrome.sidePanel.setOptions({
        tabId,
        path: "src/sidepanel.html",
        enabled: true,
    });
    chrome.sidePanel
        .open({ tabId })
        .catch((error) => console.error("Failed to open side panel:", error));
});