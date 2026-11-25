import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./ui/App";
import { cargar, fijarHash, CLAVE_DEMO } from "./data/store";
import { hashClave } from "./domain/seguridad";

async function iniciar() {
  cargar();
  fijarHash(await hashClave(CLAVE_DEMO));
  createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
  if ("serviceWorker" in navigator && import.meta.env.PROD) navigator.serviceWorker.register("./sw.js").catch(() => {});
}
iniciar();
