/* app.js — EcoLens shared vanilla JS */

const PAGE_URL_MAP = {
  home: 'index.html',
  about: 'about_us.html',
  explore: 'explore_earth.html',
  news: 'news.html',
  reviews: 'feedback.html'
};

function navigateTo(page) {
  const url = PAGE_URL_MAP[page];
  if (url) {
    window.location.href = url;
  }
}

function highlightActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  const currentPage = Object.entries(PAGE_URL_MAP).find(([page, url]) => url === path)?.[0] || 'home';
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === currentPage);
  });
}

function toggleMenu() {
  const menu = document.getElementById('mobile-menu');
  if (!menu) return;
  menu.classList.toggle('open');
  document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
}

document.addEventListener('DOMContentLoaded', () => {
  highlightActiveNav();
});
