// Home.jsx — Full cartoon-style home page (matching the reference image)
// Sections: hero, mystery Pokémon, choose your challenge (4 actions),
// journey, daily challenge, top trainers, pokédex,
// achievements, game rooms, CTA, footer.
import React, { useState, useRef, useEffect } from 'react';
import '../css/Home.css';
import { useNavigate } from "react-router-dom";
import socket from "../socket/socket";
import { getPlayerId } from "../utils/playerId";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";
const MAX_POKEMON_ID = 1025;

// Pokémon type names + icons (English)
const TYPE_LABELS = {
    normal: ["Normal", "⚪"], fire: ["Fire", "🔥"], water: ["Water", "💧"],
    grass: ["Grass", "🍃"], electric: ["Electric", "⚡"], ice: ["Ice", "❄️"],
    fighting: ["Fighting", "🥊"], poison: ["Poison", "☠️"], ground: ["Ground", "⛰️"],
    flying: ["Flying", "🕊️"], psychic: ["Psychic", "🔮"], bug: ["Bug", "🐛"],
    rock: ["Rock", "🪨"], ghost: ["Ghost", "👻"], dragon: ["Dragon", "🐉"],
    dark: ["Dark", "🌙"], steel: ["Steel", "⚙️"], fairy: ["Fairy", "🧚"],
};

const TYPE_COLOR = {
    normal: "#A8A878", fire: "#F08030", water: "#6890F0", grass: "#78C850",
    electric: "#F8D030", ice: "#98D8D8", fighting: "#C03028", poison: "#A040A0",
    ground: "#E0C068", flying: "#A890F0", psychic: "#F85888", bug: "#A8B820",
    rock: "#B8A038", ghost: "#705898", dragon: "#7038F8", dark: "#705848",
    steel: "#B8B8D0", fairy: "#EE99AC",
};

async function fetchPokemon(id) {
    const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (!r.ok) throw new Error("pokeapi failed");
    const j = await r.json();
    return {
        id: j.id,
        name: j.name ? j.name.charAt(0).toUpperCase() + j.name.slice(1) : "???",
        sprite:
            j.sprites?.other?.["official-artwork"]?.front_default ||
            j.sprites?.front_default ||
            "",
        types: (j.types || []).map((t) => t.type.name),
    };
}

// Mystery silhouette for the hero — a random Pokémon each visit
// (decorative only; every game hides its own random Pokémon).
function randomPokemonId() {
    return 1 + Math.floor(Math.random() * MAX_POKEMON_ID);
}

// Countdown to midnight tonight
function useCountdown() {
    const [left, setLeft] = useState("--:--:--");
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            const end = new Date(now);
            end.setHours(24, 0, 0, 0);
            const s = Math.max(0, Math.floor((end - now) / 1000));
            const hh = String(Math.floor(s / 3600)).padStart(2, "0");
            const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
            const ss = String(s % 60).padStart(2, "0");
            setLeft(`${hh}:${mm}:${ss}`);
        };
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, []);
    return left;
}

function scrollToId(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const DEX_IDS = [1, 4, 7, 25, 39, 94, 133, 143, 150, 448];

function Home() {
    const navigate = useNavigate();
    // ---- State ----
    const { user, logout } = useAuth();
    // Create room
    const [createName, setCreateName] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');

    // Join room
    const [joinCode, setJoinCode] = useState('');
    const [joinName, setJoinName] = useState('');
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinError, setJoinError] = useState('');

    // Settings
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsRef = useRef(null);
    const barRef = useRef(null);

    // New sections
    const [mystery, setMystery] = useState(null);
    const [mysteryLoading, setMysteryLoading] = useState(true);
    const [daily, setDaily] = useState(null);
    const [dex, setDex] = useState([]);
    const [topTrainers, setTopTrainers] = useState(null); // null = not loaded yet
    const [achievements, setAchievements] = useState([
        { icon: "🌱", label: "First Steps", desc: "Take today's challenge", unlocked: false },
        { icon: "🔥", label: "Dedicated", desc: "Play 10 daily challenges", unlocked: false },
        { icon: "🎯", label: "Master Hunter", desc: "Score 80 pts in a daily", unlocked: false },
        { icon: "⚔️", label: "PVP Warrior", desc: "Play 1 PVP game", unlocked: false },
        { icon: "🏆", label: "Champion", desc: "Win 1 PVP game", unlocked: false },
        { icon: "👑", label: "Legend", desc: "Play 25 games", unlocked: false },
    ]);
    const countdown = useCountdown();

    // ---- Close settings on click outside ----
    useEffect(() => {
        function handleClickOutside(e) {
            if (settingsRef.current && !settingsRef.current.contains(e.target)) {
                setSettingsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ---- GSAP: fullscreen hero collapses to the sides + header docks on scroll ----
    useEffect(() => {
        const bar = barRef.current;
        const container = document.querySelector(".home-container");
        if (!bar) return;

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        // Fallback when GSAP is missing or reduced motion: toggle CSS class
        if (!window.gsap || !window.ScrollTrigger || reduceMotion) {
            const onScroll = () => {
                const y = container ? container.scrollTop : window.scrollY;
                bar.classList.toggle("scrolled", y > 60);
            };
            container?.addEventListener("scroll", onScroll, { passive: true });
            window.addEventListener("scroll", onScroll, { passive: true });
            onScroll();
            return () => {
                container?.removeEventListener("scroll", onScroll);
                window.removeEventListener("scroll", onScroll);
            };
        }

        const gsap = window.gsap;
        gsap.registerPlugin(window.ScrollTrigger);
        bar.classList.add("gsap-on");

        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                defaults: { ease: "power1.in" },
                scrollTrigger: {
                    trigger: ".brand-header",
                    scroller: ".home-container",
                    start: "top top+=60",
                    end: "bottom top",
                    scrub: 0.6,
                },
            });
            // Hero daily: each element collapses outward to the sides
            tl.to(".brand-header .hero-tag", { x: -140, opacity: 0 }, 0)
                .to(".brand-header .hero-silhouette", { scale: 0.5, opacity: 0 }, 0)
                .to(".brand-header .brand-title", { x: 160, opacity: 0 }, 0)
                .to(".brand-header .daily-sub", { x: -130, opacity: 0 }, 0)
                .to(".brand-header .hero-countdown", { x: 130, opacity: 0 }, 0)
                .to(".brand-header .btn-daily", { x: -170, opacity: 0 }, 0)
                // Header: solid -> transparent on scroll down
                .to(".top-bar", {
                    backgroundColor: "rgba(255,253,248,0)",
                    borderBottomColor: "rgba(43,58,85,0)",
                    boxShadow: "0 0px 0 rgba(43,58,85,0)",
                    ease: "power1.out",
                }, 0.05);
        });

        const t = setTimeout(() => window.ScrollTrigger?.refresh(), 1200);
        return () => { clearTimeout(t); ctx.revert(); };
    }, []);

    // ---- Random Mystery Pokémon ----
    const loadMystery = () => {
        setMysteryLoading(true);
        fetchPokemon(randomPokemonId())
            .then(setMystery)
            .catch(() => setMystery(null))
            .finally(() => setMysteryLoading(false));
    };
    useEffect(() => { loadMystery(); }, []);

    // ---- Hero silhouette (random, decorative) ----
    useEffect(() => {
        let dead = false;
        fetchPokemon(randomPokemonId())
            .then((p) => { if (!dead) setDaily(p); })
            .catch(() => {});
        return () => { dead = true; };
    }, []);

    // ---- Mini Pokédex ----
    useEffect(() => {
        let dead = false;
        Promise.all(DEX_IDS.map((id) => fetchPokemon(id).catch(() => null)))
            .then((list) => { if (!dead) setDex(list.filter(Boolean)); });
        return () => { dead = true; };
    }, []);

    // ---- Top trainers (real daily leaderboard) ----
    useEffect(() => {
        let dead = false;
        fetch(`${API_BASE}/api/daily/leaderboard/top?limit=3`)
            .then((r) => r.json())
            .then((j) => { if (!dead && j?.success) setTopTrainers(j.data || []); })
            .catch(() => { if (!dead) setTopTrainers([]); });
        return () => { dead = true; };
    }, []);

    // ---- Achievements (real leaderboard data) ----
    useEffect(() => {
        let dead = false;
        const pid = getPlayerId();
        Promise.all([
            fetch(`${API_BASE}/api/daily/leaderboard/player/${pid}`).then((r) => r.json()).catch(() => null),
            fetch(`${API_BASE}/api/pvp/leaderboard/player/${pid}`).then((r) => r.json()).catch(() => null),
        ]).then(([s, p]) => {
            if (dead) return;
            const sg = s?.totalGames || 0;
            const sb = s?.bestScore || 0;
            const pg = p?.totalGames || 0;
            const pw = p?.wins || 0;
            setAchievements((prev) => prev.map((a, i) => ({
                ...a,
                unlocked: [sg >= 1, sg >= 10, sb >= 80, pg >= 1, pw >= 1, sg + pg >= 25][i],
            })));
        });
        return () => { dead = true; };
    }, []);

    // ---- Handlers (original logic kept) ----
    const handleCreateRoom = (e) => {
        e.preventDefault();

        const name = createName.trim();

        if (!name) {
            setCreateError("Please enter your name.");
            return;
        }

        setCreateError("");
        setCreateLoading(true);

        const playerId = getPlayerId();

        const createRoom = () => {
            socket.emit(
                "create_room",
                {
                    playerId,
                    name,
                    mode: isPrivate ? "private" : "pvp",
                },
                (response) => {
                    setCreateLoading(false);

                    if (!response?.success) {
                        setCreateError(
                            response?.message ||
                            "Could not create room. Please try again."
                        );
                        return;
                    }

                    console.log(
                        "✅ Room created:",
                        response
                    );

                    const room = response.room;
                    localStorage.setItem("pokemon_room_id", room.roomId);
                    // Go to Lobby
                    navigate(`/lobby/${room.roomId}`);
                }
            );
        };

        // Socket already connected
        if (socket.connected) {
            createRoom();
            return;
        }

        // Socket not connected → wait for connection
        socket.once("connect", createRoom);
        socket.connect();
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();

        const code = joinCode.trim().toUpperCase();
        const name = joinName.trim();

        if (!code) {
            setJoinError("Please enter the room code.");
            return;
        }

        if (!name) {
            setJoinError("Please enter your name.");
            return;
        }

        setJoinError("");
        setJoinLoading(true);

        const playerId = getPlayerId();

        const joinRoom = () => {
            socket.emit(
                "join_room",
                {
                    playerId,
                    name,
                },
                (response) => {
                    setJoinLoading(false);

                    if (!response?.success) {
                        setJoinError(
                            response?.message ||
                            "Could not join the room. Check the code and try again."
                        );
                        return;
                    }

                    console.log("✅ Joined room:", response);
                    localStorage.setItem("pokemon_room_id", code);
                    navigate(`/lobby/${code}`);
                }
            );
        };

        // Socket already connected
        if (socket.connected) {
            joinRoom();
            return;
        }

        // Socket not connected → wait for connect
        socket.once("connect", joinRoom);

        socket.connect();
    };

    const adventures = [
        { num: 1, icon: "📅", title: "Daily Challenge", desc: "A random Pokémon to guess every game", cls: "adv-1", action: () => navigate("/solo") },
        { num: 2, icon: "⚔️", title: "Quick PVP Battle", desc: "Face off against other players", cls: "adv-2", action: () => navigate("/pvp") },
        { num: 3, icon: "➕", title: "Create Room", desc: "Invite friends to play", cls: "adv-3", action: () => scrollToId("createCard") },
        { num: 4, icon: "🚪", title: "Join Room", desc: "Enter a room code to join", cls: "adv-4", action: () => scrollToId("joinCard") },
    ];

    const journeySteps = [
        { icon: "🏁", label: "Start" },
        { icon: "🌲", label: "Pick Pokémon" },
        { icon: "❓", label: "Ask Questions" },
        { icon: "🔍", label: "Deduce" },
        { icon: "🏆", label: "Guess Right" },
    ];

    // ---- Render ----
    return (
        <>
            <div className="bg-layer" aria-hidden="true">
                <div className="radial-glow"></div>
                <div className="radial-glow-2"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
                <div className="particle"></div>
            </div>

            <div className="home-container" id="app">

                <div className="top-bar" ref={barRef}>
                    <Link to="/" className="top-brand" aria-label="Home">
                        <span className="top-ball" aria-hidden="true"></span>
                        <span className="top-name">GUESS MY<br />POKÉMON</span>
                    </Link>
                    <div className="top-auth">
                        {user ? (
                            <div className="auth-menu">
                                <span className="auth-hello">Hello, {user.name}</span>
                                <button className="settings-btn" onClick={logout}>
                                    Log out
                                </button>
                            </div>
                        ) : (
                            <div className="auth-menu">
                                <Link to="/login" className="settings-btn">Log in</Link>
                                <Link to="/register" className="settings-btn">Sign up</Link>
                            </div>
                        )}
                        <button className="settings-btn" id="settingsBtn" aria-label="Settings">
                            <i className="fas fa-sliders-h"></i>
                            <span>Settings</span>
                        </button>
                    </div>
                </div>

                <header className="brand-header">
                    <span className="daily-tag hero-tag">⚡ Daily Challenge</span>
                    <div className="hero-silhouette">
                        {daily?.sprite ? (
                            <img className="silhouette" src={daily.sprite} alt="Mystery Pokémon silhouette" />
                        ) : (
                            <span className="mystery-loading">❓</span>
                        )}
                    </div>
                    <h1 className="brand-title">WHO'S THAT POKÉMON?</h1>
                    <p className="daily-sub">Every game hides a random Pokémon — can you guess it?</p>
                    <div className="hero-countdown">
                        <span className="cd-label">Leaderboard resets in</span>
                        <span className="cd-time">{countdown}</span>
                    </div>
                    <button className="btn-primary btn-daily" onClick={() => navigate("/solo")}>
                        ⚡ Guess Now
                    </button>
                </header>

                {/* Mystery + Choose your challenge */}
                <section className="hero-row">
                    <div className="mystery-card">
                        <div className="mystery-band">MYSTERY POKÉMON</div>
                        <div className="mystery-stage">
                            {mysteryLoading ? (
                                <span className="mystery-loading">❓</span>
                            ) : mystery?.sprite ? (
                                <img className="silhouette" src={mystery.sprite} alt="Secret Pokémon" />
                            ) : (
                                <span className="mystery-loading">❓</span>
                            )}
                        </div>
                        <div className="mystery-name">?????</div>
                        <div className="mystery-stats">
                            <span className="mstat">TYPE: ???</span>
                            <span className="mstat">TYPE: ???</span>
                            <span className="mstat">HEIGHT: ???</span>
                            <span className="mstat">ABILITY: ???</span>
                        </div>
                        <div className="mystery-actions">
                            <button className="mini-btn" onClick={loadMystery} title="Get another Pokémon">
                                🎲 Shuffle
                            </button>
                            <button className="btn-primary btn-guess" onClick={() => navigate("/solo")}>
                                [ Guess Pokémon ]
                            </button>
                        </div>
                    </div>

                    <div className="adventure" id="adventure">
                        <h2 className="section-title">CHOOSE YOUR CHALLENGE</h2>
                        <div className="adventure-grid">
                            {adventures.map((a) => (
                                <button key={a.num} className={`adventure-card ${a.cls}`} onClick={a.action}>
                                    <span className="adv-num">{a.num}.</span>
                                    <span className="adv-icon">{a.icon}</span>
                                    <span className="adv-title">{a.title}</span>
                                    <span className="adv-desc">{a.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Journey */}
                <section className="journey">
                    <div className="journey-path">
                        {journeySteps.map((s, i) => (
                            <React.Fragment key={s.label}>
                                {i > 0 && <span className="jline" aria-hidden="true"></span>}
                                <div className="jnode">
                                    <span className="jnode-icon">{s.icon}</span>
                                    <span className="jnode-label">{s.label}</span>
                                </div>
                            </React.Fragment>
                        ))}
                    </div>
                </section>

                {/* Top trainers + Pokedex */}
                <section className="mid-row">
                    <div className="trainers">
                        <h2 className="section-title">TOP TRAINERS</h2>
                        {topTrainers === null ? (
                            <p className="muted">Loading...</p>
                        ) : topTrainers.length === 0 ? (
                            <p className="muted">No one has played yet. Be the first!</p>
                        ) : (
                            <div className="podium">
                                {topTrainers.map((t, i) => (
                                    <div key={t.id || i} className={`podium-place p${i + 1}`}>
                                        <span className="podium-rank">#{i + 1}</span>
                                        <span className="podium-avatar">
                                            {(t.playerName || "?").charAt(0).toUpperCase()}
                                        </span>
                                        <span className="podium-name">{t.playerName || "???"}</span>
                                        <span className="podium-score">{t.score} pts</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button className="mini-btn" onClick={() => navigate("/solo")}>
                            View Leaderboard
                        </button>
                    </div>

                    <div className="pokedex">
                        <h2 className="section-title">YOUR POKÉDEX</h2>
                        <div className="dex-grid">
                            {dex.map((p) => (
                                <div key={p.id} className="dex-card">
                                    {p.sprite ? (
                                        <img src={p.sprite} alt={p.name} loading="lazy" />
                                    ) : (
                                        <span>❓</span>
                                    )}
                                    <span className="dex-name">{p.name}</span>
                                    <span className="dex-id">#{String(p.id).padStart(3, "0")}</span>
                                    <span className="dex-types">
                                        {p.types.map((t) => (
                                            <span
                                                key={t}
                                                className="dex-type"
                                                style={{ background: TYPE_COLOR[t] || "#A8A878" }}
                                            >
                                                {(TYPE_LABELS[t] || [t])[1]} {(TYPE_LABELS[t] || [t])[0]}
                                            </span>
                                        ))}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <span className="dex-count">{dex.length} / {MAX_POKEMON_ID} Pokémon</span>
                    </div>
                </section>

                {/* Achievements */}
                <section className="achievements">
                    <h2 className="section-title">ACHIEVEMENTS</h2>
                    <div className="ach-grid">
                        {achievements.map((a) => (
                            <div key={a.label} className={`ach-badge${a.unlocked ? "" : " locked"}`}>
                                <span className="ach-icon">{a.unlocked ? a.icon : "🔒"}</span>
                                <span className="ach-label">{a.label}</span>
                                <span className="ach-desc">{a.desc}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Game rooms */}
                <section className="rooms" id="rooms">
                    <h2 className="section-title">GAME ROOMS</h2>
                    <div className="cards-grid">
                        <div className="action-card create-card" id="createCard">
                            <div className="card-header">
                                <div className="card-icon"><i className="fas fa-plus-circle"></i></div>
                                <div className="card-title-group">
                                    <span className="card-title">Create Room</span>
                                    <span className="card-subtitle">Start a new game with friends</span>
                                </div>
                            </div>

                            <form className="card-form" id="createForm" autocomplete="off" onSubmit={handleCreateRoom}>
                                <div className="form-group">
                                    <label className="form-label" for="createName">Your name</label>
                                    <input
                                        className="form-input"
                                        id="createName"
                                        type="text"
                                        placeholder="Enter your display name..."
                                        maxLength="20"
                                        value={createName}
                                        onChange={(e) => setCreateName(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <div className="toggle-group">
                                        <label className="toggle-label" for="privateToggle">Private Room</label>
                                        <div className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                id="privateToggle"
                                                checked={isPrivate}
                                                onChange={(e) => setIsPrivate(e.target.checked)}
                                            />
                                            <span className="toggle-slider"></span>
                                        </div>
                                    </div>
                                </div>

                                {createError && <p className="form-error">{createError}</p>}

                                <button
                                    type="submit"
                                    className={`btn-primary btn-create${createLoading ? " loading" : ""}`}
                                    id="createBtn"
                                    disabled={createLoading}
                                >
                                    <span className="btn-text">
                                        {createLoading ? "Creating..." : "Create Room"}
                                    </span>
                                    <span className="btn-loader" aria-hidden="true"></span>
                                </button>
                            </form>
                        </div>

                        <div className="action-card join-card" id="joinCard">
                            <div className="card-header">
                                <div className="card-icon"><i className="fas fa-door-open"></i></div>
                                <div className="card-title-group">
                                    <span className="card-title">Join</span>
                                    <span className="card-subtitle">Enter a room code to join the battle</span>
                                </div>
                            </div>

                            <form className="card-form" id="joinForm" autocomplete="off" onSubmit={handleJoinRoom}>
                                <div className="form-group">
                                    <label className="form-label" for="joinRoomCode">Room Code</label>
                                    <input
                                        className="form-input room-code-input"
                                        id="joinRoomCode"
                                        type="text"
                                        placeholder="e.g. A7B3C9"
                                        maxLength="10"
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" for="joinName">Your name</label>
                                    <input
                                        className="form-input"
                                        id="joinName"
                                        type="text"
                                        placeholder="Enter your display name..."
                                        maxLength="20"
                                        value={joinName}
                                        onChange={(e) => setJoinName(e.target.value)}
                                        required
                                    />
                                </div>

                                {joinError && <p className="form-error">{joinError}</p>}

                                <button
                                    type="submit"
                                    className={`btn-primary btn-join${joinLoading ? " loading" : ""}`}
                                    id="joinBtn"
                                    disabled={joinLoading}
                                >
                                    <span className="btn-text">
                                        {joinLoading ? "Joining..." : "Join Room"}
                                    </span>
                                    <span className="btn-loader" aria-hidden="true"></span>
                                </button>
                            </form>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="cta-banner">
                    <h2 className="cta-title">YOUR NEXT ADVENTURE<br />STARTS HERE.</h2>
                    <button className="btn-primary btn-cta" onClick={() => scrollToId("adventure")}>
                        Start Playing
                    </button>
                </section>

                <footer className="home-footer">
                    <div className="footer-brand">
                        <span className="footer-ball" aria-hidden="true"></span>
                        <span className="footer-name">GUESS MY<br />POKÉMON</span>
                    </div>
                    <div className="footer-links">
                        <Link to="/solo">Daily Challenge</Link>
                        <Link to="/pvp">PVP Battle</Link>
                        <Link to="/">Home</Link>
                    </div>
                    <p className="footer-copy">© 2026 Guess My Pokémon</p>
                </footer>

            </div>
        </>
    );
}

export default Home;
