import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChatPage } from "@/pages/ChatPage";
import "./sidepanel.css";

function App() {
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
