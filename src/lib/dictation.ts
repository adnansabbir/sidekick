import { WebSpeechDictationAdapter } from "@assistant-ui/react";
import { getMicPermission } from "./mic-permission";

// assistant-ui only console.errors a failed dictation, so a missing grant looks
// like a mic button that does nothing. This adds a callback for that case.
export class GuardedDictationAdapter extends WebSpeechDictationAdapter {
    readonly #onPermissionMissing: () => void;

    constructor(onPermissionMissing: () => void) {
        super();
        this.#onPermissionMissing = onPermissionMissing;
    }

    override listen() {
        if (getMicPermission() !== "granted") this.#onPermissionMissing();
        // Started anyway — the session ending is what resets the mic button.
        return super.listen();
    }
}
