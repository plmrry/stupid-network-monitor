// @ts-check

import { spawn } from "node:child_process";
import fs from "node:fs/promises";

function start() {
  console.log("Starting dev server...");

  const child = spawn("pnpm dev", {
    detached: false,
    shell: true,
    stdio: "inherit",
  });

  return child;
}

const events = fs.watch("./main.mjs");

// Start the initial process
let child = start();

for await (const event of events) {
  console.log(`\nFile changed (${event.eventType}), restarting...`);

  // Small delay to ensure cleanup
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Start a new process
  console.log("pid before:", child.pid);
}
