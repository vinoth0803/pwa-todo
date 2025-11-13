import { useState, useEffect } from "react";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState("");

  // Load saved todos
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("todos")) || [];
    setTodos(saved);
  }, []);

  // Save todos
  useEffect(() => {
    localStorage.setItem("todos", JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    if (input.trim() === "") return;
    setTodos([...todos, { text: input, completed: false }]);
    setInput("");
  };

  const toggleTodo = (index) => {
    const newTodos = [...todos];
    newTodos[index].completed = !newTodos[index].completed;
    setTodos(newTodos);
  };

  const deleteTodo = (index) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-blue-200 to-blue-500 p-6">
      <h1 className="text-3xl font-bold text-white mb-6">📝 Progressive Todo</h1>

      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-4">
        <div className="flex mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 border rounded-l-lg p-2 outline-none"
          />
          <button
            onClick={addTodo}
            className="bg-blue-600 text-white px-4 py-2 rounded-r-lg hover:bg-blue-700"
          >
            Add
          </button>
        </div>

        <ul>
          {todos.map((todo, i) => (
            <li
              key={i}
              className="flex justify-between items-center border-b py-2"
            >
              <span
                onClick={() => toggleTodo(i)}
                className={`flex-1 cursor-pointer ${
                  todo.completed ? "line-through text-gray-400" : ""
                }`}
              >
                {todo.text}
              </span>
              <button
                onClick={() => deleteTodo(i)}
                className="text-red-500 hover:text-red-700"
              >
                ❌
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
