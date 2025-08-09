import React, { useState, useEffect, useRef } from "react";
import Gun from "gun";

const GunTest = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const gunRef = useRef(null);

  useEffect(() => {
    // Initialize Gun
    gunRef.current = Gun({
      peers: ["https://codeatlas-gunjs.onrender.com/gun"],
      localStorage: false,
      radisk: false,
    });

    console.log("Gun initialized:", gunRef.current);

    // Listen for messages
    const chatRoom = gunRef.current.get("test-chat");
    chatRoom.map().on((message, key) => {
      console.log("Received message:", message, "key:", key);
      if (message && message.text && message.timestamp) {
        setMessages((prev) => {
          const exists = prev.find((msg) => msg.id === key);
          if (!exists) {
            return [...prev, { ...message, id: key }].sort(
              (a, b) => a.timestamp - b.timestamp
            );
          }
          return prev;
        });
      }
    });

    return () => {
      if (gunRef.current) {
        gunRef.current.off();
      }
    };
  }, []);

  const sendMessage = () => {
    if (!newMessage.trim() || !gunRef.current) return;

    const message = {
      text: newMessage,
      author: "TestUser",
      timestamp: Date.now(),
    };

    console.log("Sending message:", message);

    // Generate unique key
    const messageId = `msg_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    gunRef.current.get("test-chat").get(messageId).put(message);

    setNewMessage("");
  };

  return (
    <div
      style={{
        padding: "20px",
        background: "#1a1d2e",
        color: "white",
        minHeight: "100vh",
      }}
    >
      <h2>Gun.js Chat Test</h2>

      <div
        style={{
          background: "#25283d",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "20px",
          height: "300px",
          overflowY: "auto",
        }}
      >
        <h3>Messages ({messages.length})</h3>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              background: "#2c2f48",
              padding: "10px",
              margin: "5px 0",
              borderRadius: "5px",
            }}
          >
            <strong>{message.author}:</strong> {message.text}
            <div style={{ fontSize: "12px", color: "#888" }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          style={{
            flex: 1,
            background: "#2c2f48",
            border: "1px solid #444",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            background: "#7c4dff",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>

      <div style={{ marginTop: "20px", fontSize: "14px", color: "#888" }}>
        <p>Gun.js Status: {gunRef.current ? "Connected" : "Disconnected"}</p>
        <p>Total Messages: {messages.length}</p>
      </div>
    </div>
  );
};

export default GunTest;
