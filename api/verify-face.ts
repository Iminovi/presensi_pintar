import Groq from "groq-sdk";

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

  const groqApiKey = process.env.GROQ_API_KEY;
  
  if (!groqApiKey) {
    return res.status(500).json({
      error: "Groq API key is not configured on the server.",
    });
  }

  const groq = new Groq({
    apiKey: groqApiKey,
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

    const liveUrl = `data:${live.mimeType};base64,${live.data}`;
    const profileUrl = `data:${profile.mimeType};base64,${profile.data}`;

    // Analisis dengan Groq (Llama 3.2 Vision)
    const completion = await groq.chat.completions.create({
      model: "llama-3.2-90b-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Anda adalah AI pemverifikasi wajah. Bandingkan dua foto wajah ini. Apakah ini orang yang sama? Evaluasi kemiripannya secara ketat. Anda WAJIB merespons HANYA dengan format JSON valid yang memiliki 3 properti: 'verified' (boolean true/false), 'confidence' (angka 0-100), dan 'reason' (string alasan maksimal 2 kalimat)." },
            { type: "image_url", image_url: { url: liveUrl } },
            { type: "image_url", image_url: { url: profileUrl } }
          ]
        }
      ],
      temperature: 0.1
    });

    let responseText = completion.choices[0]?.message?.content || "{}";
    
    // Bersihkan teks jika AI menyelipkan blok markdown (contoh: ```json ... ```)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }

    const resultObj = JSON.parse(responseText.trim());

    return res.status(200).json({ success: true, comparison: resultObj });
  } catch (error: any) {
    console.error("Error during face verification:", error);
    
    let errorMsg = error.message || String(error);
    if (errorMsg.includes("429") || errorMsg.includes("rate limit")) {
      errorMsg = "Server AI sedang sibuk atau melampaui limit. Silakan coba lagi.";
    }

    return res.status(500).json({
      error: errorMsg,
    });
  }
}
