import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

let updateServiceWorker: ReturnType<typeof registerSW> | undefined;

updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateServiceWorker?.(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    setInterval(() => {
      void registration.update();
    }, 60 * 60 * 1000);
  },
});

createRoot(document.getElementById("root")!).render(<App />);
