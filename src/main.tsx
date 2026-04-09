import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAnalytics } from "./lib/analytics";

// Initialize product analytics (PostHog) — no-op if VITE_POSTHOG_KEY not set
initAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
