import { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";
import { getPlayerId } from "../utils/playerId";
function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChatPanel({ roomId }) {
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const myPlayerId = getPlayerId();

    useEffect(() => {
        function handleHistory(history) {
            setMessages(history || []);
        }

        function handleMessage(chatMessage) {
            setMessages((current) => [...current, chatMessage]);
        }

        socket.on("chat_history", handleHistory);
        socket.on("receive_chat_message", handleMessage);

        return () => {
            socket.off("chat_history", handleHistory);
            socket.off("receive_chat_message", handleMessage);
        };
    }, []);

    // ⭐ auto-scroll xuống cuối khi có tin nhắn mới
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    function sendMessage() {
        const text = message.trim();

        if (!text || sending) {
            return;
        }

        setSending(true);

        socket.emit(
            "send_chat_message",
            { roomId, message: text },
            (response) => {
                setSending(false);

                if (!response?.success) {
                    console.error(response?.message);
                    return;
                }

                setMessage("");
            }
        );
    }

    function handleKeyDown(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    }

    return (
        <div className="chat-panel">

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <span className="chat-empty-icon">💬</span>
                        <p>Chưa có tin nhắn nào. Bắt đầu trò chuyện!</p>
                    </div>
                )}

                {messages.map((item) => {
                    const isMine = item.playerId === myPlayerId;

                    return (
                        <div
                            key={item.id}
                            className={`chat-message ${isMine ? "own" : ""}`}
                        >
                            {!isMine && (
                                <span className="avatar">
                                    {item.playerName?.charAt(0).toUpperCase()}
                                </span>
                            )}

                            <div className="bubble">
                                {!isMine && (
                                    <span className="sender">{item.playerName}</span>
                                )}
                                <span className="text">{item.message}</span>
                                <span className="time">{formatTime(item.timestamp)}</span>
                            </div>
                        </div>
                    );
                })}

                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nhập tin nhắn..."
                    maxLength={300}
                />

                <button
                    className="send-btn"
                    onClick={sendMessage}
                    disabled={sending || !message.trim()}
                >
                    <i className="fas fa-paper-plane"></i>
                </button>
            </div>

        </div>
    );
}

export default ChatPanel;