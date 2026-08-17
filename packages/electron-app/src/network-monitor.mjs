// @ts-check

import { MAX_BARS } from "./get-tray-image.mjs";
import { sample } from "./sample.mjs";
import { speedTest } from "./speed-test.mjs";
import { HistoryManager } from "./history-manager.mjs";

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
 * Attempt to write history to the `userData` folder.
 *
 * @param {{ history: NetworkDatum[] }} param0
 * @returns {Promise<void>}
 */
export async function writeHistory({ history }) {
  await HistoryManager.write({ history });
}

export async function clearHistory() {
  const history = createPlaceholderHistory();
  await writeHistory({ history });
}

export async function monitorNetwork({ signal }) {
  /**
   * See if we have existing history to load.
   */
  const history = await HistoryManager.read();

  const onSample = async ({ inputBytes, outputBytes, timestamp }) => {
    /**
     * Push data into an array for charting history.
     * Limit to one minute of entries.
     */
    history.push({ inputBytes, outputBytes, timestamp });
    while (history.length > MAX_HISTORY_LENGTH) {
      history.shift();
    }
    await HistoryManager.write({ history });
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
  setInterval(() => {
    writeHistory({ history });
    speedTest();
  }, MAX_BARS * 1e3);

  /**
   * Run initial speed test.
   */
  void speedTest();
}

export const NetworkMonitor = {
  async start({ signal }) {
    return await monitorNetwork({ signal });
  },
};
