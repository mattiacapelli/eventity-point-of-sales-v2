import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app.js";
import { ToastProvider } from "./components/Toast.js";
import "./styles/globals.css";

const rootEl = document.getElementById("root");
if (rootEl === null) {
  throw new Error("Root element #root not found in DOM");
}

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
