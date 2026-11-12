import { defineConfig } from 'vite';

// Port 5174, damit das Zoo-Spiel (5173) parallel laufen kann.
// host: true → im WLAN erreichbar, zum Testen auf dem Tablet.
export default defineConfig({
  server: { host: true, port: 5174 },
  // no-cache: der Browser fragt jedes Mal nach, ob sich etwas geändert hat
  preview: { host: true, port: 5174, headers: { 'Cache-Control': 'no-cache' } },
});
