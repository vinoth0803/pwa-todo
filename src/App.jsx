import React, { useEffect, useState, useRef } from "react";
import { addReminder as idbAddReminder, deleteReminder as idbDeleteReminder } from "./idb";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Trash2, Plus } from "lucide-react";

const SERVICE_WORKER_PATH = "/service-worker.js";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState("");
  const [showReminderSheet, setShowReminderSheet] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [reminderTime, setReminderTime] = useState("");

  const [activeTab, setActiveTab] = useState("All"); // All | Today | Scheduled
  const deferredPromptRef = useRef(null);

  // ---------- Load todos ----------
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("todos")) || [];
    setTodos(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("todos", JSON.stringify(todos));
  }, [todos]);

  // ---------- Service Worker ----------
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(SERVICE_WORKER_PATH).catch(console.error);

    const handler = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // ---------- Notifications ----------
  const [notifPermission, setNotifPermission] = useState(Notification?.permission ?? "default");

  const requestNotificationPerm = async () => {
    const p = await Notification.requestPermission();
    setNotifPermission(p);
    return p;
  };

  // ---------- TODO CRUD ----------
  const addTodo = () => {
    const text = input.trim();
    if (!text) return;
    const today = new Date();
    const newTodo = { 
      id: Date.now(), 
      text, 
      completed: false, 
      reminder: today.getTime() // new todos default to today
    };
    setTodos(prev => [newTodo, ...prev]);
    setInput("");
  };

  const toggleTodo = (id) => {
    setTodos(prev => prev.map(todo => todo.id === id ? { ...todo, completed: !todo.completed } : todo));
  };

  const deleteTodo = (id) => {
    const t = todos.find(todo => todo.id === id);
    setTodos(prev => prev.filter(todo => todo.id !== id));
    if (t?.id) idbDeleteReminder(t.id).catch(console.warn);
  };

  // ---------- REMINDER SHEET ----------
  const openReminderSheet = (todo) => {
    setSelectedTodo(todo);
    setReminderTime(todo.reminder ? new Date(todo.reminder).toISOString().slice(0,16) : "");
    setShowReminderSheet(true);
  };

  const scheduleReminder = async () => {
    if (!selectedTodo || !reminderTime) return;

    const p = await requestNotificationPerm();
    if (p !== "granted") return alert("Enable notifications to use reminders");

    const t = new Date(reminderTime).getTime();
    if (isNaN(t) || t <= Date.now()) return alert("Invalid or past time");

    setTodos(prev => prev.map(todo => todo.id === selectedTodo.id ? { ...todo, reminder: t } : todo));

    await idbAddReminder({ todoId: selectedTodo.id, time: t });
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ action: "schedule", todoId: selectedTodo.id, time: t });
    }
    setShowReminderSheet(false);
  };

  // ---------- GROUP TODOS ----------
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24*60*60*1000 - 1;

  const todayTodos = todos.filter(t => t.reminder && t.reminder >= startOfDay && t.reminder <= endOfDay);
  const scheduledTodos = todos.filter(t => t.reminder && t.reminder > endOfDay);
  const allTodos = todos;

  const renderTodoList = (list) => (
    <ul className="space-y-3 overflow-y-auto max-h-[60vh]">
      {list.map((todo) => (
        <motion.li
          key={todo.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex justify-between items-center"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="h-5 w-5 accent-blue-600"
              />
              <span className={`text-[17px] ${todo.completed ? "line-through text-gray-400" : "text-gray-900"}`}>
                {todo.text}
              </span>
            </div>
            {todo.reminder && (
              <span className="text-xs text-gray-500 ml-8">
                {new Date(todo.reminder).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => openReminderSheet(todo)} className="p-2 rounded-xl hover:bg-blue-50 text-blue-600">
              <Clock size={20} />
            </button>
            <button onClick={() => deleteTodo(todo.id)} className="p-2 rounded-xl hover:bg-red-50 text-red-500">
              <Trash2 size={20} />
            </button>
          </div>
        </motion.li>
      ))}
    </ul>
  );

  const getActiveTodos = () => {
    switch(activeTab) {
      case "Today": return todayTodos;
      case "Scheduled": return scheduledTodos;
      case "All": return allTodos;
      default: return allTodos;
    }
  };

  const getTabCount = (tab) => {
    switch(tab) {
      case "Today": return todayTodos.length;
      case "Scheduled": return scheduledTodos.length;
      case "All": return allTodos.length;
      default: return 0;
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center p-6 bg-neutral-100 text-gray-900">
      <h1 className="text-3xl font-semibold mt-4 mb-6 tracking-tight">Reminders</h1>

      {/* Input bar */}
      <div className="w-full max-w-xl flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm border border-gray-200 mb-4">
        <Plus size={22} className="text-gray-500"/>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
          placeholder="New Reminder"
          className="flex-1 bg-transparent outline-none text-lg"
        />
        <button onClick={addTodo} className="px-3 py-1 text-blue-600 font-medium">Add</button>
      </div>

      {/* ---------- HORIZONTAL TABS ---------- */}
      <div className="w-full max-w-xl sticky top-0 bg-neutral-100 z-10 mb-3">
        <div className="flex gap-4 overflow-x-auto hide-scrollbar py-2">
          {["All","Today","Scheduled"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative whitespace-nowrap px-4 py-2 rounded-full font-medium transition ${
                activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
              }`}
            >
              {tab}
              <span className="absolute -top-1 -right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                {getTabCount(tab)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ---------- ACTIVE TODO LIST ---------- */}
      <div className="w-full max-w-xl">{renderTodoList(getActiveTodos())}</div>

      {/* ---------- REMINDER SHEET ---------- */}
      <AnimatePresence>
        {showReminderSheet && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed bottom-0 left-0 w-full bg-white rounded-t-3xl shadow-xl p-6 border-t border-gray-200"
          >
            <h2 className="text-xl font-semibold mb-4">Set Reminder</h2>
            <input
              type="datetime-local"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-full bg-gray-100 p-3 rounded-xl text-lg outline-none"
            />
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowReminderSheet(false)} className="px-4 py-2 text-gray-600">Cancel</button>
              <button onClick={scheduleReminder} className="px-5 py-2 bg-blue-600 text-white rounded-xl">Save</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HIDE SCROLLBAR CSS */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
