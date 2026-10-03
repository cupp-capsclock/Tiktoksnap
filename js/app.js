(() => {
  'use strict';

  /* ============================================================
   * CONFIG
   * ========================================================== */
  // ISI DENGAN URL BACKEND KAMU kalau frontend di-host statis
  // (mis. GitHub Pages, Netlify, dsb) yang TIDAK bisa jalankan server.js.
  // Contoh: 'https://tiktoksnap-backend.onrender.com'
  // Kalau frontend & backend jalan bareng (node server.js di satu domain
  // yang sama, mis. Render/Railway), biarkan string ini kosong ('').
  const BACKEND_URL = '';

  // Deteksi otomatis: kalau situs ini di-host statis (github.io, netlify,
  // dst) tapi BACKEND_URL belum diisi, kasih peringatan jelas di console
  // dan lewat toast, biar nggak bingung liat error JSON parse doang.
  const STATIC_HOST_PATTERNS = /(github\.io|netlify\.app|surge\.sh|pages\.dev)$/i;
  const isLikelyStaticHost = STATIC_HOST_PATTERNS.test(window.location.hostname);

  if (!BACKEND_URL && isLikelyStaticHost) {
    console.warn(
      '[TikTokSnap] BACKEND_URL belum diisi di js/app.js. ' +
      'Situs ini terdeteksi di-host statis (' + window.location.hostname + '), ' +
      'yang tidak bisa menjalankan server.js. Deploy backend-nya (mis. ke Render) ' +
      'lalu isi BACKEND_URL dengan URL backend tersebut.'
    );
  }

  const API_ENDPOINT = `${BACKEND_URL}/api/tiktok`;
  const HISTORY_KEY = 'tiktoksnap_history';
  const HISTORY_LIMIT = 20;
  const TIKTOK_URL_REGEX = /^https?:\/\/(www\.|vt\.|vm\.|m\.)?tiktok\.com\/.+$/i;

  /* ============================================================
   * DOM REFS
   * ========================================================== */
  const $ = (id) => document.getElementById(id);

  const els = {
    themeToggle: $('themeToggle'),
    mobileMenuBtn: $('mobileMenuBtn'),
    mobileMenu: $('mobileMenu'),
    urlInput: $('tiktokUrl'),
    urlHint: $('urlHint'),
    pasteBtn: $('pasteBtn'),
    processBtn: $('processBtn'),
    mp4Btn: $('downloadMp4Btn'),
    mp3Btn: $('downloadMp3Btn'),
    previewIdle: $('previewIdle'),
    previewLoading: $('previewLoading'),
    previewResult: $('previewResult'),
    previewThumb: $('previewThumb'),
    previewTitle: $('previewTitle'),
    previewAuthor: $('previewAuthor'),
    progressBar: $('progressBar'),
    toastContainer: $('toastContainer'),
    historyList: $('historyList'),
    historyEmpty: $('historyEmpty'),
    clearHistoryBtn: $('clearHistoryBtn'),
    year: $('year'),
  };

  let currentResult = null; // holds last successful extraction data
  let progressTimer = null;

  /* ============================================================
   * INIT
   * ========================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    els.year.textContent = new Date().getFullYear();
    initTheme();
    initMobileMenu();
    initFaq();
    renderHistory();
    tryReadClipboard();
    window.addEventListener('focus', tryReadClipboard);
  });

  /* ============================================================
   * THEME (dark / light)
   * ========================================================== */
  function initTheme() {
    const saved = localStorage.getItem('tiktoksnap_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);

    els.themeToggle.addEventListener('click', () => {
      const nowDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('tiktoksnap_theme', nowDark ? 'dark' : 'light');
    });
  }

  /* ============================================================
   * MOBILE MENU
   * ========================================================== */
  function initMobileMenu() {
    els.mobileMenuBtn.addEventListener('click', () => {
      els.mobileMenu.classList.toggle('hidden');
    });
    els.mobileMenu.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => els.mobileMenu.classList.add('hidden'))
    );
  }

  /* ============================================================
   * FAQ ACCORDION
   * ========================================================== */
  function initFaq() {
    document.querySelectorAll('.faq-item').forEach((item) => {
      const question = item.querySelector('.faq-question');
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach((el) => el.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      });
    });
  }

  /* ============================================================
   * CLIPBOARD AUTO-DETECT
   * ========================================================== */
  async function tryReadClipboard() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) return;
      const text = await navigator.clipboard.readText();
      if (text && isValidTikTokUrl(text.trim()) && els.urlInput.value.trim() !== text.trim()) {
        els.urlInput.value = text.trim();
        flashHint('Link TikTok terdeteksi otomatis dari clipboard ✓', 'text-tiktokred');
        showToast('info', 'Link TikTok ditemukan di clipboard dan otomatis ditempel.');
      }
    } catch {
      /* Browser menolak akses clipboard otomatis — abaikan secara diam-diam */
    }
  }

  els.pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return showToast('error', 'Clipboard kosong.');
      els.urlInput.value = text.trim();
      validateInput();
      showToast('success', 'Berhasil menempel dari clipboard.');
    } catch {
      showToast('error', 'Tidak bisa mengakses clipboard. Tempel manual (Ctrl/Cmd+V).');
    }
  });

  /* ============================================================
   * URL VALIDATION
   * ========================================================== */
  function isValidTikTokUrl(url) {
    return TIKTOK_URL_REGEX.test((url || '').trim());
  }

  function validateInput() {
    const val = els.urlInput.value.trim();
    if (!val) {
      flashHint('', '');
      return false;
    }
    if (isValidTikTokUrl(val)) {
      flashHint('Link valid ✓', 'text-emerald-500');
      return true;
    }
    flashHint('Link tidak dikenali sebagai URL TikTok', 'text-tiktokred');
    return false;
  }

  function flashHint(msg, colorClass) {
    els.urlHint.textContent = msg;
    els.urlHint.className = `mt-2 text-xs pl-1 min-h-[16px] ${colorClass}`;
  }

  els.urlInput.addEventListener('input', validateInput);
  els.urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') processLink();
  });

  /* ============================================================
   * PROCESS LINK
   * ========================================================== */
  els.processBtn.addEventListener('click', processLink);

  async function processLink() {
    const url = els.urlInput.value.trim();

    if (!url) {
      showToast('error', 'Masukkan link TikTok terlebih dahulu.');
      return;
    }
    if (!isValidTikTokUrl(url)) {
      showToast('error', 'Link TikTok tidak valid. Contoh: https://vt.tiktok.com/xxxxx');
      return;
    }

    if (!BACKEND_URL && isLikelyStaticHost) {
      showToast(
        'error',
        'Backend belum dikonfigurasi. Deploy server.js (mis. ke Render), lalu isi BACKEND_URL di js/app.js.'
      );
      return;
    }

    setLoadingState(true);
    resetDownloadButtons();

    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          'Backend tidak merespons dengan JSON (kemungkinan endpoint API belum aktif atau salah URL). ' +
          'Cek BACKEND_URL di js/app.js dan pastikan server backend sudah jalan.'
        );
      }

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Gagal memproses link.');
      }

      currentResult = json.data;
      renderPreview(currentResult);
      enableDownloadButtons();
      showToast('success', 'Video berhasil ditemukan! Silakan pilih format unduhan.');
    } catch (err) {
      setLoadingState(false, true);
      showToast('error', err.message || 'Terjadi kesalahan. Coba lagi.');
    }
  }

  function setLoadingState(isLoading, revertToIdle = false) {
    if (isLoading) {
      els.previewIdle.classList.add('hidden');
      els.previewResult.classList.add('hidden');
      els.previewLoading.classList.remove('hidden');
      animateProgress();
    } else {
      clearInterval(progressTimer);
      els.previewLoading.classList.add('hidden');
      if (revertToIdle) {
        els.previewIdle.classList.remove('hidden');
        els.previewResult.classList.add('hidden');
      }
    }
  }

  function animateProgress() {
    let pct = 15;
    els.progressBar.style.width = pct + '%';
    clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      pct = Math.min(pct + Math.random() * 20, 92);
      els.progressBar.style.width = pct + '%';
    }, 250);
  }

  function renderPreview(data) {
    clearInterval(progressTimer);
    els.progressBar.style.width = '100%';
    els.previewLoading.classList.add('hidden');
    els.previewIdle.classList.add('hidden');
    els.previewResult.classList.remove('hidden');

    els.previewThumb.src = data.cover || '';
    els.previewThumb.alt = data.title || 'Preview video TikTok';
    els.previewTitle.textContent = data.title || 'Video TikTok';
    els.previewAuthor.textContent = data.author ? `@${data.author}` : '';
  }

  function resetDownloadButtons() {
    els.mp4Btn.disabled = true;
    els.mp3Btn.disabled = true;
  }

  function enableDownloadButtons() {
    els.mp4Btn.disabled = !currentResult?.videoNoWatermark;
    els.mp3Btn.disabled = !currentResult?.audio;
  }

  /* ============================================================
   * DOWNLOAD ACTIONS
   * ========================================================== */
  els.mp4Btn.addEventListener('click', () => handleDownload('mp4'));
  els.mp3Btn.addEventListener('click', () => handleDownload('mp3'));

  async function handleDownload(type) {
    if (!currentResult) return;
    const fileUrl = type === 'mp4' ? currentResult.videoNoWatermark : currentResult.audio;
    if (!fileUrl) {
      showToast('error', `File ${type.toUpperCase()} tidak tersedia untuk video ini.`);
      return;
    }

    const safeTitle = (currentResult.title || 'tiktoksnap')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40);
    const filename = `${safeTitle || 'tiktoksnap'}-${Date.now()}.${type === 'mp4' ? 'mp4' : 'mp3'}`;

    showToast('info', `Menyiapkan unduhan ${type.toUpperCase()}…`);

    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error('network');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      showToast('success', `${type.toUpperCase()} berhasil diunduh.`);
      addToHistory(type);
    } catch {
      // Fallback: buka di tab baru jika blob-fetch diblokir (mis. CORS)
      window.open(fileUrl, '_blank', 'noopener');
      showToast('info', 'File dibuka di tab baru — klik kanan lalu "Simpan sebagai" untuk mengunduh.');
      addToHistory(type);
    }
  }

  /* ============================================================
   * HISTORY (localStorage)
   * ========================================================== */
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  }

  function addToHistory(type) {
    if (!currentResult) return;
    const history = getHistory();

    history.unshift({
      id: `${Date.now()}`,
      title: currentResult.title || 'Video TikTok',
      author: currentResult.author || '',
      cover: currentResult.cover || '',
      type,
      url: currentResult.originalUrl,
      date: new Date().toISOString(),
    });

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
    renderHistory();
  }

  function renderHistory() {
    const history = getHistory();
    els.historyList.querySelectorAll('.history-card').forEach((el) => el.remove());

    if (history.length === 0) {
      els.historyEmpty.classList.remove('hidden');
      return;
    }
    els.historyEmpty.classList.add('hidden');

    history.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'history-card';
      const dateStr = new Date(item.date).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      });
      card.innerHTML = `
        <img class="history-thumb" src="${item.cover || ''}" alt="" onerror="this.style.opacity=0" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium line-clamp-2">${escapeHtml(item.title)}</p>
          <p class="text-xs text-black/40 dark:text-white/40 mt-1">${item.author ? '@' + escapeHtml(item.author) + ' · ' : ''}${dateStr}</p>
          <span class="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${item.type === 'mp4' ? 'bg-tiktokred/10 text-tiktokred' : 'bg-black/10 dark:bg-white/10'}">
            <i class="fa-solid ${item.type === 'mp4' ? 'fa-video' : 'fa-music'}"></i> ${item.type.toUpperCase()}
          </span>
        </div>
        <button data-id="${item.id}" class="remove-history-btn text-black/25 dark:text-white/25 hover:text-tiktokred transition-colors self-start" title="Hapus">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;
      els.historyList.appendChild(card);
    });

    els.historyList.querySelectorAll('.remove-history-btn').forEach((btn) => {
      btn.addEventListener('click', () => removeHistoryItem(btn.dataset.id));
    });
  }

  function removeHistoryItem(id) {
    const updated = getHistory().filter((h) => h.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    renderHistory();
  }

  els.clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    showToast('info', 'Riwayat download dihapus.');
  });

  function escapeHtml(str = '') {
    return str.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* ============================================================
   * TOAST NOTIFICATIONS
   * ========================================================== */
  function showToast(type, message) {
    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-exclamation',
      info: 'fa-circle-info',
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info} mt-0.5"></i>
      <span class="flex-1">${escapeHtml(message)}</span>
      <button class="toast-close opacity-70 hover:opacity-100"><i class="fa-solid fa-xmark"></i></button>
    `;
    els.toastContainer.appendChild(toast);

    const remove = () => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    };
    toast.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, 4500);
  }
})();
