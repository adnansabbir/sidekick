import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./sidepanel.css";

function App() {
    return (
        <h1 className="p-4 text-lg font-semibold">Sidekick (React scaffold)</h1>
    );
}

const container = document.getElementById("root");
if (container) {
    createRoot(container).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
}
