// server.js
// Ini adalah "kantor kecil" yang menghubungkan aplikasi Unity Anda ke Google Gemini (AI gratis).
// Unity mengirim pertanyaan ke sini, lalu file ini yang menghubungi Gemini,
// dan mengirim balik jawabannya ke Unity.

const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// ============================================================
// GANTI BAGIAN INI sesuai maskot & topik AR Anda
// ============================================================
const SYSTEM_PROMPT = `
Kamu adalah maskot AR edukatif tentang IMIGRASI.
Kamu HANYA boleh menjawab pertanyaan seputar topik: keimigrasian (paspor, visa, izin tinggal, keluar-masuk Indonesia, dan layanan imigrasi lainnya).
Jika user bertanya di luar topik tersebut, tolak dengan sopan dan ajak kembali ke topik yang kamu kuasai.
Jawab dengan bahasa Indonesia yang ramah dan singkat (maksimal 3-4 kalimat), mudah dipahami.
`;
// ============================================================

// Model gratis dari Google Gemini (kuota harian cukup besar, tanpa kartu kredit)
const GEMINI_MODEL = "gemini-3-flash";

// Ini alamat yang nanti dipanggil dari Unity
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "Pesan kosong" });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Kunci rahasia diambil dari Environment Variable, BUKAN ditulis di sini
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Gemini error:", data.error);
      return res.status(500).json({ error: "Gemini menolak permintaan: " + data.error.message });
    }

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Maaf, aku belum bisa menjawab itu sekarang.";

    res.json({ reply: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// Alamat sederhana untuk cek apakah server hidup (buka di browser nanti untuk tes)
app.get("/", (req, res) => {
  res.send("Server maskot AI aktif ✅ (pakai Google Gemini)");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server jalan di port " + PORT));
