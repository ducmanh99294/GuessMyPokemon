import { useEffect, useState } from "react";
import socket from "../socket/socket";

function ChatPanel({ roomId }) {
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {

        function handleHistory(history) {
            setMessages(history || []);
        }

        function handleMessage(chatMessage) {
            setMessages((current) => [
                ...current,
                chatMessage
            ]);
        }

        socket.on(
            "chat_history",
            handleHistory
        );

        socket.on(
            "receive_chat_message",
            handleMessage
        );

        return () => {
            socket.off(
                "chat_history",
                handleHistory
            );

            socket.off(
                "receive_chat_message",
                handleMessage
            );
        };

    }, []);

    function sendMessage() {
        const text = message.trim();

        if (!text || sending) {
            return;
        }
console.log("📤 FE gửi chat:", {
    roomId,
    message: message.trim()
});
        setSending(true);

        socket.emit(
            "send_chat_message",
            {
                roomId,
                message: text
            },
            (response) => {
                setSending(false);

                if (!response?.success) {
                    console.error(
                        response?.message
                    );
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
                {messages.map((item) => (
                    <div
                        key={item.id}
                        className="chat-message"
                    >
                        <strong>
                            {item.playerName}
                        </strong>

                        <span>
                            {item.message}
                        </span>
                    </div>
                ))}

                {messages.length === 0 && (
                    <p>
                        No messages yet.
                    </p>
                )}
            </div>

            <div className="chat-input">
                <input
                    value={message}
                    onChange={(event) =>
                        setMessage(
                            event.target.value
                        )
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    maxLength={300}
                />

                <button
                    onClick={sendMessage}
                    disabled={
                        sending ||
                        !message.trim()
                    }
                >
                    Send
                </button>
            </div>

        </div>
    );
}

export default ChatPanel;