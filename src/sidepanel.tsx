 import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChatPage } from "@/pages/ChatPage";
import { useSystemTheme } from "@/hooks/use-system-theme";
import "./sidepanel.css";

function App() {
    useSystemTheme();
    return <ChatPage />;
}

const container = document.getElementById("root");
if (container) {
    createRoot(container).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}
