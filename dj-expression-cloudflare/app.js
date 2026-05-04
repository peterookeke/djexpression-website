/* DJ Expression — App Logic */

const API = "__PORT_8000__".startsWith("__") ? "http://localhost:8000" : "__PORT_8000__";

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let blockedDates = [];
let adminPin = "";
let currentAdminTab = "bookings";

// ===== ONE-PAGE NAVIGATION (smooth scroll to anchors) =====
function scrollToSection(page, ev) {
  if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();

  // Special case: admin shows hidden section
  if (page === 'admin') {
    const admin = document.getElementById('page-admin');
    if (admin) {
      admin.style.display = 'block';
      try { initAdmin(); } catch(e) {}
      admin.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    closeMobileNav();
    return false;
  }

  // Home goes to top of page
  if (page === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveNav('home');
    closeMobileNav();
    try { history.replaceState(null, '', '#home'); } catch(e) {}
    return false;
  }

  // Other sections: scroll to anchor with header offset
  const target = document.getElementById('page-' + page);
  if (target) {
    const header = document.getElementById('header');
    const offset = header ? header.offsetHeight : 80;
    const top = target.getBoundingClientRect().top + window.pageYOffset - offset + 1;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveNav(page);
    try { history.replaceState(null, '', '#' + page); } catch(e) {}

    // Lazy-load page data when scrolled into
    try {
      if (page === 'calendar') loadCalendar();
      if (page === 'media') loadMedia();
      if (page === 'reviews') loadReviews();
      if (page === 'files') loadEventFiles();
      if (page === 'merch') { /* static for now */ }
    } catch(e) { console.error(e); }
  }
  closeMobileNav();
  return false;
}

function setActiveNav(page) {
  document.querySelectorAll('.nav__link').forEach(l => l.classList.remove('nav__link--active'));
  const navLink = document.querySelector(`[data-nav="${page}"]`);
  if (navLink) navLink.classList.add('nav__link--active');
}

function closeMobileNav() {
  const mainNav = document.getElementById('mainNav');
  const navOverlay = document.getElementById('navOverlay');
  if (mainNav) mainNav.classList.remove('nav--open');
  if (navOverlay) navOverlay.classList.remove('nav-overlay--visible');
}

// Backwards-compat shim: any old code calling navigate() routes to scrollToSection
function navigate(page, ev) { return scrollToSection(page, ev); }

function toggleNav() {
  const nav = document.getElementById('mainNav');
  const overlay = document.getElementById('navOverlay');
  if (nav) nav.classList.toggle('nav--open');
  if (overlay) overlay.classList.toggle('nav-overlay--visible');
}

// On page load: handle initial hash, eagerly load all section data
window.addEventListener('DOMContentLoaded', () => {
  // Eagerly load data for all sections since they're all on one page
  try { loadCalendar(); } catch(e) {}
  try { loadMedia(); } catch(e) {}
  try { loadReviews(); } catch(e) {}
  try { loadEventFiles(); } catch(e) {}

  // Smooth-scroll to initial hash if present
  const hash = (location.hash || '').replace('#', '');
  if (hash && hash !== 'home') {
    setTimeout(() => scrollToSection(hash), 200);
  }

  // Update active nav on scroll
  setupScrollSpy();

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { lucide.createIcons(); } catch(e) {}
  }
  initPhotoSlider();
});

// Scroll spy: highlight the nav link for the section currently in view
function setupScrollSpy() {
  // Build dynamically from current DOM order so reorder still highlights correctly
  const allIds = ['home', 'calendar', 'media', 'reviews', 'merch', 'files'];
  const sections = allIds.filter(id => document.getElementById(id === 'home' ? 'page-home' : 'page-' + id));
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollY = window.pageYOffset + 120;
      let current = 'home';
      for (const s of sections) {
        const el = document.getElementById('page-' + s);
        if (el && el.offsetTop <= scrollY) current = s;
      }
      setActiveNav(current);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ===== PHOTO SLIDER =====
function initPhotoSlider() {
  const slider = document.getElementById('photoSlider');
  if (!slider) return;
  const slides = slider.querySelectorAll('.photo-slide');
  const dots = document.querySelectorAll('.photo-slider__dot');
  if (!slides.length) return;
  let idx = 0;
  function show(i) {
    slides.forEach((s, n) => s.classList.toggle('photo-slide--active', n === i));
    dots.forEach((d, n) => d.classList.toggle('photo-slider__dot--active', n === i));
    idx = i;
  }
  show(0);
  // Auto rotate every 5s
  setInterval(() => {
    idx = (idx + 1) % slides.length;
    show(idx);
  }, 5000);
  // Click dots
  dots.forEach((d, n) => d.addEventListener('click', () => show(n)));
}

// ===== TOAST =====
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast toast--${type} toast--visible`;
  setTimeout(() => toast.classList.remove('toast--visible'), 3500);
}

// ===== CALENDAR =====
async function loadCalendar() {
  try {
    const res = await fetch(`${API}/api/calendar`);
    blockedDates = await res.json();
  } catch(e) {
    blockedDates = [];
  }
  renderCalendar();
}

function renderCalendar() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  document.getElementById('calendarTitle').textContent = `${months[currentMonth]} ${currentYear}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  today.setHours(0,0,0,0);

  let html = '';
  days.forEach(d => { html += `<div class="calendar-grid__header">${d}</div>`; });

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day calendar-day--empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dateObj = new Date(currentYear, currentMonth, d);
    const isPast = dateObj < today;
    const isToday = dateObj.getTime() === today.getTime();
    const isBooked = blockedDates.some(b => b.date === dateStr);

    let cls = 'calendar-day';
    if (isPast) cls += ' calendar-day--past';
    else if (isBooked) cls += ' calendar-day--booked';
    else cls += ' calendar-day--available';
    if (isToday) cls += ' calendar-day--today';

    const onclick = (!isPast && !isBooked) ? `onclick="selectDate('${dateStr}')"` : '';

    html += `<div class="${cls}" ${onclick}>
      <span class="calendar-day__number">${d}</span>
    </div>`;
  }

  document.getElementById('calendarGrid').innerHTML = html;
}

function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
}

function selectDate(dateStr) {
  const form = document.getElementById('bookingForm');
  form.style.display = 'block';
  document.getElementById('bookingDate').value = dateStr;
  const d = new Date(dateStr + 'T12:00:00');
  document.getElementById('selectedDateDisplay').textContent = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function handleBooking(e) {
  e.preventDefault();
  const data = {
    client_name: document.getElementById('bookingName').value,
    email: document.getElementById('bookingEmail').value,
    phone: document.getElementById('bookingPhone').value,
    event_type: document.getElementById('bookingEventType').value,
    event_date: document.getElementById('bookingDate').value,
    event_time: document.getElementById('bookingTime').value,
    venue: document.getElementById('bookingVenue').value,
    guest_count: parseInt(document.getElementById('bookingGuests').value) || null,
    message: document.getElementById('bookingMessage').value
  };

  try {
    const res = await fetch(`${API}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (res.ok) {
      showToast('Booking request submitted! I\'ll be in touch soon.', 'success');
      document.getElementById('bookingForm').style.display = 'none';
      e.target.reset();
    } else {
      showToast(result.detail || 'Something went wrong', 'error');
    }
  } catch(err) {
    showToast('Could not connect to server', 'error');
  }
}

// ===== MEDIA =====
let allMedia = [];
async function loadMedia() {
  // Try API; if it succeeds AND returns at least one item, replace the curated set.
  // Otherwise keep the curated YouTube cards baked into index.html.
  try {
    const res = await fetch(`${API}/api/media`);
    if (!res.ok) throw new Error('no media api');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      allMedia = data;
      renderMedia(allMedia);
    }
  } catch(e) {
    // Static curated cards already in DOM — nothing to do
  }
}

function filterMedia(cat) {
  document.querySelectorAll('.media-filter-btn').forEach(b => b.classList.remove('media-filter-btn--active'));
  if (typeof event !== 'undefined' && event.target) event.target.classList.add('media-filter-btn--active');

  // If API loaded items into allMedia, re-render. Otherwise toggle visibility on static cards.
  if (allMedia && allMedia.length) {
    if (cat === 'all') renderMedia(allMedia);
    else renderMedia(allMedia.filter(m => m.category === cat));
    return;
  }
  document.querySelectorAll('#mediaGrid .media-card').forEach(card => {
    const c = card.getAttribute('data-cat') || 'highlight';
    card.style.display = (cat === 'all' || c === cat) ? '' : 'none';
  });
}

function renderMedia(items) {
  const grid = document.getElementById('mediaGrid');
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <div class="empty-state__icon"><i data-lucide="video" style="width:48px;height:48px"></i></div>
      <p>No media in this category yet.</p>
    </div>`;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = items.map(m => `
    <div class="media-card fade-in">
      <div class="media-card__embed">
        <iframe src="${m.url}" title="${m.title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </div>
      <div class="media-card__body">
        <h3 class="media-card__title">${m.title}</h3>
        <p class="media-card__desc">${m.description || ''}</p>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

// ===== REVIEWS =====
async function loadReviews() {
  try {
    const res = await fetch(`${API}/api/reviews`);
    const reviews = await res.json();
    renderReviews(reviews);
  } catch(e) {
    document.getElementById('reviewsGrid').innerHTML = '<div class="empty-state"><p>Could not load reviews.</p></div>';
  }
}

function renderReviews(reviews) {
  const grid = document.getElementById('reviewsGrid');
  if (!reviews.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><p>No reviews yet. Be the first!</p></div>';
    return;
  }

  grid.innerHTML = reviews.map(r => {
    const initials = r.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const stars = Array(5).fill(0).map((_, i) =>
      `<span class="star${i < r.rating ? '' : ' star--empty'}">&#9733;</span>`
    ).join('');

    return `<div class="review-card fade-in">
      <div class="review-card__header">
        <div class="review-card__avatar">${initials}</div>
        <div class="review-card__info">
          <h4>${r.name}</h4>
          <p>${r.event_type || 'Event'} ${r.event_date ? '· ' + new Date(r.event_date + 'T12:00:00').toLocaleDateString('en-US', {month:'short', year:'numeric'}) : ''}</p>
        </div>
      </div>
      <div class="review-card__stars">${stars}</div>
      <p class="review-card__text">"${r.review_text}"</p>
    </div>`;
  }).join('');
}

async function handleReview(e) {
  e.preventDefault();
  const rating = document.querySelector('input[name="rating"]:checked');
  if (!rating) { showToast('Please select a rating', 'error'); return; }

  const data = {
    name: document.getElementById('reviewName').value,
    event_type: document.getElementById('reviewEventType').value,
    rating: parseInt(rating.value),
    review_text: document.getElementById('reviewText').value
  };

  try {
    const res = await fetch(`${API}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (res.ok) {
      showToast('Review submitted! It will appear after approval.', 'success');
      e.target.reset();
    } else {
      showToast('Could not submit review', 'error');
    }
  } catch(err) {
    showToast('Could not connect to server', 'error');
  }
}

// ===== EVENT FILES =====
async function loadEventFiles() {
  try {
    const [eventsRes, filesRes] = await Promise.all([
      fetch(`${API}/api/files/events`),
      fetch(`${API}/api/files`)
    ]);
    const events = await eventsRes.json();
    const files = await filesRes.json();
    renderEventFiles(events, files);
  } catch(e) {
    document.getElementById('eventsFileList').innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon"><i data-lucide="image" style="width:48px;height:48px"></i></div>
        <p>No event files available yet. Check back after your event.</p>
      </div>`;
    lucide.createIcons();
  }
}

function renderEventFiles(events, allFiles) {
  const container = document.getElementById('eventsFileList');
  if (!events.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state__icon"><i data-lucide="image" style="width:48px;height:48px"></i></div>
      <p>No event files available yet. Check back after your event.</p>
    </div>`;
    lucide.createIcons();
    return;
  }

  container.innerHTML = events.map(ev => {
    const eventFiles = allFiles.filter(f => f.event_name === ev.event_name);
    const fileCards = eventFiles.map(f => {
      const icon = f.file_type === 'video' ? 'video' : f.file_type === 'audio' ? 'music' : 'image';
      return `<div class="file-card">
        <div class="file-card__icon"><i data-lucide="${icon}" style="width:36px;height:36px"></i></div>
        <p class="file-card__name">${f.file_name}</p>
        <p class="file-card__price">$${f.price.toFixed(2)}</p>
        <a href="${f.file_url}" target="_blank" rel="noopener noreferrer" class="btn btn--gold btn--sm" style="width:100%;">
          <i data-lucide="download" style="width:14px;height:14px"></i> Download
        </a>
      </div>`;
    }).join('');

    const dateDisplay = ev.event_date ? new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'}) : '';

    return `<div class="event-group fade-in">
      <div class="event-group__header">
        <h3 class="event-group__title">${ev.event_name}</h3>
        <span class="event-group__date">${dateDisplay}</span>
      </div>
      <div class="files-grid">${fileCards}</div>
    </div>`;
  }).join('');

  lucide.createIcons();
}

// ===== SUBSCRIBE =====
async function handleSubscribe(e) {
  e.preventDefault();
  const email = document.getElementById('subscribeEmail').value;

  try {
    const res = await fetch(`${API}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const result = await res.json();
    showToast(result.message, 'success');
    document.getElementById('subscribeEmail').value = '';
  } catch(err) {
    showToast('Could not subscribe. Try again later.', 'error');
  }
}

// ===== ADMIN =====
function initAdmin() {
  if (adminPin) {
    document.getElementById('adminAuth').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAdminTab('bookings');
  }
}

function adminLogin() {
  adminPin = document.getElementById('adminPin').value;
  document.getElementById('adminAuth').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  loadAdminTab('bookings');
  lucide.createIcons();
}

function switchAdminTab(tab) {
  currentAdminTab = tab;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('admin-tab--active'));
  document.querySelector(`[data-admintab="${tab}"]`).classList.add('admin-tab--active');
  document.querySelectorAll('.admin-content').forEach(c => c.style.display = 'none');
  document.getElementById('tab-' + tab).style.display = 'block';
  loadAdminTab(tab);
}

async function loadAdminTab(tab) {
  const headers = { 'X-Admin-Pin': adminPin };

  if (tab === 'bookings') {
    try {
      const res = await fetch(`${API}/api/bookings`, { headers });
      const bookings = await res.json();
      document.getElementById('adminBookingsTable').innerHTML = bookings.length ? `<table>
        <thead><tr><th>Date</th><th>Client</th><th>Event</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${bookings.map(b => `<tr>
          <td>${b.event_date}</td>
          <td>${b.client_name}</td>
          <td>${b.event_type}</td>
          <td>${b.email}</td>
          <td><span class="badge badge--${b.status}">${b.status}</span></td>
          <td>${b.status === 'pending' ? `<button class="btn btn--sm btn--primary" onclick="confirmBooking(${b.id})">Confirm</button>` : ''}</td>
        </tr>`).join('')}</tbody>
      </table>` : '<div class="empty-state"><p>No bookings yet.</p></div>';
    } catch(e) {
      document.getElementById('adminBookingsTable').innerHTML = '<div class="empty-state"><p>Could not load bookings.</p></div>';
    }
  }

  if (tab === 'calendar-mgmt') {
    try {
      const res = await fetch(`${API}/api/calendar`);
      const dates = await res.json();
      document.getElementById('adminCalendarTable').innerHTML = dates.length ? `<table>
        <thead><tr><th>Date</th><th>Reason</th><th>Actions</th></tr></thead>
        <tbody>${dates.map(d => `<tr>
          <td>${d.date}</td>
          <td>${d.reason}</td>
          <td><button class="btn btn--sm btn--ghost" onclick="unblockDate('${d.date}')">Unblock</button></td>
        </tr>`).join('')}</tbody>
      </table>` : '<div class="empty-state"><p>No blocked dates.</p></div>';
    } catch(e) {}
  }

  if (tab === 'reviews-mgmt') {
    try {
      const res = await fetch(`${API}/api/reviews?all=true`);
      const reviews = await res.json();
      document.getElementById('adminReviewsTable').innerHTML = reviews.length ? `<table>
        <thead><tr><th>Name</th><th>Rating</th><th>Review</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${reviews.map(r => `<tr>
          <td>${r.name}</td>
          <td>${'★'.repeat(r.rating)}</td>
          <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.review_text}</td>
          <td><span class="badge badge--${r.approved ? 'approved' : 'unapproved'}">${r.approved ? 'Approved' : 'Pending'}</span></td>
          <td>
            ${!r.approved ? `<button class="btn btn--sm btn--primary" onclick="approveReview(${r.id})">Approve</button>` : ''}
            <button class="btn btn--sm btn--ghost" onclick="deleteReview(${r.id})">Delete</button>
          </td>
        </tr>`).join('')}</tbody>
      </table>` : '<div class="empty-state"><p>No reviews.</p></div>';
    } catch(e) {}
  }

  if (tab === 'media-mgmt') {
    try {
      const res = await fetch(`${API}/api/media`);
      const media = await res.json();
      document.getElementById('adminMediaTable').innerHTML = media.length ? `<table>
        <thead><tr><th>Title</th><th>Category</th><th>Actions</th></tr></thead>
        <tbody>${media.map(m => `<tr>
          <td>${m.title}</td>
          <td>${m.category}</td>
          <td><button class="btn btn--sm btn--ghost" onclick="deleteMedia(${m.id})">Delete</button></td>
        </tr>`).join('')}</tbody>
      </table>` : '<div class="empty-state"><p>No media.</p></div>';
    } catch(e) {}
  }

  if (tab === 'files-mgmt') {
    try {
      const res = await fetch(`${API}/api/files`);
      const files = await res.json();
      document.getElementById('adminFilesTable').innerHTML = files.length ? `<table>
        <thead><tr><th>Event</th><th>File</th><th>Price</th><th>Actions</th></tr></thead>
        <tbody>${files.map(f => `<tr>
          <td>${f.event_name}</td>
          <td>${f.file_name}</td>
          <td>$${f.price.toFixed(2)}</td>
          <td><button class="btn btn--sm btn--ghost" onclick="deleteFile(${f.id})">Delete</button></td>
        </tr>`).join('')}</tbody>
      </table>` : '<div class="empty-state"><p>No files.</p></div>';
    } catch(e) {}
  }

  if (tab === 'subscribers-mgmt') {
    try {
      const res = await fetch(`${API}/api/subscribers`, { headers });
      const subs = await res.json();
      document.getElementById('adminSubscribersTable').innerHTML = subs.length ? `<table>
        <thead><tr><th>Email</th><th>Name</th><th>Subscribed</th></tr></thead>
        <tbody>${subs.map(s => `<tr>
          <td>${s.email}</td>
          <td>${s.name || '—'}</td>
          <td>${new Date(s.subscribed_at).toLocaleDateString()}</td>
        </tr>`).join('')}</tbody>
      </table>` : '<div class="empty-state"><p>No subscribers yet.</p></div>';
    } catch(e) {}
  }

  lucide.createIcons();
}

// Admin actions
async function confirmBooking(id) {
  await fetch(`${API}/api/bookings/${id}`, {
    method: 'PATCH',
    headers: { 'X-Admin-Pin': adminPin }
  });
  showToast('Booking confirmed!', 'success');
  loadAdminTab('bookings');
}

async function blockDate() {
  const date = document.getElementById('blockDate').value;
  const reason = document.getElementById('blockReason').value;
  if (!date) { showToast('Select a date', 'error'); return; }

  try {
    const res = await fetch(`${API}/api/calendar/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': adminPin },
      body: JSON.stringify({ date, reason })
    });
    if (res.ok) {
      showToast('Date blocked', 'success');
      loadAdminTab('calendar-mgmt');
    } else {
      const r = await res.json();
      showToast(r.detail || 'Error', 'error');
    }
  } catch(e) {
    showToast('Error blocking date', 'error');
  }
}

async function unblockDate(dateStr) {
  await fetch(`${API}/api/calendar/unblock/${dateStr}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Pin': adminPin }
  });
  showToast('Date unblocked', 'success');
  loadAdminTab('calendar-mgmt');
}

async function approveReview(id) {
  await fetch(`${API}/api/reviews/${id}/approve`, {
    method: 'PATCH',
    headers: { 'X-Admin-Pin': adminPin }
  });
  showToast('Review approved', 'success');
  loadAdminTab('reviews-mgmt');
}

async function deleteReview(id) {
  await fetch(`${API}/api/reviews/${id}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Pin': adminPin }
  });
  showToast('Review deleted', 'success');
  loadAdminTab('reviews-mgmt');
}

async function addMedia() {
  const data = {
    title: document.getElementById('mediaTitle').value,
    description: document.getElementById('mediaDesc').value,
    media_type: 'video',
    url: document.getElementById('mediaUrl').value,
    category: document.getElementById('mediaCategory').value
  };

  try {
    const res = await fetch(`${API}/api/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': adminPin },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      showToast('Media added', 'success');
      document.getElementById('mediaTitle').value = '';
      document.getElementById('mediaDesc').value = '';
      document.getElementById('mediaUrl').value = '';
      loadAdminTab('media-mgmt');
    }
  } catch(e) {
    showToast('Error adding media', 'error');
  }
}

async function deleteMedia(id) {
  await fetch(`${API}/api/media/${id}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Pin': adminPin }
  });
  showToast('Media deleted', 'success');
  loadAdminTab('media-mgmt');
}

async function addFile() {
  const data = {
    event_name: document.getElementById('fileEventName').value,
    event_date: document.getElementById('fileEventDate').value,
    file_name: document.getElementById('fileName').value,
    file_url: document.getElementById('fileUrl').value,
    file_type: document.getElementById('fileType').value,
    price: parseFloat(document.getElementById('filePrice').value) || 2.99
  };

  try {
    const res = await fetch(`${API}/api/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': adminPin },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      showToast('File added', 'success');
      document.getElementById('fileEventName').value = '';
      document.getElementById('fileName').value = '';
      document.getElementById('fileUrl').value = '';
      loadAdminTab('files-mgmt');
    }
  } catch(e) {
    showToast('Error adding file', 'error');
  }
}

async function deleteFile(id) {
  await fetch(`${API}/api/files/${id}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Pin': adminPin }
  });
  showToast('File deleted', 'success');
  loadAdminTab('files-mgmt');
}

function exportSubscribers() {
  fetch(`${API}/api/subscribers`, { headers: { 'X-Admin-Pin': adminPin } })
    .then(res => res.json())
    .then(subs => {
      const csv = 'Email,Name,Subscribed Date\n' + subs.map(s =>
        `${s.email},${s.name || ''},${s.subscribed_at}`
      ).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'subscribers.csv';
      a.click();
      showToast('Subscribers exported', 'success');
    });
}

// ===== SCROLL REVEAL OBSERVER =====
if ('IntersectionObserver' in window) {
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('revealed'), i * 100);
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.services-grid .service-card').forEach(c => revealObs.observe(c));
}

// ============================================================
//  MERCH CART (lightweight, localStorage-backed, no backend)
// ============================================================
const MERCH_STORAGE_KEY = 'djx_merch_order_v1';
let merchOrder = [];
try { merchOrder = JSON.parse(localStorage.getItem(MERCH_STORAGE_KEY) || '[]') || []; } catch(e) { merchOrder = []; }

function saveMerchOrder() {
  try { localStorage.setItem(MERCH_STORAGE_KEY, JSON.stringify(merchOrder)); } catch(e) {}
}

function addToMerchOrder(name, price) {
  merchOrder.push({ name: name, price: Number(price) || 0, ts: Date.now() });
  saveMerchOrder();
  renderMerchCart();
  showToast('Added "' + name + '" to your order');
}

function clearMerchOrder() {
  merchOrder = [];
  saveMerchOrder();
  renderMerchCart();
}

function renderMerchCart() {
  const cart = document.getElementById('merchCart');
  const list = document.getElementById('merchCartList');
  const totalEl = document.getElementById('merchCartTotal');
  if (!cart || !list || !totalEl) return;
  if (!merchOrder.length) {
    cart.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  cart.style.display = 'block';
  let total = 0;
  list.innerHTML = merchOrder.map((item, i) => {
    total += item.price;
    return '<li><span>' + item.name + '</span> <span>$' + item.price.toFixed(2) + ' <button class="merch-cart__remove" onclick="removeMerchItem(' + i + ')" aria-label="Remove">&times;</button></span></li>';
  }).join('');
  totalEl.textContent = '$' + total.toFixed(2);
}

function removeMerchItem(i) {
  merchOrder.splice(i, 1);
  saveMerchOrder();
  renderMerchCart();
}

function checkoutMerch() {
  if (!merchOrder.length) return;
  const lines = merchOrder.map(it => '- ' + it.name + ' ($' + it.price.toFixed(2) + ')').join('%0D%0A');
  const total = merchOrder.reduce((a, b) => a + b.price, 0).toFixed(2);
  const subject = encodeURIComponent('Merch Order - DJ Expression');
  const body = 'Hi DJ Expression,%0D%0A%0D%0AI would like to order:%0D%0A' + lines + '%0D%0A%0D%0ATotal: $' + total + '%0D%0A%0D%0APlease send sizing options and payment details.';
  window.location.href = 'mailto:info@djexpression.com?subject=' + subject + '&body=' + body;
}

// Render any saved cart on load
window.addEventListener('DOMContentLoaded', renderMerchCart);


// ============================================================
//  EDITOR MODE: inline text edit + section reorder + persistence
// ============================================================
const EDITOR_TEXT_KEY = 'djx_edits_text_v1';
const EDITOR_ORDER_KEY = 'djx_edits_order_v1';
let editorActive = false;

// Apply saved edits as soon as DOM ready (so visitors see published edits)
window.addEventListener('DOMContentLoaded', () => {
  applySavedTextEdits();
  applySavedSectionOrder();
  // If url has #editor, enter edit mode automatically (only useful for the owner)
  if ((location.hash || '').toLowerCase() === '#editor') {
    enterEditorMode();
  }
});

function applySavedTextEdits() {
  let edits = {};
  try { edits = JSON.parse(localStorage.getItem(EDITOR_TEXT_KEY) || '{}') || {}; } catch(e) {}
  document.querySelectorAll('[data-editable]').forEach((el, i) => {
    if (!el.dataset.editKey) el.dataset.editKey = 'e_' + i;
    const key = el.dataset.editKey;
    if (edits[key] !== undefined) el.innerHTML = edits[key];
  });
}

function applySavedSectionOrder() {
  let order = [];
  try { order = JSON.parse(localStorage.getItem(EDITOR_ORDER_KEY) || '[]') || []; } catch(e) {}
  if (!Array.isArray(order) || !order.length) return;
  // Find a stable parent: the body. Reorder our onepage-section nodes by id.
  const sections = Array.from(document.querySelectorAll('section.onepage-section'));
  const byId = Object.fromEntries(sections.map(s => [s.id, s]));
  // Anchor: insert after #page-home (which is a <main>)
  const home = document.getElementById('page-home');
  if (!home || !home.parentNode) return;
  let anchor = home;
  order.forEach(id => {
    const s = byId[id];
    if (s && s.parentNode === home.parentNode && id !== 'page-admin') {
      home.parentNode.insertBefore(s, anchor.nextSibling);
      anchor = s;
    }
  });
}

function enterEditorMode(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  if (editorActive) return;
  editorActive = true;
  document.body.classList.add('editor-mode');
  const bar = document.getElementById('editorBar');
  if (bar) { bar.style.display = 'flex'; bar.setAttribute('aria-hidden', 'false'); }
  // Make all editable elements contenteditable
  document.querySelectorAll('[data-editable]').forEach((el, i) => {
    if (!el.dataset.editKey) el.dataset.editKey = 'e_' + i;
    el.setAttribute('contenteditable', 'plaintext-only');
    el.classList.add('editor-target');
  });
  // Wire up drag-reorder on every section handle
  document.querySelectorAll('section.onepage-section').forEach(sec => {
    if (sec.id === 'page-admin') return;
    sec.setAttribute('draggable', 'true');
    sec.addEventListener('dragstart', onSectionDragStart);
    sec.addEventListener('dragover', onSectionDragOver);
    sec.addEventListener('drop', onSectionDrop);
    sec.addEventListener('dragend', onSectionDragEnd);
  });
  showToast('Editor mode on. Click any text to edit, drag the ☰ handle to reorder.');
}

function exitEditorMode() {
  editorActive = false;
  document.body.classList.remove('editor-mode');
  const bar = document.getElementById('editorBar');
  if (bar) { bar.style.display = 'none'; bar.setAttribute('aria-hidden', 'true'); }
  document.querySelectorAll('[data-editable]').forEach(el => {
    el.removeAttribute('contenteditable');
    el.classList.remove('editor-target');
  });
  document.querySelectorAll('section.onepage-section').forEach(sec => {
    sec.removeAttribute('draggable');
    sec.removeEventListener('dragstart', onSectionDragStart);
    sec.removeEventListener('dragover', onSectionDragOver);
    sec.removeEventListener('drop', onSectionDrop);
    sec.removeEventListener('dragend', onSectionDragEnd);
  });
  if ((location.hash || '').toLowerCase() === '#editor') {
    try { history.replaceState(null, '', location.pathname); } catch(e) {}
  }
}

function saveEditorChanges() {
  // Save text edits
  const edits = {};
  document.querySelectorAll('[data-editable]').forEach((el, i) => {
    if (!el.dataset.editKey) el.dataset.editKey = 'e_' + i;
    edits[el.dataset.editKey] = el.innerHTML;
  });
  try { localStorage.setItem(EDITOR_TEXT_KEY, JSON.stringify(edits)); } catch(e) {}
  // Save current section order
  const order = Array.from(document.querySelectorAll('section.onepage-section'))
                     .filter(s => s.id !== 'page-admin')
                     .map(s => s.id);
  try { localStorage.setItem(EDITOR_ORDER_KEY, JSON.stringify(order)); } catch(e) {}
  showToast('Saved! Your changes will appear on this device.');
}

function resetEditorChanges() {
  if (!confirm('Reset all your edits and section order back to default?')) return;
  try { localStorage.removeItem(EDITOR_TEXT_KEY); localStorage.removeItem(EDITOR_ORDER_KEY); } catch(e) {}
  location.reload();
}

// --- Drag-and-drop reordering for sections ---
let dragSrcSection = null;
function onSectionDragStart(e) {
  // Only allow drag when starting from the handle
  const handle = e.target.closest && e.target.closest('.section-handle');
  if (!handle) {
    e.preventDefault();
    return;
  }
  dragSrcSection = this;
  this.classList.add('section-dragging');
  try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', this.id); } catch(_) {}
}
function onSectionDragOver(e) {
  if (!dragSrcSection || dragSrcSection === this) return;
  e.preventDefault();
  try { e.dataTransfer.dropEffect = 'move'; } catch(_) {}
  this.classList.add('section-drop-target');
}
function onSectionDrop(e) {
  e.preventDefault();
  this.classList.remove('section-drop-target');
  if (!dragSrcSection || dragSrcSection === this) return;
  // Insert source before this on dropping in upper half, after on lower half
  const rect = this.getBoundingClientRect();
  const after = (e.clientY - rect.top) > rect.height / 2;
  if (after) this.parentNode.insertBefore(dragSrcSection, this.nextSibling);
  else this.parentNode.insertBefore(dragSrcSection, this);
}
function onSectionDragEnd() {
  if (dragSrcSection) dragSrcSection.classList.remove('section-dragging');
  document.querySelectorAll('.section-drop-target').forEach(s => s.classList.remove('section-drop-target'));
  dragSrcSection = null;
}
