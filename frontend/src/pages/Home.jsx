// Home.jsx — Trang chủ full cartoon style (theo ảnh mẫu)
// Sections: hero, mystery Pokémon, chọn thử thách (4 actions),
// hành trình, thử thách hôm nay, top trainers, pokédex,
// thành tựu, phòng chơi, CTA, footer.
import React, { useState, useRef, useEffect } from 'react';
import '../css/Home.css';
import { useNavigate } from "react-router-dom";
import socket from "../socket/socket";
import { getPlayerId } from "../utils/playerId";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";
const MAX_POKEMON_ID = 1025;

// Tên + icon hệ Pokémon tiếng Việt
const TYPE_VI = {
    normal: ["Thường", "⚪"], fire: ["Lửa", "🔥"], water: ["Nước", "💧"],
    grass: ["Cỏ", "🍃"], electric: ["Điện", "⚡"], ice: ["Băng", "❄️"],
    fighting: ["Giác đấu", "🥊"], poison: ["Độc", "☠️"], ground: ["Đất", "⛰️"],
    flying: ["Bay", "🕊️"], psychic: ["Tâm linh", "🔮"], bug: ["Bọ", "🐛"],
    rock: ["Đá", "🪨"], ghost: ["Ma", "👻"], dragon: ["Rồng", "🐉"],
    dark: ["Tối", "🌙"], steel: ["Thép", "⚙️"], fairy: ["Tiên", "🧚"],
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

// ID Pokémon của ngày — deterministic theo ngày hiện tại
function dailyPokemonId() {
    const d = new Date();
    const s = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    let h = 0;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return (h % MAX_POKEMON_ID) + 1;
}

function randomPokemonId() {
    return 1 + Math.floor(Math.random() * MAX_POKEMON_ID);
}

// Đếm ngược tới 0h đêm nay
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

    // Sections mới
    const [mystery, setMystery] = useState(null);
    const [mysteryLoading, setMysteryLoading] = useState(true);
    const [daily, setDaily] = useState(null);
    const [dex, setDex] = useState([]);
    const [topTrainers, setTopTrainers] = useState(null); // null = chưa tải xong
    const [achievements, setAchievements] = useState([
        { icon: "🌱", label: "Bước đầu tiên", desc: "Chơi 1 ván solo", unlocked: false },
        { icon: "🔥", label: "Chăm chỉ", desc: "Chơi 10 ván solo", unlocked: false },
        { icon: "🎯", label: "Thợ săn tài ba", desc: "Đạt 80đ solo", unlocked: false },
        { icon: "⚔️", label: "Chiến binh PVP", desc: "Chơi 1 ván PVP", unlocked: false },
        { icon: "🏆", label: "Kẻ chiến thắng", desc: "Thắng 1 ván PVP", unlocked: false },
        { icon: "👑", label: "Huyền thoại", desc: "Chơi 25 ván", unlocked: false },
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

    // ---- GSAP: hero fullscreen thu gọn sang hai bên + header dock khi scroll ----
    useEffect(() => {
        const bar = barRef.current;
        const container = document.querySelector(".home-container");
        if (!bar) return;

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        // Fallback khi không có GSAP hoặc giảm chuyển động: toggle class CSS
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
            // Hero daily: từng phần tử thu gọn bay sang hai bên
            tl.to(".brand-header .hero-tag", { x: -140, opacity: 0 }, 0)
                .to(".brand-header .hero-silhouette", { scale: 0.5, opacity: 0 }, 0)
                .to(".brand-header .brand-title", { x: 160, opacity: 0 }, 0)
                .to(".brand-header .daily-sub", { x: -130, opacity: 0 }, 0)
                .to(".brand-header .hero-countdown", { x: 130, opacity: 0 }, 0)
                .to(".brand-header .btn-daily", { x: -170, opacity: 0 }, 0)
                // Header: nền đặc -> trong suốt khi scroll xuống
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

    // ---- Mystery Pokémon ngẫu nhiên ----
    const loadMystery = () => {
        setMysteryLoading(true);
        fetchPokemon(randomPokemonId())
            .then(setMystery)
            .catch(() => setMystery(null))
            .finally(() => setMysteryLoading(false));
    };
    useEffect(() => { loadMystery(); }, []);

    // ---- Thử thách hôm nay (theo ngày) ----
    useEffect(() => {
        let dead = false;
        fetchPokemon(dailyPokemonId())
            .then((p) => { if (!dead) setDaily(p); })
            .catch(() => {});
        return () => { dead = true; };
    }, []);

    // ---- Pokédex mini ----
    useEffect(() => {
        let dead = false;
        Promise.all(DEX_IDS.map((id) => fetchPokemon(id).catch(() => null)))
            .then((list) => { if (!dead) setDex(list.filter(Boolean)); });
        return () => { dead = true; };
    }, []);

    // ---- Top trainers (solo leaderboard thật) ----
    useEffect(() => {
        let dead = false;
        fetch(`${API_BASE}/api/solo/leaderboard/top?limit=3`)
            .then((r) => r.json())
            .then((j) => { if (!dead && j?.success) setTopTrainers(j.data || []); })
            .catch(() => { if (!dead) setTopTrainers([]); });
        return () => { dead = true; };
    }, []);

    // ---- Thành tựu (dữ liệu thật từ leaderboard) ----
    useEffect(() => {
        let dead = false;
        const pid = getPlayerId();
        Promise.all([
            fetch(`${API_BASE}/api/solo/leaderboard/player/${pid}`).then((r) => r.json()).catch(() => null),
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

    // ---- Handlers (giữ nguyên logic cũ) ----
    const handleCreateRoom = (e) => {
        e.preventDefault();

        const name = createName.trim();

        if (!name) {
            setCreateError("Vui lòng nhập tên của bạn.");
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
                            "Không thể tạo phòng. Vui lòng thử lại."
                        );
                        return;
                    }

                    console.log(
                        "✅ Tạo phòng thành công:",
                        response
                    );

                    const room = response.room;
                    localStorage.setItem("pokemon_room_id", room.roomId);
                    // Chuyển sang Lobby
                    navigate(`/lobby/${room.roomId}`);
                }
            );
        };

        // Socket đã kết nối
        if (socket.connected) {
            createRoom();
            return;
        }

        // Socket chưa kết nối → chờ kết nối
        socket.once("connect", createRoom);
        socket.connect();
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();

        const code = joinCode.trim().toUpperCase();
        const name = joinName.trim();

        if (!code) {
            setJoinError("Vui lòng nhập mã phòng.");
            return;
        }

        if (!name) {
            setJoinError("Vui lòng nhập tên của bạn.");
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
                            "Không thể tham gia phòng. Kiểm tra mã phòng và thử lại."
                        );
                        return;
                    }

                    console.log("✅ Tham gia phòng thành công:", response);
                    localStorage.setItem("pokemon_room_id", code);
                    navigate(`/lobby/${code}`);
                }
            );
        };

        // Socket đã kết nối
        if (socket.connected) {
            joinRoom();
            return;
        }

        // Socket chưa kết nối → đợi connect
        socket.once("connect", joinRoom);

        socket.connect();
    };

    const adventures = [
        { num: 1, icon: "🤖", title: "Chơi với máy", desc: "Đoán Pokémon qua câu hỏi", cls: "adv-1", action: () => navigate("/solo") },
        { num: 2, icon: "⚔️", title: "Đấu nhanh PVP", desc: "So tài với người chơi khác", cls: "adv-2", action: () => navigate("/pvp") },
        { num: 3, icon: "➕", title: "Tạo phòng", desc: "Mời bạn bè cùng chơi", cls: "adv-3", action: () => scrollToId("createCard") },
        { num: 4, icon: "🚪", title: "Vào phòng", desc: "Nhập mã phòng để tham gia", cls: "adv-4", action: () => scrollToId("joinCard") },
    ];

    const journeySteps = [
        { icon: "🏁", label: "Bắt đầu" },
        { icon: "🌲", label: "Chọn Pokémon" },
        { icon: "❓", label: "Đặt câu hỏi" },
        { icon: "🔍", label: "Suy luận" },
        { icon: "🏆", label: "Đoán đúng" },
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
                    <Link to="/" className="top-brand" aria-label="Trang chủ">
                        <span className="top-ball" aria-hidden="true"></span>
                        <span className="top-name">GUESS MY<br />POKÉMON</span>
                    </Link>
                    <div className="top-auth">
                        {user ? (
                            <div className="auth-menu">
                                <span className="auth-hello">Xin chào, {user.name}</span>
                                <button className="settings-btn" onClick={logout}>
                                    Đăng xuất
                                </button>
                            </div>
                        ) : (
                            <div className="auth-menu">
                                <Link to="/login" className="settings-btn">Đăng nhập</Link>
                                <Link to="/register" className="settings-btn">Đăng ký</Link>
                            </div>
                        )}
                        <button className="settings-btn" id="settingsBtn" aria-label="Cài đặt">
                            <i className="fas fa-sliders-h"></i>
                            <span>Cài đặt</span>
                        </button>
                    </div>
                </div>

                <header className="brand-header">
                    <span className="daily-tag hero-tag">⚡ Thử thách hôm nay</span>
                    <div className="hero-silhouette">
                        {daily?.sprite ? (
                            <img className="silhouette" src={daily.sprite} alt="Pokémon bí mật hôm nay" />
                        ) : (
                            <span className="mystery-loading">❓</span>
                        )}
                    </div>
                    <h1 className="brand-title">WHO'S THAT POKÉMON?</h1>
                    <p className="daily-sub">Bạn có nhận ra Pokémon hôm nay không?</p>
                    <div className="hero-countdown">
                        <span className="cd-label">Thử thách mới sau</span>
                        <span className="cd-time">{countdown}</span>
                    </div>
                    <button className="btn-primary btn-daily" onClick={() => navigate("/solo")}>
                        ⚡ Đoán ngay
                    </button>
                </header>

                {/* Mystery + Chọn thử thách */}
                <section className="hero-row">
                    <div className="mystery-card">
                        <div className="mystery-band">MYSTERY POKÉMON</div>
                        <div className="mystery-stage">
                            {mysteryLoading ? (
                                <span className="mystery-loading">❓</span>
                            ) : mystery?.sprite ? (
                                <img className="silhouette" src={mystery.sprite} alt="Pokémon bí mật" />
                            ) : (
                                <span className="mystery-loading">❓</span>
                            )}
                        </div>
                        <div className="mystery-name">?????</div>
                        <div className="mystery-stats">
                            <span className="mstat">TYPE: ???</span>
                            <span className="mstat">HỆ: ???</span>
                            <span className="mstat">CHIỀU CAO: ???</span>
                            <span className="mstat">KHẢ NĂNG: ???</span>
                        </div>
                        <div className="mystery-actions">
                            <button className="mini-btn" onClick={loadMystery} title="Đổi Pokémon khác">
                                🎲 Đổi
                            </button>
                            <button className="btn-primary btn-guess" onClick={() => navigate("/solo")}>
                                [ Đoán Pokémon ]
                            </button>
                        </div>
                    </div>

                    <div className="adventure" id="adventure">
                        <h2 className="section-title">CHỌN THỬ THÁCH CỦA BẠN</h2>
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

                {/* Hành trình */}
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

                {/* Top trainers + Pokédex */}
                <section className="mid-row">
                    <div className="trainers">
                        <h2 className="section-title">TOP HUẤN LUYỆN VIÊN</h2>
                        {topTrainers === null ? (
                            <p className="muted">Đang tải...</p>
                        ) : topTrainers.length === 0 ? (
                            <p className="muted">Chưa có ai chơi. Hãy là người đầu tiên!</p>
                        ) : (
                            <div className="podium">
                                {topTrainers.map((t, i) => (
                                    <div key={t.id || i} className={`podium-place p${i + 1}`}>
                                        <span className="podium-rank">#{i + 1}</span>
                                        <span className="podium-avatar">
                                            {(t.playerName || "?").charAt(0).toUpperCase()}
                                        </span>
                                        <span className="podium-name">{t.playerName || "???"}</span>
                                        <span className="podium-score">{t.score}đ</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button className="mini-btn" onClick={() => navigate("/solo")}>
                            Xem bảng xếp hạng
                        </button>
                    </div>

                    <div className="pokedex">
                        <h2 className="section-title">POKÉDEX CỦA BẠN</h2>
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
                                                {(TYPE_VI[t] || [t])[1]} {(TYPE_VI[t] || [t])[0]}
                                            </span>
                                        ))}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <span className="dex-count">{dex.length} / {MAX_POKEMON_ID} Pokémon</span>
                    </div>
                </section>

                {/* Thành tựu */}
                <section className="achievements">
                    <h2 className="section-title">THÀNH TỰU</h2>
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

                {/* Phòng chơi */}
                <section className="rooms" id="rooms">
                    <h2 className="section-title">PHÒNG CHƠI</h2>
                    <div className="cards-grid">
                        <div className="action-card create-card" id="createCard">
                            <div className="card-header">
                                <div className="card-icon"><i className="fas fa-plus-circle"></i></div>
                                <div className="card-title-group">
                                    <span className="card-title">Tạo phòng</span>
                                    <span className="card-subtitle">Bắt đầu một ván chơi mới với bạn bè</span>
                                </div>
                            </div>

                            <form className="card-form" id="createForm" autocomplete="off" onSubmit={handleCreateRoom}>
                                <div className="form-group">
                                    <label className="form-label" for="createName">Tên của bạn</label>
                                    <input
                                        className="form-input"
                                        id="createName"
                                        type="text"
                                        placeholder="Nhập tên hiển thị..."
                                        maxLength="20"
                                        value={createName}
                                        onChange={(e) => setCreateName(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <div className="toggle-group">
                                        <label className="toggle-label" for="privateToggle">Phòng riêng tư</label>
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
                                        {createLoading ? "Đang tạo..." : "Tạo phòng"}
                                    </span>
                                    <span className="btn-loader" aria-hidden="true"></span>
                                </button>
                            </form>
                        </div>

                        <div className="action-card join-card" id="joinCard">
                            <div className="card-header">
                                <div className="card-icon"><i className="fas fa-door-open"></i></div>
                                <div className="card-title-group">
                                    <span className="card-title">Tham gia</span>
                                    <span className="card-subtitle">Nhập mã phòng để tham gia trận đấu</span>
                                </div>
                            </div>

                            <form className="card-form" id="joinForm" autocomplete="off" onSubmit={handleJoinRoom}>
                                <div className="form-group">
                                    <label className="form-label" for="joinRoomCode">Mã phòng</label>
                                    <input
                                        className="form-input room-code-input"
                                        id="joinRoomCode"
                                        type="text"
                                        placeholder="VD: A7B3C9"
                                        maxLength="10"
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" for="joinName">Tên của bạn</label>
                                    <input
                                        className="form-input"
                                        id="joinName"
                                        type="text"
                                        placeholder="Nhập tên hiển thị..."
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
                                        {joinLoading ? "Đang vào..." : "Vào phòng"}
                                    </span>
                                    <span className="btn-loader" aria-hidden="true"></span>
                                </button>
                            </form>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="cta-banner">
                    <h2 className="cta-title">CHUYẾN PHIÊU LƯU TIẾP THEO<br />BẮT ĐẦU TỪ ĐÂY.</h2>
                    <button className="btn-primary btn-cta" onClick={() => scrollToId("adventure")}>
                        Bắt đầu chơi
                    </button>
                </section>

                <footer className="home-footer">
                    <div className="footer-brand">
                        <span className="footer-ball" aria-hidden="true"></span>
                        <span className="footer-name">GUESS MY<br />POKÉMON</span>
                    </div>
                    <div className="footer-links">
                        <Link to="/solo">Chơi solo</Link>
                        <Link to="/pvp">Đấu PVP</Link>
                        <Link to="/">Trang chủ</Link>
                    </div>
                    <p className="footer-copy">© 2026 Guess My Pokémon</p>
                </footer>

            </div>
        </>
    );
}

export default Home;