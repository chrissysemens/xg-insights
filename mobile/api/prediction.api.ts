export type PredictRequest = {
  homeTeamId: number;
  awayTeamId: number;
  seasonId: number;
};

export type PredictionResponse = {
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  under25: number;
  predictedScore: string;
};

// Use emulator-safe hostnames.
// Android emulator = 10.0.2.2, iOS simulator = localhost.
const BASE_URL = __DEV__ ? 'http://10.22.149.161:8000' : 'http://YOUR_PROD_HOST';

export async function predict(
  req: PredictRequest,
): Promise<PredictionResponse> {
  const res = await fetch(`${BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Predict failed (${res.status}): ${text || res.statusText}`,
    );
  }

  return res.json();
}
