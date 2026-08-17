import { sample } from "../src/sample.mjs";

// const result = await speedTest();
try {
  await sample({
    onSample: (data) => {
      console.log("Speed Test Data:", data);
    },
    signal: AbortSignal.timeout(5_000),
  });
} catch {}
