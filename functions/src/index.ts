import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { assertConfig, ENV } from "./config";

import { syncFixturesWindow } from "./jobs/syncFixturesWindow";
import { enrichFixturesWindow } from "./jobs/enrichFixturesWindow";
import { runPredictionsWindow } from "./jobs/runPredictions"

admin.initializeApp();
assertConfig();

const SPORTMONKS_TOKEN = defineSecret("SPORTMONKS_TOKEN");

export const syncFixtures = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: ENV.APP.TIMEZONE,
    secrets: [SPORTMONKS_TOKEN],
    region: ENV.APP.REGION,
    memory: "512MiB",
    timeoutSeconds: 180,
  },
  async () => {
    const token = SPORTMONKS_TOKEN.value();
    if (!token) throw new Error("Missing SPORTMONKS_TOKEN secret");
    await syncFixturesWindow(token);
  }
);

export const enrichFixtures = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: ENV.APP.TIMEZONE,
    secrets: [SPORTMONKS_TOKEN],
    region: ENV.APP.REGION,
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const token = SPORTMONKS_TOKEN.value();
    if (!token) throw new Error("Missing SPORTMONKS_TOKEN secret");
    await enrichFixturesWindow(token);
  }
);

export const runPredictions = onSchedule(
  {
    schedule: "every 2 hours",
    timeZone: ENV.APP.TIMEZONE,
    region: ENV.APP.REGION,
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    console.log("runPredictions: starting");
    await runPredictionsWindow();
    console.log("runPredictions: done");
  }
);