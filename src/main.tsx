import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAnalytics } from "./lib/analytics";
import { initSentry } from "./lib/sentry";

// P0.5 — Initialize Sentry FIRST so render-phase errors are captured.
// No-op if VITE_SENTRY_DSN not set.
initSentry();

// Initialize product analytics (PostHog) — no-op if VITE_POSTHOG_KEY not set
initAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
