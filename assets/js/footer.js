// ============================================================
//  ملف: footer.js (مُحدّث - كامل)
//  الوظيفة: بناء تذييل الموقع (الفوتر) وإدارته
//  يشمل: تبويبات المقالات السريعة، زر العودة للأعلى،
//         بوابة الأدمن المخفية (السنة)
//  يعتمد على: firebase-config.js, utils.js
// ============================================================

let footerActiveTab = 'latest';
let footerClickCount = 0;
let footerClickTimer = null;

// ---------- الدالة الرئيسية ----------
async function buildFooter() {
  const footerDiv = document.getElementById('site-footer');
  if (!footerDiv) { console.warn('⚠️ عنصر site-footer غير موجود'); return; }

  const settings = await getAllSettingsCached();
  const primaryColor = settings.primaryColor || '#c48b4c';
  const footerText = settings.footerText || 'جميع الحقوق محفوظة';
  const footerButtons = settings.footerButtons || '';
  const facebookUrl = settings.facebookUrl || '#';
  const twitterUrl = settings.twitterUrl || '#';
  const instagramUrl = settings.instagramUrl || '#';

  footerDiv.innerHTML = `
    <div class="footer-container">
      <div class="footer-top">
        <div class="footer-tabs">
          <button class="footer-tab ${footerActiveTab === 'latest' ? 'active' : ''}" onclick="switchFooterTab('latest')" style="${footerActiveTab === 'latest' ? 'border-bottom-color: ' + primaryColor : ''}">🆕 أحدث المقالات</button>
          <button class="footer-tab ${footerActiveTab === 'mostViewed' ? 'active' : ''}" onclick="switchFooterTab('mostViewed')" style="${footerActiveTab === 'mostViewed' ? 'border-bottom-color: ' + primaryColor : ''}">🔥 الأكثر مشاهدة</button>
          <button class="footer-tab ${footerActiveTab === 'related' ? 'active' : ''}" onclick="switchFooterTab('related')" style="${footerActiveTab === 'related' ? 'border-bottom-color: ' + primaryColor : ''}">🔗 مقالات ذات صلة</button>
        </div>
        <div class="footer-posts-grid" id="footerPostsGrid"><div class="loading-mini">⏳ جاري التحميل...</div></div>
      </div>

      <div class="footer-middle">
        <div class="footer-custom-buttons" id="footerCustomButtons">${footerButtons || ''}</div>
        <div class="footer-social">
          ${facebookUrl !== '#' ? `<a href="${facebookUrl}" target="_blank" rel="noopener" class="social-link">📘 فيسبوك</a>` : ''}
          ${twitterUrl !== '#' ? `<a href="${twitterUrl}" target="_blank" rel="noopener" class="social-link">🐦 تويتر</a>` : ''}
          ${instagramUrl !== '#' ? `<a href="${instagramUrl}" target="_blank" rel="noopener" class="social-link">📷 انستغرام</a>` : ''}
        </div>
      </div>

      <div class="footer-bottom">
        <button id="backToTopBtn" class="back-to-top" onclick="scrollToTop()" title="العودة إلى الأعلى" style="background: ${primaryColor}">⬆️</button>
        <p class="footer-copyright">© <span id="copyrightYear" class="admin-gate">${new Date().getFullYear()}</span> ${footerText}</p>
      </div>
    </div>
  `;

  attachFooterEvents();
  await loadFooterPosts(footerActiveTab);
  console.log("✅ الفوتر تم بناؤه بنجاح");
}

// ---------- ربط الأحداث ----------
function attachFooterEvents() {
  const yearSpan = document.getElementById('copyrightYear');
  if (yearSpan) yearSpan.addEventListener('click', handleYearClick);
  window.addEventListener('scroll', handleScrollVisibility);
  handleScrollVisibility();
}

// ---------- تبويبات الفوتر ----------
async function switchFooterTab(tab) {
  footerActiveTab = tab;
  document.querySelectorAll('.footer-tab').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.footer-tab[onclick*="${tab}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  await loadFooterPosts(tab);
}

async function loadFooterPosts(type) {
  const grid = document.getElementById('footerPostsGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-mini">⏳ جاري التحميل...</div>';

  try {
    let query = db.collection('posts');
    switch (type) {
      case 'latest': query = query.orderBy('date', 'desc').limit(6); break;
      case 'mostViewed': query = query.orderBy('views', 'desc').limit(6); break;
      case 'related':
        if (window.currentCategoryId) query = query.where('category', '==', currentCategoryId).orderBy('date', 'desc').limit(6);
        else query = query.orderBy('date', 'desc').limit(6);
        break;
    }
    const snapshot = await query.get();
    if (snapshot.empty) { grid.innerHTML = '<p class="no-footer-posts">لا توجد مقالات.</p>'; return; }
    grid.innerHTML = '';
    snapshot.forEach(doc => {
      const post = doc.data(); post.id = doc.id;
      grid.appendChild(createFooterMiniCard(post));
    });
  } catch (error) { console.error('خطأ في تحميل مقالات الفوتر:', error); grid.innerHTML = '<p class="error-text">⚠️ خطأ في التحميل</p>'; }
}

function createFooterMiniCard(post) {
  const card = document.createElement('div'); card.className = 'footer-mini-card';
  const firstImage = getFirstImage(post.content);
  const textPreview = truncateText(getTextOnly(post.content), 80);
  card.innerHTML = `
    ${firstImage ? `<div class="mini-card-image"><img src="${firstImage}" alt="" loading="lazy" onerror="this.style.display='none'"></div>` : ''}
    <div class="mini-card-content">
      <h4 class="mini-card-title"><a href="#" onclick="openPost('${post.id}'); return false;">${post.title}</a></h4>
      <p class="mini-card-meta">${timeAgo(post.date)} · ${post.views || 0} 👁️</p>
      <p class="mini-card-text">${textPreview}</p>
    </div>`;
  card.addEventListener('click', () => openPost(post.id));
  card.style.cursor = 'pointer';
  return card;
}

// ---------- بوابة الأدمن ----------
function handleYearClick() {
  footerClickCount++;
  if (footerClickTimer) clearTimeout(footerClickTimer);
  footerClickTimer = setTimeout(() => { footerClickCount = 0; }, 1500);

  if (footerClickCount === 3) {
    footerClickCount = 0; clearTimeout(footerClickTimer);
    const password = prompt('🔐 أدخل كلمة المرور للوحة التحكم:');
    if (password === '@...C772809978_1998...') {
      localStorage.setItem('adminSession', btoa(Date.now() + '_' + Math.random()));
      window.location.href = 'admin.html';
    } else if (password !== null) { alert('❌ كلمة المرور غير صحيحة'); }
  }
}

function checkAdminSession() { return localStorage.getItem('adminSession') !== null; }
function logoutAdmin() { localStorage.removeItem('adminSession'); window.location.href = 'index.html'; }

// ---------- العودة للأعلى ----------
function handleScrollVisibility() {
  const btn = document.getElementById('backToTopBtn');
  if (!btn) return;
  if (window.scrollY > 500) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
  else { btn.style.opacity = '0'; btn.style.pointerEvents = 'none'; }
}
function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

console.log("✅ footer.js تم تحميله بنجاح");
