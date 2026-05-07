import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 5173,
    hmr: { overlay: false },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split heavy dependencies into their own chunks so the main bundle
        // ships faster on first paint and chunk caches survive route changes.
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("three"))                return "three";
            if (id.includes("recharts"))             return "recharts";
            if (id.includes("framer-motion"))        return "framer-motion";
            if (id.includes("@radix-ui"))            return "radix";
            if (id.includes("react-router-dom"))     return "router";
            if (id.includes("@tanstack/react-query"))return "query";
            if (id.includes("lenis"))                return "lenis";
            if (id.includes("date-fns"))             return "date-fns";
            if (id.includes("lucide-react"))         return "icons";
          }
        },
      },
    },
  },
}));
