// @ts-check

import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

console.log(`Fetching big file...`);

const ONE_MEG = 1_000_000;
const ONE_HUNDRED_MEG = 100_000_000;
const ONE_GIG = 1_000_000_000;

const NUM_TRIES = 5;

const size = ONE_HUNDRED_MEG;

/**
 * DOWNLOAD
 */
for (const _tryNum of Array(NUM_TRIES).keys()) {
  const url = new URL(`https://speed.cloudflare.com/__down`);

  url.searchParams.append("bytes", size.toString());

  console.log("Fetching...", url.toString());

  // Download using fetch and stream to file
  const response = await fetch(url.toString(), {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Stream response body to file
  await pipeline(
    // @ts-ignore
    Readable.fromWeb(response.body),
    createWriteStream("/tmp/text.txt")
  );

  console.log(`Fetching big file... Done.`);
}

console.log(`Uploading file...`);

const uploadUrl = new URL(`https://speed.cloudflare.com/__up`);
uploadUrl.searchParams.append("rand", Math.random().toString());

console.log("Uploading...", uploadUrl.toString());

// Upload using fetch with file stream
const fileStream = createReadStream("/tmp/text.txt");

const uploadResponse = await fetch(uploadUrl.toString(), {
  // @ts-ignore
  body: Readable.toWeb(fileStream),
  duplex: "half",
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
  method: "POST",
});

if (!uploadResponse.ok) {
  throw new Error(`HTTP error! status: ${uploadResponse.status}`);
}

console.log(`Uploading file... Done.`);
