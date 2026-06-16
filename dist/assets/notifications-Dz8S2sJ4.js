import { g as getDb, s as set, r as ref } from "./index-C-xp_vG8.js";
async function writeActiveDispatcher(companyId, sessionId, data) {
  const db = getDb();
  await set(ref(db, `activeDispatchers/${companyId}/${sessionId}`), {
    ...data,
    lastSeen: Date.now()
  });
}
export {
  writeActiveDispatcher
};
//# sourceMappingURL=notifications-Dz8S2sJ4.js.map
