// @ts-check

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { logSignals } from "./log-signals.mjs";

logSignals(process, "non-exit");

function start() {
  console.log("Starting dev server...");

  const child = spawn("pnpm dev", {
    detached: false,
    shell: true,
    stdio: "inherit",
  });

  return child;
}

const child = start();

console.log(`pid: ${child.pid}`);

const events = fs.watch("./main.mjs");

for await (const event of events) {
  console.log(`Event: ${JSON.stringify(event)}`);
}
