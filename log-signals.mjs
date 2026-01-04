export const allSignals = new Set([
  "SIGABRT",
  "SIGALRM",
  "SIGBUS",
  "SIGCHLD",
  "SIGCLD",
  "SIGCONT",
  "SIGEMT",
  "SIGFPE",
  "SIGHUP",
  "SIGILL",
  "SIGINFO",
  "SIGINT", // Listening for this prevents exit on Control-C
  "SIGIO",
  "SIGIOT",
  "SIGKILL", // Listening for this prevents exit on Control-C
  "SIGLOST",
  "SIGPIPE",
  "SIGQUIT",
  "SIGSEGV",
  "SIGSTOP", // Listening for this prevents exit on Control-C
  "SIGTSTP",
  "SIGSYS",
  "SIGTERM",
  "SIGTRAP",
  "SIGTTIN",
  "SIGTTOU",
  "SIGUNUSED",
  "SIGURG",
  "SIGUSR1",
  "SIGUSR2",
  "SIGVTALRM",
]);

/**
 * Listening for these will throw an error
 */
export const exitSignals = new Set(["SIGINT", "SIGKILL", "SIGSTOP"]);

export const nonExitSignals = allSignals.difference(exitSignals);

export function logSignals(process, type = "non-exit") {
  const signals = {
    all: allSignals,
    exit: exitSignals,
    "non-exit": nonExitSignals,
  }[type];
  for (const signal of signals) {
    process.on(signal, () => {
      console.log(`got signal: ${signal}`);
    });
  }
}
