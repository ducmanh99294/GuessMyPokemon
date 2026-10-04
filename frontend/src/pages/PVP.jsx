// PVP.jsx - Quick match: random pairing with another player.
// Flow: click "Find Opponent" -> server pairs up -> receive "pvp_matched"
// -> navigate to /game/:roomId (reuses GameRoom + all existing components).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket/socket";
import { getPlayerId } from "../utils/playerId";
import { useAuth } from "../context/AuthContext";
import "../css/PVP.css";
import GuestWarningModal from "../components/GuestWarningModal";
import SoloLeaderboard from "../components/SoloLeaderboard";

function formatElapsed(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function PVP() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [name, setName] = useState(
        () => localStorage.getItem("pokemon_pvp_name") || ""
    );
    const [searching, setSearching] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [matchedName, setMatchedName] = useState("");
    const [error, setError] = useState("");
    const [showGuestWarning, setShowGuestWarning] = useState(false);
    const guestAcked = useRef(false); // guest acknowledged this session

    const playerId = getPlayerId();
    const timerRef = useRef(null);
    const searchingRef = useRef(false);

    // Receive the room after the server pairs up
    useEffect(() => {
        function onMatched({ roomId, opponent }) {
            setSearching(false);
            searchingRef.current = false;
            setMatchedName(opponent?.name || "Opponent");

            localStorage.setItem("pokemon_room_id", roomId);

            // Wait a beat so the user sees "Opponent found"
            setTimeout(() => navigate(`/game/${roomId}`), 900);
        }

        socket.on("pvp_matched", onMatched);
        return () => socket.off("pvp_matched", onMatched);
    }, [navigate]);

    // Waiting timer
    useEffect(() => {
        if (searching) {
            setElapsed(0);
            timerRef.current = setInterval(
                () => setElapsed((e) => e + 1),
                1000
            );
        } else {
            clearInterval(timerRef.current);
        }

        return () => clearInterval(timerRef.current);
    }, [searching]);

    // Leaving the page while searching -> auto-remove from queue
    useEffect(() => {
        return () => {
            if (searchingRef.current) {
                socket.emit("pvp_cancel_match", { playerId });
            }
        };
    }, [playerId]);

    function ensureConnected(fn) {
        if (socket.connected) {
            fn();
        } else {
            socket.once("connect", fn);
            socket.connect();
        }
    }

    function handleFind() {
        // Not logged in -> warn that scores won't be saved (once per session)
        if (!user && !guestAcked.current) {
            setShowGuestWarning(true);
            return;
        }

        doFind();
    }

    function handleGuestConfirm() {
        guestAcked.current = true;
        setShowGuestWarning(false);
        doFind();
    }

    function doFind() {
        setError("");

        const playerName = (user?.name || name).trim() || "Player";
        if (!user) {
            localStorage.setItem("pokemon_pvp_name", playerName);
        }

        ensureConnected(() => {
            socket.emit(
                "pvp_find_match",
                { playerId, playerName },
                (res) => {
                    if (!res?.success) {
                        setError(
                            res?.message || "Could not find a match. Try again."
                        );
                        return;
                    }

                    searchingRef.current = true;
                    setSearching(true);
                }
            );
        });
    }

    function handleCancel() {
        socket.emit("pvp_cancel_match", { playerId });
        searchingRef.current = false;
        setSearching(false);
    }

    return (
        <div className="pvp-container">
            <div className="pvp-card">
                <div className="pvp-icon">⚔️</div>
                <h1 className="pvp-title">Quick PVP Battle</h1>
                <p className="pvp-sub">
                    Get randomly paired with another player.
                    Each player picks a secret Pokémon — whoever guesses right first wins.
                </p>

                {error && <div className="pvp-error">{error}</div>}

                {!searching && !matchedName && (
                    <>
                        {!user && (
                            <input
                                className="pvp-input"
                                type="text"
                                placeholder="Your display name..."
                                maxLength={20}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        )}

                        <button
                            className="pvp-btn pvp-btn-find"
                            onClick={handleFind}
                        >
                            🔍 Find Opponent
                        </button>

                        <button
                            className="pvp-btn pvp-btn-ghost"
                            onClick={() => navigate("/")}
                        >
                            ← Back to Home
                        </button>
                    </>
                )}

                {searching && !matchedName && (
                    <div className="pvp-searching">
                        <div className="pvp-spinner" aria-hidden="true" />
                        <div className="pvp-timer">
                            {formatElapsed(elapsed)}
                        </div>
                        <p className="pvp-sub">
                            Finding a worthy opponent...
                        </p>
                        <button
                            className="pvp-btn pvp-btn-cancel"
                            onClick={handleCancel}
                        >
                            Cancel Search
                        </button>
                    </div>
                )}

                <GuestWarningModal
                    open={showGuestWarning}
                    mode="pvp"
                    onConfirm={handleGuestConfirm}
                    onGoLogin={() => navigate("/login")}
                    onDismiss={() => setShowGuestWarning(false)}
                />

                {matchedName && (
                    <div className="pvp-matched">
                        <div className="pvp-check">✅</div>
                        <p className="pvp-sub">
                            Found <strong>{matchedName}</strong>!
                            Joining the battle...
                        </p>
                    </div>
                )}
            </div>

            <div className="pvp-lb">
                <SoloLeaderboard mode="pvp" />
            </div>
        </div>
    );
}

export default PVP;
