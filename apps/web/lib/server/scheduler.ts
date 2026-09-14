import "server-only";
import cron from "node-cron";
import { performBackup, pruneBackups } from "./backup";

let started = false;

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log("[scheduler]", ...args);
};

if (!started) {
  started = true;

  cron.schedule("0 2 * * *", () => {
    performBackup()
      .then(() => pruneBackups(7))
      .catch((err) => log("backup error", err));
  });

  log("scheduled daily backup");
}
