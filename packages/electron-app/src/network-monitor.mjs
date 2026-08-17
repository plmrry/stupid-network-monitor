// @ts-check

import { MAX_BARS } from "./get-tray-image.mjs";
import { sample } from "./sample.mjs";
import { speedTest } from "./speed-test.mjs";
import { HistoryManager } from "./history-manager.mjs";

export const NetworkMonitor = {
  async start({ signal }) {
    const onSample = async ({ inputBytes, outputBytes, timestamp }) => {
      const history = await HistoryManager.read();
      /**
       * Push data into an array for charting history.
       */
      history.push({ inputBytes, outputBytes, timestamp });
      await HistoryManager.write({ history });
    };

    sample({
      onSample,
      signal,
    });

    /**
     * Run speed test every `MAX_BARS` seconds.
     */
    setInterval(async () => {
      speedTest();
    }, MAX_BARS * 1e3);

    /**
     * Run initial speed test.
     */
    void speedTest();
  },
};
