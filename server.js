// server.js
// Ini adalah "kantor kecil" yang menghubungkan aplikasi Unity Anda ke OpenAI (ChatGPT).
// Unity mengirim pertanyaan ke sini, lalu file ini yang menghubungi OpenAI,
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
Kamu adalah maskot AR edukatif bernama [NAMA MASKOT ANDA].
Kamu HANYA boleh menjawab pertanyaan seputar topik: [TULIS TOPIK ANDA DI SINI].
Jika user bertanya di luar topik tersebut, tolak dengan sopan dan ajak kembali ke topik yang kamu kuasai.
Jawab dengan bahasa Indonesia yang ramah dan singkat (maksimal 3-4 kalimat), mudah dipahami.
`;
// ============================================================

// Ini alamat yang nanti dipanggil dari Unity
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "Pesan kosong" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Kunci rahasia diambil dari Environment Variable, BUKAN ditulis di sini
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: "gpt-4.1-nano", // model paling murah, cukup untuk chatbot ringan
        max_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("OpenAI error:", data.error);
      return res.status(500).json({ error: "OpenAI menolak permintaan: " + data.error.message });
    }

    const reply = data.choices?.[0]?.message?.content || "Maaf, aku belum bisa menjawab itu sekarang.";

    res.json({ reply: reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// Alamat sederhana untuk cek apakah server hidup (buka di browser nanti untuk tes)
app.get("/", (req, res) => {
  res.send("Server maskot AI aktif ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server jalan di port " + PORT));
