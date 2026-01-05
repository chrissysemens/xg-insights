const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

(async () => {
  const cols = await db.listCollections();
  console.log("Root collections:", cols.map(c => c.id));

  const snap = await db.collection("predictions_live").limit(5).get();
  console.log("predictions_live count (first page):", snap.size);
  snap.forEach(d => console.log(d.id, d.data().fixtureId, d.data().modelVersion));
  process.exit(0);
})();
