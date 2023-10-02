import * as os from "os";

// Initial value; wait at little amount of time before making a measurement.
let timesBefore = os.cpus().map((c) => c.times);

// Call this function periodically e.g. using setInterval,
export function getAverageUsage(): number {
  const timesAfter = os.cpus().map((c) => c.times);
  const timeDeltas = timesAfter.map((t, i) => ({
    user: t.user - timesBefore[i].user,
    sys: t.sys - timesBefore[i].sys,
    idle: t.idle - timesBefore[i].idle,
  }));

  timesBefore = timesAfter;

  return (
    timeDeltas.map((times) => 1 - times.idle / (times.user + times.sys + times.idle)).reduce((l1, l2) => l1 + l2) /
    timeDeltas.length
  );
}

export const sleep = (ms): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms || 1000));
