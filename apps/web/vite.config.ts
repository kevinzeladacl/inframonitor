import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

export default defineConfig({
  // Cargar .env desde la raíz del monorepo (un único .env compartido por api y web)
  envDir: path.resolve(__dirname, "../../"),
  envPrefix: ["VITE_", "INFRA_"],

  server: {
    host: "0.0.0.0",
    port: parseInt(process.env.INFRA_WEB_PORT ?? "5274"),
  },

  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
  ],
});
