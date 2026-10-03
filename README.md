# TikTokSnap

Website downloader TikTok modern — download video tanpa watermark (MP4) dan ekstraksi audio (MP3), dengan UI clean, responsif, dan mode gelap/terang.

## 🗂️ Struktur Proyek

```
tiktoksnap/
├── server.js              # Backend Express + endpoint ekstraksi TikTok
├── package.json
├── .env.example            # Contoh konfigurasi environment
└── public/
    ├── index.html           # Landing page (Tailwind CDN)
    ├── css/style.css        # Glassmorphism, kartu, toast, animasi
    └── js/app.js            # Validasi URL, clipboard, fetch API, history, toast
```

## 🚀 Menjalankan secara lokal

```bash
npm install
cp .env.example .env
npm start
```

Buka `http://localhost:3000`.

## ⚙️ Cara kerja backend

`POST /api/tiktok` menerima `{ url }`, memvalidasi format URL TikTok, lalu meneruskan permintaan ke provider ekstraksi pihak ketiga (default: **tikwm.com**, API publik non-resmi yang umum dipakai untuk keperluan seperti ini) untuk mendapatkan:

- `videoNoWatermark` — URL MP4 tanpa watermark
- `audio` — URL MP3 hasil ekstraksi
- `cover`, `title`, `author`, `duration` — untuk preview

> ⚠️ **Penting:** `tikwm.com` adalah layanan pihak ketiga yang tidak resmi dan bisa berubah sewaktu-waktu (rate limit, format respons, ketersediaan). Untuk produksi skala besar, disarankan:
> 1. Mengganti `TIKTOK_API_BASE` di `.env` dengan provider berbayar/resmi yang lebih stabil, atau
> 2. Membangun layer ekstraksi sendiri, atau
> 3. Menambahkan caching + fallback ke beberapa provider.

## 🎨 Kustomisasi desain

- Warna: edit `tailwind.config` di `index.html` (`tiktokred`, `tiktokcyan`, `ink`, `surface`).
- Font: Poppins (display) + Inter (body), dimuat via Google Fonts.
- Untuk produksi, sebaiknya build Tailwind via CLI (bukan CDN) agar CSS di-*purge* dan lebih ringan:
  ```bash
  npm install -D tailwindcss
  npx tailwindcss init
  # arahkan content ke ./public/**/*.html dan build ke public/css/tailwind.css
  ```

## 🔒 Keamanan & etika

- Rate limiting sudah aktif di endpoint `/api/*` (default 30 req/menit/IP, atur via `.env`).
- Disclaimer hak cipta ditampilkan di footer — pastikan pengguna hanya mengunduh konten yang mereka miliki haknya atau dengan izin.
- Aplikasi ini tidak berafiliasi dengan TikTok Inc.

## 📦 Deploy

Kompatibel dengan Render, Railway, Fly.io, VPS (PM2), atau platform Node.js apa pun. Pastikan environment variable dari `.env.example` disalin ke pengaturan hosting.

```bash
pm2 start server.js --name tiktoksnap
```
