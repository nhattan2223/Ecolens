/* ============================================================
   reviews.js — EcoLens Feedback Page
   Supabase integration with realtime updates
   ============================================================ */

// ── Supabase config ──────────────────────────────────────────
// Use the shared auth client so RLS session is respected
function getDb() {
  return (window.EcoLensAuth && window.EcoLensAuth.getDb()) || null;
}

// ── State ────────────────────────────────────────────────────
let allReviews = [];   // cache of reviews from DB

// ── Helpers ─────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildStars(rating) {
  return Array.from({ length: 5 }).map((_, idx) =>
    `<svg class="${idx < rating ? 'star-filled' : 'star-empty'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>`
  ).join('');
}

function buildCardHTML(r, delay = 0) {
  return `
    <div class="review-card" data-id="${r.id}" style="animation-delay:${delay}s">
      <div class="review-quote-deco">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
          <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
        </svg>
      </div>
      <div class="review-stars">${buildStars(r.rating)}</div>
      <p class="review-text">"${escHtml(r.message)}"</p>
      <div class="review-author">
        <div class="review-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div>
          <div class="review-name">${escHtml(r.full_name || 'Anonymous')}</div>
          <div class="review-role">${escHtml(r.org_role || '')}</div>
        </div>
      </div>
    </div>
  `;
}

const ctaCard = `
  <div class="review-cta-card">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <div class="text-micro">Join the 500+ missions powered by EcoLens</div>
  </div>
`;

// ── Render ───────────────────────────────────────────────────
function renderReviews(reviews) {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;

  if (reviews.length === 0) {
    grid.innerHTML = `
      <div style="padding:4rem 3rem; opacity:.4; font-size:.875rem; color:rgba(255,255,255,.5); grid-column:1/-1; text-align:center;">
        No reviews yet. Be the first to share your feedback!
      </div>
    ` + ctaCard;
    return;
  }

  const cards = reviews.map((r, i) => buildCardHTML(r, i * 0.08)).join('');
  grid.innerHTML = cards + ctaCard;
}

// Add a single new card at the top (called on realtime INSERT or after submit)
function prependReviewCard(review) {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;

  // Remove existing card with same id if any
  const existing = grid.querySelector(`[data-id="${review.id}"]`);
  if (existing) existing.remove();

  // Remove any empty-state placeholder (e.g. "No reviews yet")
  const placeholder = grid.querySelector('div[style*="grid-column:1/-1"]');
  if (placeholder) placeholder.remove();

  // Remove cta, prepend new card, re-append cta
  const cta = grid.querySelector('.review-cta-card');
  if (cta) cta.remove();

  const div = document.createElement('div');
  div.innerHTML = buildCardHTML(review, 0);
  const card = div.firstElementChild;

  grid.insertBefore(card, grid.firstChild);
  grid.appendChild(cta || (() => { const d = document.createElement('div'); d.innerHTML = ctaCard; return d.firstElementChild; })());
}

// ── Load from Supabase ───────────────────────────────────────
async function loadReviews() {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;

  // Loading skeleton
  grid.innerHTML = `
    <div style="padding:3rem; opacity:.4; font-size:.875rem; animation:shimmer 1.5s ease-in-out infinite; grid-column:1/-1;">
      Loading reviews…
    </div>
  `;

  const db = getDb();
  if (!db) { grid.innerHTML = `<div style="padding:3rem;opacity:.4;grid-column:1/-1;">Database not configured.</div>`; return; }

  const { data, error } = await db
    .from('insights')
    .select('*')
    .eq('is_visible', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase load error:', error);
    grid.innerHTML = `<div style="padding:3rem;opacity:.4;grid-column:1/-1;">Failed to load reviews.</div>`;
    return;
  }

  allReviews = data || [];
  renderReviews(allReviews);
}

// ── Realtime subscription ────────────────────────────────────
function subscribeRealtime() {
  const db = getDb();
  if (!db) return;
  db
    .channel('insights-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'insights' },
      (payload) => {
        const newReview = payload.new;
        if (!newReview.is_visible) return;
        // Avoid duplicates from subscription when user just submitted
        if (allReviews.some(r => r.id === newReview.id)) return;
        allReviews.unshift(newReview);
        prependReviewCard(newReview);
      }
    )
    .subscribe((status) => {
      console.log('Realtime subscription status:', status);
    });
}

// ── Form validation & submit ─────────────────────────────────
function showFieldError(input, msg) {
  input.style.borderColor = '#f87171';
  let err = input.parentElement.querySelector('.field-error');
  if (!err) {
    err = document.createElement('span');
    err.className = 'field-error';
    err.style.cssText = 'font-size:10px;color:#f87171;text-transform:uppercase;letter-spacing:.1em;margin-top:.25rem;display:block;';
    input.parentElement.appendChild(err);
  }
  err.textContent = msg;
}

function clearFieldError(input) {
  input.style.borderColor = '';
  const err = input.parentElement.querySelector('.field-error');
  if (err) err.remove();
}

function validateForm() {
  const nameInput     = document.querySelector('.feedback-form-inner input[placeholder="e.g. John Doe"]');
  const messageInput  = document.querySelector('.form-textarea');
  const ratingValue   = Number(document.getElementById('feedback-rating-value')?.value || 0);
  let valid = true;

  // Clear previous errors
  [nameInput, messageInput].forEach(clearFieldError);

  // Rating: must be 1–5
  if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
    const ratingWrap = document.getElementById('feedback-rating');
    if (ratingWrap) {
      ratingWrap.style.outline = '1px solid #f87171';
      ratingWrap.style.borderRadius = '4px';
      let err = ratingWrap.parentElement.querySelector('.field-error');
      if (!err) {
        err = document.createElement('span');
        err.className = 'field-error';
        err.style.cssText = 'font-size:10px;color:#f87171;text-transform:uppercase;letter-spacing:.1em;margin-top:.25rem;display:block;';
        ratingWrap.parentElement.appendChild(err);
      }
      err.textContent = 'Please select a rating (1–5)';
    }
    valid = false;
  } else {
    const ratingWrap = document.getElementById('feedback-rating');
    if (ratingWrap) {
      ratingWrap.style.outline = '';
      const err = ratingWrap.parentElement.querySelector('.field-error');
      if (err) err.remove();
    }
  }

  // Message: required
  if (!messageInput || !messageInput.value.trim()) {
    showFieldError(messageInput, 'Message is required');
    valid = false;
  }

  return valid;
}

async function submitFeedback() {
  if (!validateForm()) return;
  console.log('[Feedback] submitFeedback called');

  // Auth check
  const user = window.EcoLensAuth && window.EcoLensAuth.getUser();
  if (!user) {
    if (window.openAuthModal) window.openAuthModal();
    return;
  }

  const nameInput    = document.querySelector('.feedback-form-inner input[placeholder="e.g. John Doe"]');
  const orgInput     = document.querySelector('.feedback-form-inner input[placeholder="e.g. Climate Research Institute"]');
  const messageInput = document.querySelector('.form-textarea');
  const ratingValue  = Number(document.getElementById('feedback-rating-value').value);
  const submitBtn    = document.querySelector('.form-submit');

  const payload = {
    user_id:   user.id,
    full_name: nameInput.value.trim() || 'Anonymous',
    org_role:  orgInput.value.trim() || null,
    rating:    ratingValue,
    message:   messageInput.value.trim(),
    is_visible: true,
  };
  console.log('[Feedback] payload:', payload);

  // Loading state
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';

  const db = getDb();
  if (!db) { alert('Database not configured.'); submitBtn.disabled = false; submitBtn.textContent = 'Send Review'; return; }
  const { data, error } = await db.from('insights').insert([payload]).select();
  console.log('[Feedback] insert result:', { data, error });

  if (error) {
    console.error('Supabase insert error:', error);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Review';
    alert('Something went wrong. Please try again.');
    return;
  }

  // Success — show the new review immediately
  // Use the returned row, or construct a local object as fallback
  const newReview = data?.[0] || {
    ...payload,
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 9),
    created_at: new Date().toISOString(),
  };
  console.log('[Feedback] newReview:', newReview);
  console.log('[Feedback] grid element:', document.getElementById('reviews-grid'));
  allReviews.unshift(newReview);
  prependReviewCard(newReview);

  // Reset form
  nameInput.value    = '';
  orgInput.value     = '';
  messageInput.value = '';
  document.getElementById('feedback-rating-value').value = '0';
  resetStars();

  submitBtn.disabled    = false;
  submitBtn.textContent = 'Sent ✓';
  setTimeout(() => { submitBtn.textContent = 'Send Review'; }, 2500);

  // Close the form
  setTimeout(() => toggleFeedbackForm(), 1200);
}

// ── Star rating UI ───────────────────────────────────────────
function resetStars() {
  const stars = document.querySelectorAll('#feedback-rating .rating-star svg');
  stars.forEach(svg => {
    svg.classList.remove('star-filled');
    svg.classList.add('star-empty');
  });
}

function initializeFeedbackRating() {
  const ratingWrap = document.getElementById('feedback-rating');
  const ratingInput = document.getElementById('feedback-rating-value');
  if (!ratingWrap || !ratingInput) return;

  const stars = Array.from(ratingWrap.querySelectorAll('.rating-star'));

  const setRating = (value) => {
    ratingInput.value = value;
    stars.forEach((star, index) => {
      const svg = star.querySelector('svg');
      if (!svg) return;
      svg.classList.toggle('star-filled', index < value);
      svg.classList.toggle('star-empty',  index >= value);
    });
    // Clear rating error if any
    ratingWrap.style.outline = '';
    const err = ratingWrap.parentElement.querySelector('.field-error');
    if (err) err.remove();
  };

  stars.forEach((star) => {
    star.addEventListener('click', () => {
      const value = Number(star.dataset.value) || 0;
      setRating(value);
    });
    // Hover preview
    star.addEventListener('mouseenter', () => {
      const value = Number(star.dataset.value) || 0;
      stars.forEach((s, i) => {
        const svg = s.querySelector('svg');
        if (!svg) return;
        svg.classList.toggle('star-filled', i < value);
        svg.classList.toggle('star-empty',  i >= value);
      });
    });
    star.addEventListener('mouseleave', () => {
      const current = Number(ratingInput.value) || 0;
      stars.forEach((s, i) => {
        const svg = s.querySelector('svg');
        if (!svg) return;
        svg.classList.toggle('star-filled', i < current);
        svg.classList.toggle('star-empty',  i >= current);
      });
    });
  });
}

// ── Toggle form ──────────────────────────────────────────────
function toggleFeedbackForm() {
  const user = window.EcoLensAuth && window.EcoLensAuth.getUser();
  if (!user) {
    if (window.openAuthModal) window.openAuthModal();
    return;
  }
  const form = document.getElementById('feedback-form');
  if (!form) return;
  if (form.style.display === 'none' || form.style.display === '') {
    form.style.display = 'block';
    form.style.animation = 'fadeUp .35s cubic-bezier(0.16, 1, 0.3, 1) both';
  } else {
    form.style.display = 'none';
  }
}

// ── Patch submit button ──────────────────────────────────────
function patchSubmitButton() {
  const btn = document.querySelector('.form-submit');
  if (btn) {
    btn.addEventListener('click', submitFeedback);
  }
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('reviews-grid')) {
    loadReviews();
    subscribeRealtime();
  }
  initializeFeedbackRating();
  patchSubmitButton();
});
