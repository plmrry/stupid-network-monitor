// @ts-check

import { spawn } from "node:child_process";
import fs from "node:fs/promises";

let started = false;
let abortController = new AbortController();

function start() {
  console.log("Starting");

  started = true;

  const child = spawn("pnpm dev", {
    shell: true,
    signal: abortController.signal,
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });

  child.on("message", (msg) => {
    console.log("Message from child:", msg);
  });

  child.on("error", () => {
    // process.exit(1);
  });
}

start();

async function restart() {
  console.log("Stopping");

  abortController.abort();
  abortController = new AbortController();

  await new Promise((resolve) => setTimeout(resolve, 1000));

  start();
}

const events = fs.watch("./main.mjs");

let lastEvent = Date.now();

for await (const event of events) {
  console.log(`Event: ${event.eventType}`);
  const sinceLast = Date.now() - lastEvent;
  if (started && sinceLast < 3000) {
    console.log("Ignoring event, too soon:", sinceLast);
    continue;
  }

  console.log(`Restarting after ${sinceLast}ms`);

  restart();

  lastEvent = Date.now();
}

process.on("SIGINT", () => {
  console.log("SIGINT");
  abortController?.abort();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM");
  abortController?.abort();
  process.exit(0);
});
