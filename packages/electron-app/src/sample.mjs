// @ts-check
import childProcess from "node:child_process";
import events from "node:events";
import readline from "node:readline";

/**
 * @typedef {{
 *  inputErrors: number,
 *  inputBytes: number,
 *  inputPackets: number,
 *  line: string,
 *  outputErrors: number,
 *  outputBytes: number,
 *  outputPackets: number,
 *  timestamp: string
 * }} NetworkSample
 */

/**
 * @param {{ onSample?: (sample: NetworkSample) => void, signal?: AbortSignal }} [options]
 * @returns {Promise<void>}
 */
export async function sample({ onSample, signal } = { onSample: undefined, signal: undefined }) {
  try {
    const command = [
      `netstat`,
      `-I en0`, // Wi-Fi interface.
      `-b`, // Show bytes in and out.
      `-w 1`, // Update every second.
    ].join(` `);

    await using child = childProcess.spawn(command, {
      shell: true,
      signal,
      stdio: ["ignore", "pipe", "ignore"],
    });

    child.stdout.setEncoding("utf8");

    const closed = events.once(child, "close").catch(() => undefined);

    const lines = readline.createInterface({ input: child.stdout });

    for await (const line of lines) {
      const values = line.trim().split(/\s+/).map(Number);
      const isCorrectLength = values.length === 7;
      const isAllNumbers = values.every((value) => Number.isFinite(value));
      if (!isCorrectLength || !isAllNumbers) continue;

      const [inputPackets, inputErrors, inputBytes, outputPackets, outputErrors, outputBytes] =
        values;

      onSample?.({
        line,
        inputBytes,
        inputErrors,
        inputPackets,
        outputErrors,
        outputPackets,
        outputBytes,
        timestamp: new Date().toISOString(),
      });
    }

    await closed;
  } catch {}
}
