import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  build: {
    // Keep the bundle inside this extension: the server resolves `../web/dist` from src/.
    outDir: "dist",
    emptyOutDir: true,
  },
});
