// @ts-check
import childProcess from "node:child_process";
import events from "node:events";
import readline from "node:readline";

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

    const closed = events.once(child, "close");
    const lines = readline.createInterface({ input: child.stdout });

    for await (const line of lines) {
      const split = line.trim().split(/\s+/).map(Number).filter(Boolean);
      const array = split.length === 4 ? split : [];
      const [inputPackets, inputBytes, outputPackets, outputBytes] = array;
      onSample?.({
        line,
        inputPackets,
        inputBytes,
        outputPackets,
        outputBytes,
        timestamp: new Date(),
      });
    }

    await closed;
  } catch {}
}
