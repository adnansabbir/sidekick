// Chrome can't show a mic prompt inside a side panel — the request is
// auto-dismissed and the state stays "prompt" — so read the state rather than
// requesting, and send the user to the options page to grant it.

export type MicPermissionState = PermissionState | "unknown";

let currentState: MicPermissionState = "unknown";
const listeners = new Set<(state: MicPermissionState) => void>();

const setState = (next: MicPermissionState) => {
    if (next === currentState) return;
    currentState = next;
    for (const listener of listeners) listener(next);
};

// Kept live up front so getMicPermission() can stay synchronous — listen()
// needs its answer immediately.
void navigator.permissions
    ?.query({ name: "microphone" as PermissionName })
    .then((status) => {
        setState(status.state);
        status.addEventListener("change", () => setState(status.state));
    })
    // No Permissions API: stay permissive and still attempt the mic.
    .catch(() => setState("unknown"));

export const getMicPermission = (): MicPermissionState => currentState;

export const subscribeMicPermission = (
    listener: (state: MicPermissionState) => void,
) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

// Whether a dictation attempt has happened without a grant — separate from
// the permission state itself, since "denied"/"prompt" alone doesn't tell you
// whether the user has actually tried the mic button yet.
let noticeNeeded = false;
const noticeListeners = new Set<(needed: boolean) => void>();

const setNoticeNeeded = (next: boolean) => {
    if (next === noticeNeeded) return;
    noticeNeeded = next;
    for (const listener of noticeListeners) listener(next);
};

export const requestMicNotice = () => setNoticeNeeded(true);
export const dismissMicNotice = () => setNoticeNeeded(false);
export const isMicNoticeNeeded = (): boolean => noticeNeeded;

export const subscribeMicNotice = (listener: (needed: boolean) => void) => {
    noticeListeners.add(listener);
    return () => {
        noticeListeners.delete(listener);
    };
};
