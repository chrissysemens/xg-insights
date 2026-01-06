import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { assertConfig, ENV } from "./config";

import { syncFixturesWindow } from "./jobs/syncFixturesWindow";
import { enrichFixturesWindow } from "./jobs/enrichFixturesWindow";
import { runPredictionsWindow } from "./jobs/runPredictions"
import { evaluateArchivedPredictionsWindow } from "./jobs/evaluateArchivedPredictions";

admin.initializeApp();
assertConfig();

const SPORTMONKS_TOKEN = defineSecret("SPORTMONKS_TOKEN");

export const syncFixtures = onSchedule(
  {
    schedule: "5 */2 * * *",      // ✅ hh:05 every 2 hours
    timeZone: ENV.APP.TIMEZONE,
    secrets: [SPORTMONKS_TOKEN],
    region: ENV.APP.REGION,
    memory: "512MiB",
    timeoutSeconds: 240,
  },
  async () => {
    const token = SPORTMONKS_TOKEN.value();
    if (!token) throw new Error("Missing SPORTMONKS_TOKEN secret");
    await syncFixturesWindow(token);
  }
);

export const enrichFixtures = onSchedule(
  {
    schedule: "20 */2 * * *",     // ✅ hh:20 every 2 hours
    timeZone: ENV.APP.TIMEZONE,
    secrets: [SPORTMONKS_TOKEN],
    region: ENV.APP.REGION,
    memory: "512MiB",
    timeoutSeconds: 420,          // enrich can take longer
  },
  async () => {
    const token = SPORTMONKS_TOKEN.value();
    if (!token) throw new Error("Missing SPORTMONKS_TOKEN secret");
    await enrichFixturesWindow(token);
  }
);

export const runPredictions = onSchedule(
  {
    schedule: "40 */2 * * *",     // ✅ hh:40 every 2 hours
    timeZone: ENV.APP.TIMEZONE,
    region: ENV.APP.REGION,
    memory: "512MiB",
    timeoutSeconds: 420,
  },
  async () => {
    console.log("runPredictions: starting");
    await runPredictionsWindow();
    console.log("runPredictions: done");
  }
);

export const evaluateArchivedPredictions = onSchedule(
  {
    schedule: "55 */2 * * *",     // ✅ hh:55 every 2 hours
    timeZone: ENV.APP.TIMEZONE,
    region: ENV.APP.REGION,
    memory: "256MiB",
    timeoutSeconds: 180,
  },
  async () => {
    console.log("evaluateArchivedPredictions: starting");
    await evaluateArchivedPredictionsWindow();
    console.log("evaluateArchivedPredictions: done");
  }
);
