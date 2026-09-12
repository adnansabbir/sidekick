import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ChatPage } from "@/pages/ChatPage";
import "./sidepanel.css";

function App() {
    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const applyTheme = (source: MediaQueryList | MediaQueryListEvent) => {
            document.documentElement.classList.toggle("dark", source.matches);
        };
        applyTheme(media);
        media.addEventListener("change", applyTheme);
        return () => media.removeEventListener("change", applyTheme);
    }, []);

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
