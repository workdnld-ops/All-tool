import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const deployDir = path.join(root, "deploy");

const copyItems = [
  ["index.html", "index.html"],
  ["manifest.json", "manifest.json"],
  ["sw.js", "sw.js"],
  ["assets", "assets"],
  ["apps/credit-card-slip-stats", "apps/credit-card-slip-stats"],
  ["apps/purchase-accounting/dist", "apps/purchase-accounting/dist"],
  ["apps/drink-calculator", "apps/drink-calculator"],
  ["apps/cleaning-schedule", "apps/cleaning-schedule"],
  ["apps/celebration-calculator", "apps/celebration-calculator"],
  ["apps/schedule-record", "apps/schedule-record"],
  ["apps/todo-board", "apps/todo-board"],
  ["workers", "workers"],
];

await rm(deployDir, { recursive: true, force: true });
await mkdir(deployDir, { recursive: true });

for (const [source, target] of copyItems) {
  await cp(path.join(root, source), path.join(deployDir, target), {
    recursive: true,
    force: true,
  });
}
