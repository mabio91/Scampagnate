import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const manualChunks = (id: string) => {
  if (!id.includes("/node_modules/")) return undefined;

  if (id.includes("/node_modules/lucide-react/dist/esm/icons/")) {
    const iconFile = id.split("/node_modules/lucide-react/dist/esm/icons/")[1] ?? "";
    const firstLetter = iconFile[0]?.toLowerCase() ?? "";
    if (firstLetter < "g") return "icons-a-f";
    if (firstLetter < "m") return "icons-g-l";
    if (firstLetter < "s") return "icons-m-r";
    return "icons-s-z";
  }

  if (id.includes("/node_modules/lucide-react/")) return "icons-core";

  const groups: Array<[string, string[]]> = [
    ["react-vendor", ["react/", "react-dom/", "scheduler/", "react-router/", "react-router-dom/", "@remix-run/router/", "next-themes/"]],
    ["query-vendor", ["@tanstack/"]],
    ["supabase-vendor", ["@supabase/"]],
    ["radix-vendor", ["@radix-ui/"]],
    ["form-vendor", ["react-hook-form/", "@hookform/", "zod/"]],
    ["editor-vendor", ["@tiptap/", "prosemirror-"]],
    ["motion-vendor", ["framer-motion/"]],
    ["date-vendor", ["date-fns/", "date-fns-tz/"]],
    ["pwa-vendor", ["workbox-", "vite-plugin-pwa/"]],
    ["visual-vendor", ["@tsparticles/", "tsparticles/", "embla-carousel-react/"]],
    ["ui-vendor", ["sonner/", "vaul/", "cmdk/", "input-otp/"]],
  ];

  for (const [chunkName, packages] of groups) {
    if (packages.some((packageName) => id.includes(`/node_modules/${packageName}`))) {
      return chunkName;
    }
  }

  return "vendor";
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.png",
        "pwa-512x512.png",
        "pwa-192x192.png",
        "pwa-maskable-512x512.png",
        "pwa-maskable-192x192.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        id: "/",
        name: "Scampagnate – Eventi & Community",
        short_name: "Scampagnate",
        description: "Scopri e partecipa a eventi outdoor, sport, aperitivi e esperienze culturali con la community Scampagnate.",
        theme_color: "#2d4a33",
        background_color: "#2d4a33",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["social", "lifestyle", "entertainment"],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,svg,woff2}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
}));
