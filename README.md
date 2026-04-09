<div align="center">

# ⚡ Zwen — Yerel AI Web Developer

**Tamamen yerel, veri sızdırmayan, GPU destekli AI web sitesi üreticisi.**  
Ollama + qwen2.5-coder:7b · Node.js/Express · Glassmorphism UI

[![License: MIT](https://img.shields.io/badge/license-MIT-violet.svg)](#)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](#)
[![Ollama](https://img.shields.io/badge/ollama-qwen2.5--coder:7b-blue.svg)](#)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED.svg)](#)

</div>

---

## 📖 Proje Geçmişi

Zwen, "yerel ve özel kalsın" prensibiyle doğdu.  
Bulut tabanlı AI araçlarının aksine Zwen; kodunu, fikirlerini ve promptlarını **hiçbir sunucuya göndermez**.  
Her şey kendi makinende çalışır — internet bağlantısına bile gerek yok.

### Sürüm Geçmişi

| Sürüm | Tarih | Ne Eklendi |
|---|---|---|
| **v0.1** | 10 Nis 2025 | İlk prototip — Express sunucu + Ollama proxy |
| **v0.2** | 10 Nis 2025 | SSE streaming ile gerçek zamanlı token akışı |
| **v0.3** | 10 Nis 2025 | Glassmorphism dark UI, canlı önizleme (iframe), kopyala/indir |
| **v0.4** | 10 Nis 2025 | Docker Compose desteği — Ollama + Open WebUI servisleri |
| **v0.5** | 10 Nis 2025 | Intel iGPU desteği (`/dev/dri` passthrough, NVIDIA bağımlılığı kaldırıldı) |

---

## 📁 Klasör Yapısı

```
zwen/
├── server.js            ← Express backend  (POST /generate → Ollama SSE proxy)
├── package.json         ← Bağımlılıklar & start scripti
├── docker-compose.yml   ← Ollama + Open WebUI (Intel GPU destekli)
├── README.md
└── public/
    └── index.html       ← Glassmorphism dark UI (TailwindCSS CDN)
```

---

## ✨ Özellikler

| Özellik | Detay |
|---|---|
| 🔴 **Gerçek zamanlı streaming** | Kod token token, anlık olarak akar |
| 👁 **Canlı Önizleme** | Üretilen HTML'i iframe'de anında gör |
| 📋 **Kopyala / İndir** | Tek tıkla `index.html` olarak kaydet |
| ⚡ **Hızlı Promptlar** | 5 hazır şablon butonu (Landing, Dashboard, Portfolio…) |
| ⌨️ **Kısayol** | `Ctrl + Enter` ile anında üret |
| 🔒 **Tamamen Yerel** | Hiçbir veri dışarı çıkmaz, internet gerekmez |
| 🐳 **Docker Desteği** | Tek komutla Ollama + Open WebUI başlatma |
| 🖥️ **Intel GPU Desteği** | `/dev/dri` passthrough, CPU fallback ile |

---

## 🚀 Kurulum — Yöntem 1: Node.js (Doğrudan)

### Gereksinimler

**Node.js ≥ 18**
```bash
# Arch / EndeavourOS / Manjaro
sudo pacman -S nodejs npm
```

**Ollama**
```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
ollama pull qwen2.5-coder:7b   # ≈4 GB, bir kez indirilir
```

### Çalıştırma

```bash
cd zwen
npm install
node server.js
```

Tarayıcıda aç → **http://localhost:3000**

---

## 🐳 Kurulum — Yöntem 2: Docker Compose (Önerilen)

Ollama + Open WebUI'yi birlikte tek komutla başlatır.

### Gereksinimler

```bash
# Docker kur
sudo pacman -S docker docker-buildx docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

### Başlatma

```bash
cd zwen

# Servisleri başlat (arka planda)
docker compose up -d

# Modeli indir (ilk seferde)
docker exec ollama ollama pull qwen2.5-coder:7b

# Logları izle
docker compose logs -f
```

| Servis | Adres | Açıklama |
|---|---|---|
| Ollama API | http://localhost:11434 | LLM backend, Intel iGPU destekli |
| Open WebUI | http://localhost:3000 | ChatGPT benzeri sohbet arayüzü |

### Durdurma

```bash
docker compose down          # durdur (veriler korunur)
docker compose down -v       # durdur + volume'ları sil
```

---

## 🖥️ GPU Notları

| GPU | Durum | Yöntem |
|---|---|---|
| Intel iGPU (Iris, UHD) | ✅ Destekleniyor | `/dev/dri` passthrough |
| NVIDIA | ✅ Destekleniyor | `docker-compose.yml`'de `deploy.resources` bloğunu aç |
| AMD | ✅ Destekleniyor | `/dev/dri` + `group_add: [render, video]` yeterli |
| GPU yok | ✅ Çalışır | CPU moduna otomatik fallback |

> GPU yoksa veya `/dev/dri` mevcut değilse `docker-compose.yml`'deki `devices` ve `group_add` satırlarını silin — CPU modunda çalışır.

---

## 🔌 API Referansı

```
POST /generate
Content-Type: application/json

{ "prompt": "Landing page oluştur..." }
```

**SSE (Server-Sent Events) yanıtı:**
```
data: {"token": "<!"}
data: {"token": "DOCTYPE"}
data: {"token": " html>"}
...
data: {"done": true}
```

**Hata:**
```
data: {"error": "Ollama'ya bağlanılamadı. Çalışıyor mu? (ollama serve)"}
```

---

## 🤖 Sistem Prompt

```
You are a senior frontend developer. Generate clean, modern, responsive
websites using HTML, TailwindCSS, and vanilla JS. Return only code.
```

Model: `qwen2.5-coder:7b` · Endpoint: `http://localhost:11434/api/generate`

---

## 🛣️ Yol Haritası

- [ ] Model seçici (UI üzerinden farklı Ollama modelleri)
- [ ] Prompt geçmişi (localStorage)
- [ ] Çoklu dosya üretimi (HTML + CSS + JS ayrı)
- [ ] Önizleme ekranı tam sayfa modu
- [ ] Üretilen kodun üzerine yorum/istek ile revizyon

---

<div align="center">

**Zwen** — Tamamen yerel · Verileriniz hiçbir yere gitmiyor · MIT Lisansı

</div>
