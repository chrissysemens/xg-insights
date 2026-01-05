"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPredictions = exports.enrichFixtures = exports.syncFixtures = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const config_1 = require("./config");
const syncFixturesWindow_1 = require("./jobs/syncFixturesWindow");
const enrichFixturesWindow_1 = require("./jobs/enrichFixturesWindow");
const runPredictions_1 = require("./jobs/runPredictions");
admin.initializeApp();
(0, config_1.assertConfig)();
const SPORTMONKS_TOKEN = (0, params_1.defineSecret)("SPORTMONKS_TOKEN");
exports.syncFixtures = (0, scheduler_1.onSchedule)({
    schedule: "every 6 hours",
    timeZone: config_1.ENV.APP.TIMEZONE,
    secrets: [SPORTMONKS_TOKEN],
    region: config_1.ENV.APP.REGION,
    memory: "512MiB",
    timeoutSeconds: 180,
}, async () => {
    const token = SPORTMONKS_TOKEN.value();
    if (!token)
        throw new Error("Missing SPORTMONKS_TOKEN secret");
    await (0, syncFixturesWindow_1.syncFixturesWindow)(token);
});
exports.enrichFixtures = (0, scheduler_1.onSchedule)({
    schedule: "every 6 hours",
    timeZone: config_1.ENV.APP.TIMEZONE,
    secrets: [SPORTMONKS_TOKEN],
    region: config_1.ENV.APP.REGION,
    memory: "512MiB",
    timeoutSeconds: 300,
}, async () => {
    const token = SPORTMONKS_TOKEN.value();
    if (!token)
        throw new Error("Missing SPORTMONKS_TOKEN secret");
    await (0, enrichFixturesWindow_1.enrichFixturesWindow)(token);
});
exports.runPredictions = (0, scheduler_1.onSchedule)({
    schedule: "every 2 hours",
    timeZone: config_1.ENV.APP.TIMEZONE,
    region: config_1.ENV.APP.REGION,
    memory: "512MiB",
    timeoutSeconds: 300,
}, async () => {
    console.log("runPredictions: starting");
    await (0, runPredictions_1.runPredictionsWindow)();
    console.log("runPredictions: done");
});
//# sourceMappingURL=index.js.map