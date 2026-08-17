// @ts-check

import fs from "node:fs/promises";
import { app } from "electron";
import { MAX_BARS } from "./get-tray-image.mjs";
import { sample } from "./sample.mjs";
import { speedTest } from "./speed-test.mjs";

/**
 * The `NetworkDatum` type represents network data at a point in time.
 *
 * @typedef {{
 *  inputBytes: number;
 *  outputBytes: number;
 *  timestamp: string;
 * }} NetworkDatum
 */

/**
 * File where history is stored in the `userData` folder.
 */
const HISTORY_FILE_NAME = "history.json";

/**
 * Store 1 minute of history.
 *
 * @constant {number}
 */
const MAX_HISTORY_LENGTH = 1 * 60;

/**
 * Create zero-value placeholders at one-second intervals.
 *
 * @returns {NetworkDatum[]}
 */
function createPlaceholderHistory() {
  const latestTimestamp = Date.now() - 1_000;

  return Array.from({ length: MAX_BARS }, (_, index) => ({
    inputBytes: 0,
    outputBytes: 0,
    timestamp: new Date(latestTimestamp - (MAX_BARS - index - 1) * 1_000).toISOString(),
  }));
}

/**
 * Attempt to read existing history from `userData` folder.
 *
 * @returns {Promise<NetworkDatum[] | undefined>}
 */
async function readHistory() {
  const userDataPath = app.getPath("userData");
  const historyPath = `${userDataPath}/${HISTORY_FILE_NAME}`;
  try {
    const parsed = await import(historyPath, { with: { type: "json" } }).then(
      (module) => module.default,
    );
    if (!parsed) return undefined;
    if (!Array.isArray(parsed)) return undefined;
    return parsed
      .filter(function isNetworkDatum(value) {
        if (!value || typeof value !== "object") return false;
        return (
          Number.isFinite(value.inputBytes) &&
          Number.isFinite(value.outputBytes) &&
          Number.isFinite(Date.parse(value.timestamp))
        );
      })
      .slice(-MAX_HISTORY_LENGTH)
      .map(({ inputBytes, outputBytes, timestamp }) => ({ inputBytes, outputBytes, timestamp }));
  } catch {
    return undefined;
  }
}

/**
 * Attempt to write history to the `userData` folder.
 *
 * @param {{ history: NetworkDatum[] }} param0
 * @returns {Promise<void>}
 */
async function writeHistory({ history }) {
  const userDataPath = app.getPath("userData");
  const historyPath = `${userDataPath}/${HISTORY_FILE_NAME}`;
  try {
    await fs.writeFile(historyPath, JSON.stringify(history), "utf-8");
  } catch {
    // Do nothing
  }
}

export async function monitor({ signal }) {
  /**
   * See if we have existing history to load.
   */
  const storedHistory = await readHistory();
  
  const history = storedHistory?.length ? storedHistory : createPlaceholderHistory();

  const onSample = async ({ inputBytes, outputBytes, timestamp }) => {
    /**
     * Push data into an array for charting history.
     * Limit to one minute of entries.
     */
    history.push({ inputBytes, outputBytes, timestamp });
    while (history.length > MAX_HISTORY_LENGTH) {
      history.shift();
    }
  };

  sample({
    onSample,
    signal,
  });

  /**
   * Every `MAX_BARS` seconds:
   * - Write history to disk.
   * - Run a speed test.
   */
  setInterval(async () => {
    await writeHistory({ history });
    await speedTest();
  }, MAX_BARS * 1e3);

  /**
   * Run initial speed test.
   */
  void speedTest();
}
