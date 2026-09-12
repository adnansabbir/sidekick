import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    WebSpeechDictationAdapter,
    type ChatModelAdapter,
} from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

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
    const runtime = useLocalRuntime(echoAdapter, {
        adapters: { dictation: new WebSpeechDictationAdapter() },
    });
    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <Thread />
        </AssistantRuntimeProvider>
    );
}
