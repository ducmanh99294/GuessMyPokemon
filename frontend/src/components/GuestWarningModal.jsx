// GuestWarningModal.jsx - Warning popup for guest play (not logged in).
// Used for: daily challenge, quick PVP.
// NOT used for creating / joining rooms.
//
// Props:
// - open: boolean — show the popup
// - mode: "daily" | "pvp" — to adjust wording to the context
// - onConfirm: () => void — "Continue as guest"
// - onGoLogin: () => void — "Log in"
// - onDismiss: () => void — click outside / Esc key (close the popup, do nothing)
import { useEffect } from "react";
import "../css/GuestWarningModal.css";

function GuestWarningModal({ open, mode = "solo", onConfirm, onGoLogin, onDismiss }) {
    // Close with the Esc key
    useEffect(() => {
        if (!open) return;

        function handleKey(e) {
            if (e.key === "Escape") onDismiss?.();
        }

        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open, onDismiss]);

    if (!open) return null;

    const modeLabel = mode === "pvp" ? "PVP battle" : "daily challenge";

    return (
        <div
            className="guest-modal-overlay"
            onClick={onDismiss}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="guest-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="guest-modal-icon">⚠️</div>

                <h3 className="guest-modal-title">
                    Play as a guest?
                </h3>

                <p className="guest-modal-text">
                    You are not logged in. Scores from this {modeLabel} will{" "}
                    <strong>not be saved</strong>.
                </p>

                <p className="guest-modal-text guest-modal-hint">
                    Log in to save scores, compete on the leaderboard and
                    sync achievements across devices.
                </p>

                <div className="guest-modal-actions">
                    <button
                        className="guest-modal-btn guest-modal-btn-login"
                        onClick={onGoLogin}
                    >
                        Log In
                    </button>

                    <button
                        className="guest-modal-btn guest-modal-btn-guest"
                        onClick={onConfirm}
                    >
                        Continue as Guest
                    </button>
                </div>
            </div>
        </div>
    );
}

export default GuestWarningModal;
