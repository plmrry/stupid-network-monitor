// @ts-check

import { spawn } from "node:child_process";

/**
 * @type {() => Promise<void>}
 */
export async function buildNextServer() {
  await new Promise((resolve, reject) => {
    const child = spawn("turbo", ["run", "next-build"], {
      shell: true,
      stdio: "inherit",
    });

    child.on("error", (err) => {
      console.error("Failed to build Next.js server:", err);
      reject(err);
    });

    child.on("exit", (code) => {
      console.log("exited");
      if (code === 0) {
        resolve(void 0);
      } else {
        reject(new Error(`Next.js build process exited with code ${code}`));
      }
    });
  });
}
