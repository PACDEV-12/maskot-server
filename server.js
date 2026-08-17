// server.js
// Kantor kecil penghubung Unity ke Gemini AI.
// Alurnya: terima pertanyaan teks -> minta Gemini jawab teks -> minta Gemini ubah
// jawaban itu jadi suara -> kirim teks + suara (base64) sekaligus balik ke Unity.

const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// ============================================================
// GANTI BAGIAN INI sesuai maskot & topik AR Anda
// ============================================================
const SYSTEM_PROMPT = `
Kamu adalah maskot AR bernama Maskot Tanjung Perak, asisten AI yang ramah dan bisa diajak diskusi tentang topik apa saja, terutama seputar layanan Imigrasi Tanjung Perak.
Jawab pertanyaan apapun dari user dengan pengetahuan umum yang kamu miliki, sejelas dan seakurat mungkin.
Tetap jaga sopan santun: hindari bahasa kasar, konten dewasa, atau hal yang tidak pantas untuk audiens umum/pelajar.
Jawab dengan bahasa Indonesia yang ramah dan singkat (maksimal 3-4 kalimat), mudah dipahami.
`;
// ============================================================

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const CHAT_MODEL = "gemini-3.5-flash";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "Pesan kosong" });
    }

    // ---------- LANGKAH 1: minta Gemini jawab dalam bentuk teks ----------
    const chatResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
        }),
      }
    );

    const chatData = await chatResponse.json();

    // 🔍 LOG SEMENTARA untuk debugging — hapus lagi setelah masalah ketemu.
    // Ini akan muncul di tab "Logs" pada dashboard Render Anda.
    console.log("Status HTTP dari Gemini (chat):", chatResponse.status);
    console.log("Isi respons Gemini (chat):", JSON.stringify(chatData));

    const replyText =
      chatData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Maaf, aku belum bisa menjawab itu sekarang.";

    // ---------- LANGKAH 2: minta Gemini ubah jawaban tadi jadi suara ----------
    let audioBase64 = null;

    try {
      const ttsResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_KEY,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: replyText }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } },
              },
            },
          }),
        }
      );

      const ttsData = await ttsResponse.json();

      // 🔍 LOG SEMENTARA untuk debugging — hapus lagi setelah masalah ketemu.
      console.log("Status HTTP dari Gemini (TTS):", ttsResponse.status);
      console.log("Isi respons Gemini (TTS):", JSON.stringify(ttsData));

      const audioPart = ttsData.candidates?.[0]?.content?.parts?.[0]?.inlineData;

      if (audioPart?.data) {
        // Gemini mengembalikan audio mentah (PCM), perlu dibungkus jadi format WAV
        // supaya bisa langsung dimainkan sebagai file audio biasa di Unity.
        const sampleRate = extractSampleRate(audioPart.mimeType) || 24000;
        const pcmBuffer = Buffer.from(audioPart.data, "base64");
        const wavBuffer = pcmToWav(pcmBuffer, sampleRate);
        audioBase64 = wavBuffer.toString("base64");
      }
    } catch (ttsErr) {
      console.error("TTS gagal, lanjut tanpa suara:", ttsErr);
      // Kalau suara gagal dibuat, jawaban teks tetap dikirim (tidak fatal).
    }

    res.json({ reply: replyText, audioBase64: audioBase64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Terjadi kesalahan di server" });
  }
});

// Ambil angka sample rate dari teks seperti "audio/L16;rate=24000"
function extractSampleRate(mimeType) {
  if (!mimeType) return null;
  const match = mimeType.match(/rate=(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Membungkus data suara mentah (PCM 16-bit mono) menjadi file WAV yang valid,
// supaya Unity bisa memainkannya seperti file audio pada umumnya.
function pcmToWav(pcmBuffer, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

app.get("/", (req, res) => {
  res.send("Server maskot AI aktif ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server jalan di port " + PORT));
