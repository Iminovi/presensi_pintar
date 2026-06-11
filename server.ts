import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set higher limit to allow base64 images upload
  app.use(express.json({ limit: "15mb" }));

  // Initialize Gemini client on server level securely
  const genaiApiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  
  if (genaiApiKey) {
    ai = new GoogleGenAI({
      apiKey: genaiApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  // API router
  app.post("/api/verify-face", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({
          error: "Gemini API key is not configured on the server. Please configure GEMINI_API_KEY.",
        });
      }

      const { livePhoto, profilePhoto } = req.body;

      if (!livePhoto || !profilePhoto) {
        return res.status(400).json({ error: "Missing livePhoto or profilePhoto data." });
      }

      // Clean base64 prefixes if present
      const cleanBase64 = (str: string) => {
        const match = str.match(/^data:([^;]+);base64,(.*)$/);
        if (match) {
          return { mimeType: match[1], data: match[2] };
        }
        return { mimeType: "image/jpeg", data: str };
      };

      const live = cleanBase64(livePhoto);
      const profile = cleanBase64(profilePhoto);

      // Perform facial comparison with Gemini 3.5 Flash (with retries for robust handling of 503/transient errors)
      let response;
      let lastError: any = null;
      const maxRetries = 4;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: [
              {
                inlineData: {
                  data: live.data,
                  mimeType: live.mimeType,
                },
              },
              {
                inlineData: {
                  data: profile.data,
                  mimeType: profile.mimeType,
                },
              },
              "Bandingkan kedua foto wajah di atas. Foto 1 adalah foto live karyawan saat melakukan absen mandiri via smartphone. Foto 2 adalah foto referensi profil karyawan yang telah terdaftar. Verifikasi apakah wajah di Foto 1 adalah orang yang sama dengan yang ada di Foto 2. Mohon analisa landmark wajah utama seperti mata, hidung, mulut, bentuk wajah, kerutan, dan kemiripan biometrik lainnya meskipun ada perbedaan pencahayaan atau ekspresi. Berikan respon akhir Anda dalam format JSON terstruktur.",
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  verified: {
                    type: Type.BOOLEAN,
                    description: "True jika itu adalah orang yang sama, False jika berbeda, tidak mirip atau bukan wajah manusia.",
                  },
                  confidence: {
                    type: Type.NUMBER,
                    description: "Persentase kecocokan atau keyakinan analisis dalam jangkauan 0 s.d. 100.",
                  },
                  reason: {
                    type: Type.STRING,
                    description: "Penjelasan lengkap, objektif, dan informatif mengenai perbandingan ini dalam Bahasa Indonesia.",
                  },
                },
                required: ["verified", "confidence", "reason"],
              },
            },
          });
          // Successful call! Break out of the retry loop.
          break;
        } catch (err: any) {
          lastError = err;
          const status = err.status || (err.error && err.error.status);
          const code = err.code || (err.error && err.error.code);
          const isRateLimitOrBusy = 
            status === "UNAVAILABLE" || 
            code === 503 || 
            code === 429 || 
            (err.message && err.message.toLowerCase().includes("high demand")) ||
            (err.message && err.message.toLowerCase().includes("temporary"));

          if (isRateLimitOrBusy && attempt < maxRetries) {
            const delayMs = attempt * 2000; // 2s, 4s, 6s
            console.warn(`Gemini API busy (503/429/high demand) on attempt ${attempt}/${maxRetries}. Retrying in ${delayMs}ms... Error:`, err.message || err);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            // Unrecoverable error or exceeded maximum retries
            console.error(`Gemini API call failed permanently on attempt ${attempt}. Error:`, err.message || err);
            break;
          }
        }
      }

      if (!response) {
        throw lastError || new Error("Failed to communicate with Gemini API after multiple attempts.");
      }

      const responseText = response.text || "{}";
      const resultObj = JSON.parse(responseText.trim());

      return res.json({ success: true, comparison: resultObj });
    } catch (error: any) {
      console.error("Error during face verification:", error);
      return res.status(500).json({
        error: "Terjadi kesalahan pada verifikasi wajah AI: " + (error.message || error),
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // Serve static assets or use Vite dev server
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite integration...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully running on http://localhost:${PORT}`);
  });
}

startServer();
