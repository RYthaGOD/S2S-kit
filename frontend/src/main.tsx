import { Buffer } from "buffer";
// @solana/web3.js expects Node's Buffer global in the browser.
(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;

import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
