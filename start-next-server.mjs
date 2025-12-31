// @ts-check

import { spawn } from "node:child_process";

/**
 * @type {(options?: { signal?: AbortSignal }) => Promise<string>}
 */
export async function startNextServer({ signal } = {}) {
  /**
   * @type {string}
   */
  const url = await new Promise((resolve, reject) => {
    const child = spawn("node", [".next/standalone/server.js"], {
      env: {
        ...process.env,
        PORT: "4545",
      },
      shell: true,
      signal,
      stdio: "pipe",
    });

    child.stdout?.on("data", (data) => {
      const string = data.toString();
      if (string.includes("http://") || string.includes("https://")) {
        const regex = /http:\/\/\S+|https:\/\/\S+/;
        const match = string.match(regex);
        if (match) {
          const url = match.at(0).trim();
          resolve(url);
        }
      }
    });

    child.stderr?.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    child.on("error", (err) => {
      console.error("Failed to start Next.js server:", err);
      reject(err);
    });
  });
  return url;
}
