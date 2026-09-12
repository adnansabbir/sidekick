import { useEffect, useMemo, useState } from "react";
import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    WebSpeechDictationAdapter,
    type ChatModelAdapter,
} from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { MicPermissionNotice } from "@/components/MicPermissionNotice";
import { GuardedDictationAdapter } from "@/lib/dictation";
import { subscribeMicPermission } from "@/lib/mic-permission";

// Placeholder adapter — echoes the input back. Real Gemini Nano wiring
// replaces this once the UI itself is confirmed working.
const echoAdapter: ChatModelAdapter = {
    async run({ messages }) {
        const lastMessage = messages[messages.length - 1];
        const text = lastMessage?.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("");
        return {
            content: [{ type: "text", text: `You said: ${text}` }],
        };
    },
};

export function ChatPage() {
    const [showMicNotice, setShowMicNotice] = useState(false);

    // Undefined where the browser has no SpeechRecognition: the runtime then
    // reports dictation as unavailable and the composer hides the mic button.
    const dictation = useMemo(
        () =>
            WebSpeechDictationAdapter.isSupported()
                ? new GuardedDictationAdapter(() => setShowMicNotice(true))
                : undefined,
        [],
    );
    const runtime = useLocalRuntime(echoAdapter, { adapters: { dictation } });

    useEffect(
        () =>
            subscribeMicPermission((state) => {
                if (state === "granted") setShowMicNotice(false);
            }),
        [],
    );

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1">
                    <Thread />
                </div>
                {showMicNotice && (
                    <MicPermissionNotice
                        onDismiss={() => setShowMicNotice(false)}
                    />
                )}
            </div>
        </AssistantRuntimeProvider>
    );
}
