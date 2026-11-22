import { spawnSync } from "node:child_process";
import { unwatchFile, watchFile, type Stats } from "node:fs";
import { resolve, sep } from "node:path";
import { defineConfig } from "vite";

const generator = resolve("scripts/build-status.ts");
const assets = resolve("status");
const inputs = [generator, resolve("scripts/status-model.ts")];
const manifest = resolve("dist/manifest.json");

function build() {
  const result = spawnSync(process.execPath, [generator, "--dev"], { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status === 0;
}

export default defineConfig({
  root: "site",
  server: { port: 8788, fs: { allow: [resolve("site")] } },
  plugins: [
    {
      name: "catalogue-status",
      configureServer(server) {
        if (!build()) throw new Error("Could not build the catalogue dashboard");
        let pending: NodeJS.Timeout;
        function scheduleBuild() {
          clearTimeout(pending);
          pending = setTimeout(build, 100);
        }
        server.watcher.add([...inputs, assets]);
        server.watcher.on("all", (_, file) => {
          const path = resolve(file);
          if (inputs.includes(path) || path.startsWith(assets + sep)) scheduleBuild();
        });
        // The manifest can appear after startup when a local snapshot is built for the first time.
        function onManifestChange(current: Stats) {
          if (current.isFile()) scheduleBuild();
        }
        watchFile(manifest, { interval: 500, persistent: false }, onManifestChange);
        server.httpServer?.once("close", () => {
          clearTimeout(pending);
          unwatchFile(manifest, onManifestChange);
        });
      },
    },
  ],
});
