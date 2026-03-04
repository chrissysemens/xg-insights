const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

(async () => {
  const cols = await db.listCollections();

  const snap = await db.collection("predictions_live").limit(5).get();
  process.exit(0);
})();
