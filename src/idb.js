// idb.js - small wrapper for page usage
export async function openDB(name = 'pwa-todo-db', version = 1, { upgrade } = {}) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (upgrade) upgrade(db);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const s = tx.objectStore(storeName);
    const r = s.put(value);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const s = tx.objectStore(storeName);
    const r = s.getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function idbDelete(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const s = tx.objectStore(storeName);
    const r = s.delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

// convenience wrappers for page usage
export async function addReminder({ todoId, time }) {
  const db = await openDB();
  try { await idbPut(db, 'reminders', { todoId, timestamp: +time }); }
  catch (e) { console.warn(e); }
}
export async function getAllReminders() {
  const db = await openDB();
  try { return await idbGetAll(db, 'reminders'); } catch (e) { return []; }
}
export async function deleteReminder(todoId) {
  const db = await openDB();
  const all = await idbGetAll(db, 'reminders');
  for (const r of all) if (r.todoId === todoId) await idbDelete(db, 'reminders', r.id);
}
