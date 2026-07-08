import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import "./styles/globals.css";

const rootEl = document.getElementById("root");
if (rootEl === null) {
  throw new Error("Root element #root not found in DOM");
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
