// =====================================================
// Seed Pokemon metadata vào MongoDB — CHẠY 1 LẦN DUY NHẤT
// (hoặc chạy lại bất cứ lúc nào, an toàn vì dùng upsert).
//
//   cd D:\Render\guessMyPokemon\backend
//   node scripts/seedPokemons.js
//
// Yêu cầu: file .env có MONGODB_URI.
// Luồng: preloadPokemonMetadata() sẽ thấy collection "pokemons"
// trống -> tải từ PokeAPI (batch 20, mất vài phút) -> tự
// upsert toàn bộ vào MongoDB. Lần chạy sau nếu đã có dữ
// liệu thì script thoát ngay.
// =====================================================

const path = require("path");

// Nạp .env: thử từ thư mục hiện tại, fallback về backend/.env
require("dotenv").config();
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
    connectMongo,
    closeMongo,
    isMongoReady,
} = require("../db/mongo");
const { preloadPokemonMetadata } = require("../services/pokemonService");

(async () => {
    console.log("[seed] Đang kết nối MongoDB...");

    await connectMongo();

    if (!isMongoReady()) {
        console.error(
            "[seed] MONGODB_URI chưa được set hoặc kết nối thất bại."
        );
        console.error(
            "[seed] Hãy thêm MONGODB_URI vào file backend/.env rồi chạy lại."
        );
        process.exit(1);
    }

    console.log("[seed] Bắt đầu seed Pokemon metadata...");
    console.log(
        "[seed] Lần đầu sẽ tải từ PokeAPI (khoảng 1000+ Pokemon, mất vài phút)."
    );

    await preloadPokemonMetadata();

    await closeMongo();

    console.log("[seed] Xong. Từ giờ server sẽ đọc từ MongoDB.");
    process.exit(0);
})().catch((error) => {
    console.error("[seed] Lỗi:", error);
    process.exit(1);
});
