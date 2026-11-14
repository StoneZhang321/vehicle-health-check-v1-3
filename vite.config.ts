/** 中文：独立静态构建，无账号服务和发布副作用。 English: Independent static build without account services or deployment side effects. */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  publicDir: "static",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  build: { target: "es2022", sourcemap: false },
});
