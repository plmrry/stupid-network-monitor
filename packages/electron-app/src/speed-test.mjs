// @ts-check
/// <reference types="node" />
import crypto from "node:crypto";

const speedtestUrlPath = `/api/speedtest`;
const speedtestUrlOrigin = `https://www.paulmurray.lol`;
const speedtestUrl = new URL(speedtestUrlPath, speedtestUrlOrigin);

const count = 1000;
const size = 1;

async function downloadFile({ signal }) {
  try {
    speedtestUrl.searchParams.set("size", String(size * 10));

    const request = new Request(speedtestUrl, {
      cache: "no-store",
      method: "GET",
    });

    await fetch(request, { signal });
  } catch {}
}

async function* createRandomBody(byteLength) {
  while (byteLength) {
    const n = Math.min(byteLength, 65_536);
    yield crypto.randomBytes(n);
    byteLength -= n;
  }
}

async function uploadFile({ signal }) {
  try {
    const body = createRandomBody(size * 0.2 * 1_024 * 1_024);

    const request = new Request(speedtestUrl, {
      body,
      cache: "no-store",
      duplex: "half",
      method: "POST",
    });

    await fetch(request, { signal });
  } catch {}
}

/**
 * @returns {Promise<{ functionDuration: number }>}
 */
export async function speedTest() {
  const downloadSignal = AbortSignal.timeout(10_000);

  const start = performance.now();

  const promises = [];

  for (const _ of Array(count).keys()) {
    promises.push(downloadFile({ signal: downloadSignal }));
  }

  await Promise.allSettled(promises);

  const uploadSignal = AbortSignal.timeout(10_000);

  for (const _ of Array(count).keys()) {
    uploadFile({ signal: uploadSignal });
  }

  const end = performance.now();

  const functionDuration = end - start;

  return {
    functionDuration,
  };
}

if (import.meta.main) {
  console.log("Starting speed test...");
  await speedTest();
}
