// ============================================================
// news.js — Trang tin tức môi trường
// FIX: getEnvironmentNews() giờ dùng lang=en + encodeURIComponent
// THÊM: Modal fullscreen khi bấm "Read Full Report"
// ============================================================

import { getEnvironmentNews } from './api.js';

const { SUPABASE_URL, SUPABASE_KEY } = window.EcoLensApiKeys || {};
const newsDb = window.supabase && SUPABASE_URL && SUPABASE_KEY
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ── Hàm tiện ích: escape HTML để tránh XSS ──
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Lưu danh sách bài báo hiện tại để modal dùng ──
let currentArticles = [];
let newsLoaded = false;

async function saveArticlesToSupabase(articles) {
  if (!newsDb || !articles || !articles.length) return;

  const rows = articles
    .filter(a => a && a.url && a.url !== '#')
    .map(a => ({
      title: a.title || 'Untitled',
      description: a.description || null,
      url: a.url,
      image_url: a.urlToImage || null,
      source_name: (a.source && a.source.name) || 'GNews',
      author: a.author || null,
      content: a.content || a.description || null,
      published_at: a.publishedAt || new Date().toISOString()
    }));

  if (!rows.length) return;

  const { error } = await newsDb
    .from('news_articles')
    .insert(rows);

  if (error) {
    // 23505 = duplicate key. Old articles may already be cached, so this is safe to ignore.
    if (error.code !== '23505') {
      console.warn('[News] Could not save articles to Supabase:', error);
    }
  }
}

async function loadCachedArticlesFromSupabase() {
  if (!newsDb) return [];

  const { data, error } = await newsDb
    .from('news_articles')
    .select('title, description, url, image_url, source_name, author, content, published_at')
    .order('published_at', { ascending: false })
    .limit(6);

  if (error) {
    console.warn('[News] Could not load cached articles from Supabase:', error);
    return [];
  }

  return (data || []).map(row => ({
    title: row.title || 'Untitled',
    description: row.description || '',
    url: row.url || '#',
    urlToImage: row.image_url ||
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
    publishedAt: row.published_at || new Date().toISOString(),
    source: { name: row.source_name || 'Saved Article' },
    author: row.author || 'Nature Desk',
    content: row.content || row.description || ''
  }));
}

// ============================================================
// HÀM: normaliseArticle(raw)
// FIX: GNews dùng field "image" (không phải "urlToImage")
// ============================================================
function normaliseArticle(raw) {
  return {
    title      : raw.title       || 'Untitled',
    description: raw.description || '',
    url        : raw.url         || '#',
    urlToImage : raw.image       || // GNews dùng "image"
                 raw.urlToImage  || // fallback nếu schema khác
                 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
    publishedAt: raw.publishedAt || new Date().toISOString(),
    source     : { name: (raw.source && raw.source.name) || 'GNews' },
    author     : raw.author      || 'Nature Desk',
    content    : raw.content     || raw.description || ''
  };
}

// ============================================================
// HÀM: injectModalStyles()
// Chèn CSS cho modal fullscreen một lần duy nhất
// ============================================================
function injectModalStyles() {
  if (document.getElementById('news-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'news-modal-styles';
  style.textContent = `
    /* ── Modal Overlay ── */
    #article-modal {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    #article-modal.open {
      opacity: 1;
      pointer-events: all;
    }

    /* ── Modal Panel ── */
    .modal-panel {
      position: relative;
      width: 100%;
      max-width: 780px;
      max-height: 90vh;
      overflow-y: auto;
      background: #0d1117;
      border: 1px solid rgba(140, 255, 122, 0.18);
      border-radius: 16px;
      box-shadow: 0 0 80px rgba(140, 255, 122, 0.08), 0 32px 64px rgba(0,0,0,0.6);
      transform: translateY(24px) scale(0.97);
      transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
      scrollbar-width: thin;
      scrollbar-color: rgba(140,255,122,0.3) transparent;
    }
    #article-modal.open .modal-panel {
      transform: translateY(0) scale(1);
    }
    .modal-panel::-webkit-scrollbar { width: 4px; }
    .modal-panel::-webkit-scrollbar-thumb { background: rgba(140,255,122,0.3); border-radius: 4px; }

    /* ── Modal Hero Image ── */
    .modal-hero {
      width: 100%;
      height: 260px;
      object-fit: cover;
      border-radius: 16px 16px 0 0;
      display: block;
    }

    /* ── Modal Body ── */
    .modal-body {
      padding: 2rem 2.2rem 2.4rem;
    }

    /* ── Modal Meta ── */
    .modal-meta {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
      margin-bottom: 1.1rem;
    }
    .modal-source {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #8cff7a;
      background: rgba(140,255,122,0.1);
      border: 1px solid rgba(140,255,122,0.25);
      border-radius: 4px;
      padding: 2px 8px;
    }
    .modal-date {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.35);
    }
    .modal-author {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.35);
    }
    .modal-dot {
      width: 3px; height: 3px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
    }

    /* ── Modal Title ── */
    .modal-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: clamp(1.3rem, 3vw, 1.75rem);
      font-weight: 900;
      line-height: 1.25;
      color: #fff;
      margin-bottom: 1rem;
    }

    /* ── Modal Description / Content ── */
    .modal-content {
      font-size: 0.97rem;
      line-height: 1.8;
      color: rgba(255,255,255,0.65);
      margin-bottom: 1.8rem;
    }

    /* ── Modal CTA Button ── */
    .modal-cta {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.7rem 1.4rem;
      background: transparent;
      border: 1.5px solid rgba(140,255,122,0.5);
      border-radius: 8px;
      color: #8cff7a;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s, transform 0.15s;
    }
    .modal-cta:hover {
      background: rgba(140,255,122,0.1);
      border-color: #8cff7a;
      transform: translateY(-1px);
    }
    .modal-cta svg { width: 14px; height: 14px; }

    /* ── Close Button ── */
    .modal-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 36px; height: 36px;
      border-radius: 50%;
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: rgba(255,255,255,0.7);
      transition: background 0.2s, color 0.2s;
      z-index: 10;
    }
    .modal-close:hover {
      background: rgba(255,255,255,0.12);
      color: #fff;
    }
    .modal-close svg { width: 16px; height: 16px; }

    /* ── Divider ── */
    .modal-divider {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.07);
      margin: 1.4rem 0;
    }

    /* ── Disabled CTA when no original URL exists ── */
    .modal-cta.disabled {
      opacity: 0.35;
      cursor: not-allowed;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
// HÀM: buildModal()
// Tạo phần tử modal DOM và gắn sự kiện đóng
// ============================================================
function buildModal() {
  if (document.getElementById('article-modal')) return;
  injectModalStyles();

  const overlay = document.createElement('div');
  overlay.id = 'article-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="modal-panel" id="modal-panel">
      <button class="modal-close" id="modal-close-btn" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <img class="modal-hero" id="modal-hero-img" src="" alt="" referrerpolicy="no-referrer"
           onerror="this.src='https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop'"/>
      <div class="modal-body">
        <div class="modal-meta">
          <span class="modal-source" id="modal-source"></span>
          <span class="modal-dot"></span>
          <span class="modal-date" id="modal-date"></span>
          <span class="modal-dot"></span>
          <span class="modal-author" id="modal-author"></span>
        </div>
        <h2 class="modal-title" id="modal-title"></h2>
        <hr class="modal-divider"/>
        <p class="modal-content" id="modal-content"></p>
        <a class="modal-cta" id="modal-cta" href="#" target="_blank" rel="noopener noreferrer">
          Open Original Article
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Đóng khi click overlay (ngoài panel)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Đóng khi bấm nút X
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);

  // Đóng khi bấm Esc
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// ============================================================
// HÀM: openModal(index)
// Mở modal với dữ liệu bài báo tại vị trí index
// ============================================================
function openModal(index) {
  const article = currentArticles[index];
  if (!article) return;

  buildModal();

  const overlay = document.getElementById('article-modal');
  document.getElementById('modal-hero-img').src  = article.urlToImage;
  document.getElementById('modal-hero-img').alt  = article.title;
  document.getElementById('modal-source').textContent = article.source.name;
  document.getElementById('modal-date').textContent   = new Date(article.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('modal-author').textContent = article.author;
  document.getElementById('modal-title').textContent  = article.title;

  // Hiện nội dung đầy đủ nếu có, fallback về description
  const fullText = article.content || article.description || 'No additional content available.';
  document.getElementById('modal-content').textContent = fullText;

  const cta = document.getElementById('modal-cta');
  if (article.url && article.url !== '#') {
    cta.href = article.url;
    cta.classList.remove('disabled');
  } else {
    cta.href = '#';
    cta.classList.add('disabled');
  }

  // Scroll panel về đầu
  const panel = document.getElementById('modal-panel');
  if (panel) panel.scrollTop = 0;

  // Kích hoạt animation
  requestAnimationFrame(() => {
    overlay.classList.add('open');
  });

  // Khoá scroll body
  document.body.style.overflow = 'hidden';
}

// ============================================================
// HÀM: closeModal()
// ============================================================
function closeModal() {
  const overlay = document.getElementById('article-modal');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// Expose để onclick inline dùng được
window.openArticleModal = openModal;
window.reloadNews = reloadNews;

// ============================================================
// HÀM: loadNews()
// ============================================================
export async function loadNews() {
  const grid = document.getElementById('news-grid');
  if (!grid) return;
  if (newsLoaded) return;
  newsLoaded = true;

  const icon = document.getElementById('refresh-icon');
  const btn  = document.getElementById('refresh-btn');

  // ── Hiện skeleton loading ──
  grid.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="news-skeleton">
      <div class="skel-img"></div>
      <div class="skel-line" style="width:75%"></div>
      <div class="skel-line"></div>
      <div class="skel-line skel-short"></div>
    </div>
  `).join('');

  if (icon) icon.classList.add('spinning');
  if (btn)  btn.disabled = true;

  let articles = [];
  let usingLive = false;

  try {
    const raw = await getEnvironmentNews();

    if (raw && raw.length > 0) {
      articles  = raw.map(normaliseArticle);
      usingLive = true;
    } else {
      console.warn('[News] GNews returned empty, loading cached articles');
      articles = await loadCachedArticlesFromSupabase();
    }
  } catch (err) {
    console.warn('[News] API error, loading cached articles:', err);
    articles = await loadCachedArticlesFromSupabase();
  }

  // Lưu để modal dùng
  currentArticles = articles;
  saveArticlesToSupabase(articles);

  await new Promise(r => setTimeout(r, 600));

  renderNews(articles, usingLive);

  if (icon) icon.classList.remove('spinning');
  if (btn)  btn.disabled = false;
}

// ============================================================
// HÀM: reloadNews()
// ============================================================
export function reloadNews() {
  newsLoaded = false;
  currentArticles = [];
  loadNews();
}

// ============================================================
// HÀM: renderNews(articles, isLive)
// FIX: Nút "Read Full Report" gọi openArticleModal(index)
//      thay vì mở link (tránh broken link từ GNews)
// ============================================================
function renderNews(articles, isLive = false) {
  const grid = document.getElementById('news-grid');
  if (!grid) return;

  if (!articles || articles.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1; padding:6rem; text-align:center;
                  color:rgba(255,255,255,.3); font-style:italic;">
        No recent environmental bulletins found.
      </div>`;
    return;
  }

  const sourceBadgeExtra = isLive
    ? '<span class="news-live-dot" title="Live from GNews"></span>'
    : '';

  grid.innerHTML = articles.map((a, i) => {
    const date   = new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const author = a.author || 'Nature Desk';
    const img    = a.urlToImage ||
                   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop';
    const delay  = i * 0.08;

    return `
      <article class="news-card" style="animation-delay:${delay}s">
        <div class="news-img-wrap">
          <img src="${escHtml(img)}"
               alt="${escHtml(a.title)}"
               class="news-img"
               loading="lazy"
               referrerpolicy="no-referrer"
               onerror="this.src='https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop'"/>
          <span class="news-source-badge">
            ${sourceBadgeExtra}${escHtml(a.source.name)}
          </span>
        </div>
        <div class="news-meta">
          <div class="news-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8"  y1="2" x2="8"  y2="6"/>
              <line x1="3"  y1="10" x2="21" y2="10"/>
            </svg>
            ${escHtml(date)}
          </div>
          <div class="news-meta-dot"></div>
          <div class="news-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:8rem">
              ${escHtml(author)}
            </span>
          </div>
        </div>
        <h3 class="news-title">${escHtml(a.title)}</h3>
        <p class="news-desc">${escHtml(a.description)}</p>
        <button class="news-link" onclick="window.openArticleModal(${i})">
          Read Full Report
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </button>
      </article>
    `;
  }).join('');

  // Đảm bảo modal DOM đã sẵn sàng
  buildModal();
}

// ── Tự động tải khi DOM sẵn sàng ──
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('news-grid')) {
    loadNews();
  }
});
