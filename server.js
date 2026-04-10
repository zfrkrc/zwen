const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");
const multer = require("multer");
const AdmZip = require("adm-zip");

const app = express();
const PORT = process.env.PORT || 4000;
const OLLAMA_BASE = process.env.OLLAMA_BASE || "http://localhost:11434";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

const SYSTEM_PROMPT =
  "You are an expert frontend developer. Your ONLY job is to output raw, complete HTML code containing TailwindCSS and vanilla JS. \n" +
  "CRITICAL RULES:\n" +
  "1. DO NOT print markdown block ticks like ```html. Output the raw text only.\n" +
  "2. DO NOT write explanations, apologies, or say you cannot do something.\n" +
  "3. If images are required, YOU MUST use image placeholders automatically (e.g., https://picsum.photos/seed/picsum/800/600 or https://placehold.co/600x400). NEVER tell the user to find images.\n" +
  "4. Use modern, beautiful, and dynamic aesthetics (glassmorphism, gradients). Return a single complete HTML file.";

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ── Yardımcı: Ham HTML → okunabilir metin ────────────────────────────────────
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")   // script bloklarını sil
    .replace(/<style[\s\S]*?<\/style>/gi, "")      // style bloklarını sil
    .replace(/<!--[\s\S]*?-->/g, "")               // yorumları sil
    .replace(/<[^>]+>/g, " ")                      // kalan tag'leri boşluğa çevir
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")                       // çoklu boşlukları birleştir
    .trim()
    .slice(0, 8000);                               // model context sınırı
}

// GET /models — Ollama'daki kurulu modelleri listele
app.get("/models", async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
    const data = await r.json();
    const models = (data.models || []).map((m) => m.name);
    res.json({ models });
  } catch (err) {
    console.error("Model listesi alınamadı:", err.message);
    res.status(502).json({ error: "Ollama'ya bağlanılamadı.", models: [] });
  }
});


// POST /fetch-url — Verilen URL'yi sunucu tarafında fetch eder, temizlenmiş metni döndürür
app.post("/fetch-url", async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL gerekli." });
  }

  try {
    const pageRes = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ZwenBot/1.0; +https://github.com/zfrkrc/zwen)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "tr,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000), // 10 sn timeout
    });

    if (!pageRes.ok) {
      return res.status(502).json({ error: `Sayfa alınamadı: HTTP ${pageRes.status}` });
    }

    const contentType = pageRes.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      return res.status(415).json({ error: "Sadece HTML sayfalar destekleniyor." });
    }

    const html = await pageRes.text();

    // Başlık ve meta açıklamasını ayrı çıkar
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch  = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
    const title      = titleMatch ? titleMatch[1].trim() : "";
    const desc       = descMatch  ? descMatch[1].trim()  : "";

    const text = htmlToText(html);

    console.log(`🌐 Fetch: ${url} (${text.length} karakter)`);
    res.json({ url, title, description: desc, content: text });
  } catch (err) {
    console.error("URL fetch hatası:", err.message);
    res.status(502).json({ error: `URL okunamadı: ${err.message}` });
  }
});

// POST /generate — seçili modelle SSE stream
// POST /upload-zip — ZIP dosyasını alır, içindeki html/css/js leri birleştirir (repomix benzeri)
app.post("/upload-zip", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Dosya yüklenmedi." });

  try {
    const zip = new AdmZip(req.file.buffer);
    const zipEntries = zip.getEntries();

    let totalText = "";
    let fileCount = 0;
    const allowedExtensions = [".html", ".css", ".js", ".json", ".txt"];

    zipEntries.forEach((zipEntry) => {
      if (!zipEntry.isDirectory) {
        const ext = path.extname(zipEntry.entryName).toLowerCase();
        if (allowedExtensions.includes(ext) && zipEntry.entryName.indexOf("__MACOSX") === -1) {
          try {
            const content = zipEntry.getData().toString("utf8");
            totalText += `\n\n--- DOSYA: ${zipEntry.entryName} ---\n`;
            totalText += content;
            fileCount++;
          } catch (e) {
            // Ignore badly encoded files
          }
        }
      }
    });

    if (fileCount === 0) {
      return res.status(400).json({ error: "Zip içinde geçerli kod dosyası (html, css, js) bulunamadı." });
    }

    console.log(`📦 Zip Okundu: ${req.file.originalname} (${fileCount} dosya)`);
    
    // Very large zips might exceed context limits
    const maxLength = 100000;
    if (totalText.length > maxLength) {
      totalText = totalText.slice(0, maxLength) + "\n\n... (DİKKAT: DOSYA İÇERİĞİ ÇOK UZUN OLDUĞU İÇİN BURADAN SONRASI KESİLDİ) ...";
    }

    res.json({ fileName: req.file.originalname, fileCount, content: totalText });

  } catch (err) {
    console.error("Zip okuma hatası:", err.message);
    res.status(500).json({ error: "Zip açılırken bir hata oluştu." });
  }
});

app.post("/generate", async (req, res) => {
  const { prompt, model } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ error: "Prompt gerekli." });
  }

  const selectedModel = model && model.trim() ? model.trim() : "qwen2.5-coder:7b";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selectedModel,
        system: SYSTEM_PROMPT,
        prompt: prompt.trim(),
        stream: true,
      }),
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      res.write(`data: ${JSON.stringify({ error: `Ollama hatası: ${errText}` })}\n\n`);
      res.end();
      return;
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            res.write(`data: ${JSON.stringify({ token: parsed.response })}\n\n`);
          }
          if (parsed.done) {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          }
        } catch {
          // Partial JSON satırı, atla
        }
      }
    }

    res.end();
  } catch (err) {
    console.error("Ollama bağlantı hatası:", err.message);
    res.write(
      `data: ${JSON.stringify({ error: "Ollama'ya bağlanılamadı. Çalışıyor mu? (ollama serve)" })}\n\n`
    );
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀  Zwen çalışıyor → http://localhost:${PORT}`);
  console.log(`🔗  Ollama: ${OLLAMA_BASE}`);
  console.log(`📋  Modeller: GET /models`);
  console.log(`🌐  URL Okuyucu: POST /fetch-url\n`);
});
