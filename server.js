require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const TIKTOK_API_BASE = process.env.TIKTOK_API_BASE || 'https://www.tikwm.com/api/';

// ---------- Middleware ----------
app.set('trust proxy', 1); // wajib di Vercel agar rate limit membaca IP asli
app.use(compression());
app.use(cors());
app.use(express.json());

// Sajikan hanya file yang memang dipakai index.html (JANGAN static seluruh folder:
// itu membuka server.js, package.json, dll ke publik).
// Mendukung struktur rapi (css/, js/) maupun upload datar (style.css, app.js di root).
const fs = require('fs');
function sendFirst(res, candidates) {
  for (const f of candidates) {
    const p = path.join(__dirname, f);
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  return res.status(404).send('File tidak ditemukan: ' + candidates.join(' atau '));
}
app.get('/css/style.css', (_req, res) => sendFirst(res, ['css/style.css', 'style.css', 'public/css/style.css']));
app.get('/js/app.js', (_req, res) => sendFirst(res, ['app.js', 'js/app.js', 'public/js/app.js']));

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' },
});
app.use('/api/', limiter);

// ---------- Helpers ----------
const TIKTOK_URL_REGEX =
  /^https?:\/\/(www\.|vt\.|vm\.|m\.)?tiktok\.com\/.+$/i;

function isValidTikTokUrl(url) {
  if (typeof url !== 'string') return false;
  return TIKTOK_URL_REGEX.test(url.trim());
}

/**
 * Resolve URL pendek (vt.tiktok.com / vm.tiktok.com) menjadi URL penuh
 * dengan mengikuti redirect, supaya provider ekstraksi lebih konsisten.
 */
async function resolveShortUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.url || url;
  } catch {
    return url;
  }
}

// ---------- Routes ----------
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'TikTokSnap API aktif' });
});

app.post('/api/tiktok', async (req, res) => {
  try {
    const { url } = req.body || {};

    if (!url || !isValidTikTokUrl(url)) {
      return res.status(400).json({
        success: false,
        message: 'Link TikTok tidak valid. Pastikan link berasal dari tiktok.com.',
      });
    }

    const resolvedUrl = await resolveShortUrl(url.trim());

    const apiUrl = `${TIKTOK_API_BASE}?url=${encodeURIComponent(resolvedUrl)}&hd=1`;
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (TikTokSnap/1.0)' },
    });

    if (!response.ok) {
      throw new Error(`Provider merespons status ${response.status}`);
    }

    const json = await response.json();

    if (!json || json.code !== 0 || !json.data) {
      return res.status(502).json({
        success: false,
        message: 'Gagal mengambil data video. Video mungkin privat atau link salah.',
      });
    }

    const d = json.data;

    return res.json({
      success: true,
      data: {
        id: d.id,
        title: d.title || 'Video TikTok',
        author: d.author?.nickname || d.author?.unique_id || 'Tidak diketahui',
        avatar: d.author?.avatar || null,
        cover: d.cover || d.origin_cover || null,
        duration: d.duration || 0,
        videoNoWatermark: d.play || d.hdplay || null,
        audio: d.music || null,
        originalUrl: url.trim(),
      },
    });
  } catch (err) {
    console.error('[TikTokSnap] Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat memproses link.',
    });
  }
});

// Fallback ke index.html untuk single-page routing sederhana
app.get('*', (_req, res) => sendFirst(res, ['index.html', 'public/index.html']));

// Lokal: jalankan server. Vercel: cukup export app (serverless).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ TikTokSnap server berjalan di http://localhost:${PORT}`);
  });
}
module.exports = app;
