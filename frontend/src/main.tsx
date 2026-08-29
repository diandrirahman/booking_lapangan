import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { ThemeProvider } from "./theme/ThemeProvider";
import "@fontsource-variable/plus-jakarta-sans";
import "./styles.css";
import { ServerStateProvider } from "./api/serverState";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <ServerStateProvider>
          <App />
        </ServerStateProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
