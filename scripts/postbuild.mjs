// `output: "standalone"` leaves static assets and public/ out of .next/standalone.
// Copy them in so `node .next/standalone/server.js` (and the Docker image) serves a complete app.
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const standalone = join(root, ".next", "standalone");
if (!existsSync(join(standalone, "server.js"))) {
  console.error("postbuild: .next/standalone/server.js not found; run `next build` with output: \"standalone\" first.");
  process.exit(1);
}
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
if (existsSync(join(root, "public"))) cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
console.log("postbuild: copied .next/static and public into .next/standalone");
