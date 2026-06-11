import { GoogleGenAI, Type } from "@google/genai";

// Konfigurasi Vercel untuk menaikkan batas ukuran payload gambar
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  // Pastikan hanya menerima request POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const genaiApiKey = process.env.GEMINI_API_KEY;
  
  if (!genaiApiKey) {
    return res.status(500).json({
      error: "Gemini API key is not configured on the server.",
    });
  }

  const ai = new GoogleGenAI({
    apiKey: genaiApiKey,
  });

  try {
    const { livePhoto, profilePhoto } = req.body;

    if (!livePhoto || !profilePhoto) {
      return res.status(400).json({ error: "Missing livePhoto or profilePhoto data." });
    }

    // Membersihkan prefix base64
    const cleanBase64 = (str: string) => {
      const match = str.match(/^data:([^;]+);base64,(.*)$/);
      if (match) return { mimeType: match[1], data: match[2] };
      return { mimeType: "image/jpeg", data: str };
    };

    const live = cleanBase64(livePhoto);
    const profile = cleanBase64(profilePhoto);

    // Analisis dengan Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { inlineData: { data: live.data, mimeType: live.mimeType } },
        { inlineData: { data: profile.data, mimeType: profile.mimeType } },
        "Bandingkan kedua foto wajah di atas. Foto 1 adalah foto live karyawan saat melakukan absen mandiri via smartphone. Foto 2 adalah foto referensi profil karyawan yang telah terdaftar. Verifikasi apakah wajah di Foto 1 adalah orang yang sama dengan yang ada di Foto 2. Mohon analisa landmark wajah utama seperti mata, hidung, mulut, bentuk wajah, kerutan, dan kemiripan biometrik lainnya meskipun ada perbedaan pencahayaan atau ekspresi. Berikan respon akhir Anda dalam format JSON terstruktur.",
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verified: { type: Type.BOOLEAN },
            confidence: { type: Type.NUMBER },
            reason: { type: Type.STRING },
          },
          required: ["verified", "confidence", "reason"],
        },
      },
    });

    const responseText = response.text || "{}";
    const resultObj = JSON.parse(responseText.trim());

    return res.status(200).json({ success: true, comparison: resultObj });
  } catch (error: any) {
    console.error("Error during face verification:", error);
    
    let errorMsg = error.message || String(error);
    if (errorMsg.includes("503") || errorMsg.includes("high demand") || errorMsg.includes("UNAVAILABLE")) {
      errorMsg = "Server AI Google sedang sibuk. Silakan coba klik tombol absen sekali lagi dalam beberapa detik.";
    }

    return res.status(500).json({
      error: errorMsg,
    });
  }
}
