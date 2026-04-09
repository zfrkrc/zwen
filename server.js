const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;
const OLLAMA_BASE = process.env.OLLAMA_BASE || "http://localhost:11434";

const SYSTEM_PROMPT =
  "You are a senior frontend developer. Generate clean, modern, responsive websites using HTML, TailwindCSS, and vanilla JS. Return only code.";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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

// POST /generate — seçili modelle SSE stream
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
  console.log(`📋  Modeller: GET /models\n`);
});
