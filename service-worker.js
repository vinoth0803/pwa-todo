// service-worker.js
/* global self, clients, registration */
importScripts('/idb-sw.js'); // idb helper for service-worker (see idb file below)

const DB_NAME = 'pwa-todo-db';
const STORE = 'reminders';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  console.log('[SW] install');
});

self.addEventListener('activate', (e) => {
  clients.claim();
  console.log('[SW] activate');
});

// helper: show notification with showTrigger if available
async function showScheduledNotification(data) {
  const { title = 'Reminder', body = 'You have a task', timestamp } = data;
  try {
    if ('showTrigger' in Notification.prototype) {
      // use TimestampTrigger API
      await registration.showNotification(title, {
        body,
        tag: `reminder-${timestamp}`,
        showTrigger: new TimestampTrigger(timestamp),
        data
      });
      return true;
    } else {
      // fallback: if timestamp <= now, show immediately
      if ((timestamp || 0) <= Date.now()) {
        await registration.showNotification(title, { body, tag: `reminder-${timestamp}`, data });
        return true;
      }
      return false;
    }
  } catch (err) {
    console.warn('showScheduledNotification failed', err);
    return false;
  }
}

// When a message arrives from the page
self.addEventListener('message', (event) => {
  const { action } = event.data || {};
  if (action === 'schedule') {
    scheduleReminder(event.data.todoId, event.data.time).catch(console.error);
  } else if (action === 'cancel-for-todo') {
    cancelForTodo(event.data.todoId).catch(console.warn);
  }
});

// store reminder in IDB (used by both page and SW)
async function scheduleReminder(todoId, timestamp) {
  const db = await idbOpen(DB_NAME, 1, {
    upgrade(db) { db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true }); }
  });
  await idbPut(db, STORE, { todoId, timestamp });
  // attempt immediate register with showTrigger if available
  if ('showTrigger' in Notification.prototype) {
    // showNotification with showTrigger directly
    try {
      await registration.showNotification('Reminder scheduled', {
        body: 'Will notify at scheduled time',
        tag: `scheduled-${todoId}-${timestamp}`,
      });
      // Then create the actual scheduled notification for the target time
      await registration.showNotification('Todo reminder', {
        body: 'Reminder for your task',
        tag: `reminder-${todoId}-${timestamp}`,
        showTrigger: new TimestampTrigger(timestamp),
        data: { todoId, timestamp }
      });
    } catch (e) {
      console.warn('Trigger scheduling error', e);
    }
  } else {
    // If no showTrigger, rely on periodic sync to check due reminders.
    // Try to register periodic sync (best-effort)
    try {
      if (registration.periodicSync) {
        await registration.periodicSync.register('todo-reminders', { minInterval: 60 * 15 * 1000 }); // 15min
      }
    } catch (e) {
      console.warn('Periodic sync register failed', e);
    }
  }
}

// cancel reminders in IDB for todo
async function cancelForTodo(todoId) {
  const db = await idbOpen(DB_NAME, 1);
  const all = await idbGetAll(db, STORE);
  const toDelete = all.filter(r => r.todoId === todoId);
  for (const rem of toDelete) {
    await idbDelete(db, STORE, rem.id);
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'todo-reminders') {
    event.waitUntil(checkAndFireDueReminders());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'todo-reminders') {
    event.waitUntil(checkAndFireDueReminders());
  }
});

async function checkAndFireDueReminders() {
  const db = await idbOpen(DB_NAME, 1);
  const all = await idbGetAll(db, STORE);
  const now = Date.now();
  for (const r of all) {
    if (r.timestamp <= now) {
      // show notification
      await registration.showNotification('Reminder', {
        body: `Task reminder`,
        tag: `reminder-${r.todoId}-${r.timestamp}`,
        data: r
      }).catch(console.warn);
      // delete from IDB
      await idbDelete(db, STORE, r.id);
    }
  }
}

// respond to notification click
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window" }).then(windowClients => {
    if (windowClients.length > 0) {
      const client = windowClients[0];
      client.focus();
      // optionally navigate or postMessage with the reminder details
      client.postMessage({ action: "notification-click", data: e.notification.data });
    } else {
      clients.openWindow('/');
    }
  }));
});
