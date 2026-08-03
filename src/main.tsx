import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { APP_CONFIG } from "./config/appConfig";
import "./index.css";

document.title = APP_CONFIG.appName;

createRoot(document.getElementById("root")!).render(<App />);
