import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://pepecchy.github.io",
  base: "/machi-navi",
  srcDir: "./site",
  outDir: "./dist",
  trailingSlash: "always",
});
