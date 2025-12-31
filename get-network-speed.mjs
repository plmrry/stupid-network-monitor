import { performance } from "node:perf_hooks";

const fileSize = 1_000;

const TEST_FILE_URLS = [
  `https://speed.cloudflare.com/__down?bytes=${fileSize}`,
];

async function measureDownloadSpeed() {
  let totalBytes = 0;
  let totalTime = 0;

  for (const url of TEST_FILE_URLS) {
    const start = performance.now();

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const end = performance.now();

    totalBytes += buffer.byteLength;
    totalTime += (end - start) / 1000; // Convert to seconds
  }

  const speedBps = totalBytes / totalTime; // Bytes per second
  const speedMbps = (speedBps * 8) / 1_000; // Megabits per second

  return speedMbps;
}

async function checkNetworkSpeed() {
  try {
    // const ping = await measureLatency();
    const downloadSpeed = await measureDownloadSpeed();
    // const uploadSpeed = await measureUploadSpeed();

    // console.log("\n=== Results ===\n");
    // console.log(`Ping:     ${ping.toFixed(2)} ms`);
    console.log(`Download: ${downloadSpeed.toFixed(2)} Mbps`);
    // console.log(`Upload:   ${uploadSpeed.toFixed(2)} Mbps`);

    return {
      download: downloadSpeed,
      // ping,
      // upload: uploadSpeed,
    };
  } catch (error) {
    console.error("\nError running speed test:", error.message);
    process.exit(1);
  }
}

setInterval(() => {
  checkNetworkSpeed();
}, 1000);
