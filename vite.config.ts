import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Forward local /api/* to the Express registration API during Vite dev
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            /node_modules[/\\]react[/\\]/.test(id) ||
            /node_modules[/\\]react-dom[/\\]/.test(id) ||
            /node_modules[/\\]react-router-dom[/\\]/.test(id) ||
            /node_modules[/\\]react-router[/\\]/.test(id)
          ) {
            return "vendor-react";
          }

          if (id.includes("@supabase")) {
            return "vendor-supabase";
          }

          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }

          return "vendor-utils";
        },
      },
    },
  },
}));
