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
