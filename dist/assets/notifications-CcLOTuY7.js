import { g as getDb, s as set, r as ref } from "./index-CUYnY8Xr.js";
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
//# sourceMappingURL=notifications-CcLOTuY7.js.map
