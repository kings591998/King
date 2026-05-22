// ============================================================
//  ملف: footer.js (مُحدّث - بطاقات تُفتح كروابط)
//  الوظيفة: بناء تذييل الموقع (الفوتر) وإدارته
// ============================================================

let footerActiveTab = 'latest';
let footerClickCount = 0;
let footerClickTimer = null;
let footerScrollPositions = {};
let footerLastVisible = {};

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

        <div class="footer-horizontal-scroll" id="footerHorizontalScroll">
          <div class="horizontal-scroll-wrapper" id="horizontalScrollWrapper"></div>
        </div>
      </div>

      <div class="footer-middle">
        <div class="footer-custom-buttons" id="footerCustomButtons">${footerButtons || ''}</div>
        <div class="footer-static-pages" id="footerStaticPages"></div>
        <div class="footer-social">
          ${facebookUrl !== '#' ? `<a href="${facebookUrl}" target="_blank" rel="noopener" class="social-link">📘 فيسبوك</a>` : ''}
          ${twitterUrl !== '#' ? `<a href="${twitterUrl}" target="_blank" rel="noopener" class="social-link">🐦 تويتر</a>` : ''}
          ${instagramUrl !== '#' ? `<a href="${instagramUrl}" target="_blank" rel="noopener" class="social-link">📷 انستغرام</a>` : ''}
        </div>
      </div>

      <div class="footer-bottom">
        <button id="scrollDownBtn" class="scroll-btn scroll-down-btn" onclick="scrollToBottom()" title="النزول للأسفل" style="background: ${primaryColor}">⬇️</button>
        <button id="backToTopBtn" class="scroll-btn back-to-top-btn" onclick="scrollToTop()" title="العودة للأعلى" style="background: ${primaryColor}">⬆️</button>
        <p class="footer-copyright">© <span id="copyrightYear" class="admin-gate">${new Date().getFullYear()}</span> ${footerText}</p>
      </div>
    </div>
  `;

  attachFooterEvents();
  await loadFooterPosts(footerActiveTab);
  await loadStaticPagesInFooter();
  startYearAutoUpdate();
  console.log("✅ الفوتر تم بناؤه بنجاح");
}

function attachFooterEvents() {
  const yearSpan = document.getElementById('copyrightYear');
  if (yearSpan) yearSpan.addEventListener('click', handleYearClick);
  window.addEventListener('scroll', handleScrollVisibility);
  handleScrollVisibility();
}

async function switchFooterTab(tab) {
  const container = document.getElementById('footerHorizontalScroll');
  if (container) {
    footerScrollPositions[footerActiveTab] = container.scrollLeft;
  }
  footerActiveTab = tab;
  document.querySelectorAll('.footer-tab').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.footer-tab[onclick*="${tab}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  await loadFooterPosts(tab);
}

async function loadFooterPosts(type) {
  const wrapper = document.getElementById('horizontalScrollWrapper');
  if (!wrapper) return;
  const container = document.getElementById('footerHorizontalScroll');

  wrapper.innerHTML = '<div class="loading-mini">⏳ جاري التحميل...</div>';
  footerLastVisible[type] = null;

  try {
    let query = db.collection('posts');
    switch (type) {
      case 'latest': query = query.orderBy('date', 'desc').limit(20); break;
      case 'mostViewed': query = query.orderBy('views', 'desc').limit(20); break;
      case 'related':
        if (window.currentCategoryId) query = query.where('category', '==', window.currentCategoryId).orderBy('date', 'desc').limit(20);
        else query = query.orderBy('date', 'desc').limit(20);
        break;
    }
    const snapshot = await query.get();
    if (snapshot.empty) {
      wrapper.innerHTML = '<p class="no-footer-posts">لا توجد مقالات.</p>';
      return;
    }

    wrapper.innerHTML = '';
    snapshot.forEach(doc => {
      const post = doc.data(); post.id = doc.id;
      wrapper.appendChild(createFooterHorizontalCard(post));
    });

    footerLastVisible[type] = snapshot.docs[snapshot.docs.length - 1];

    if (container && footerScrollPositions[type]) {
      container.scrollLeft = footerScrollPositions[type];
    }

    if (container) {
      container.onscroll = async function() {
        const scrollLeft = container.scrollLeft;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        if (scrollLeft + clientWidth >= scrollWidth - 50) {
          await loadMoreFooterPosts(type, wrapper);
        }
      };
    }
  } catch (error) {
    console.error('خطأ في تحميل مقالات الفوتر:', error);
    wrapper.innerHTML = '<p class="error-text">⚠️ خطأ في التحميل</p>';
  }
}

async function loadMoreFooterPosts(type, wrapper) {
  if (footerLastVisible[type] === null) return;
  try {
    let query = db.collection('posts');
    switch (type) {
      case 'latest': query = query.orderBy('date', 'desc'); break;
      case 'mostViewed': query = query.orderBy('views', 'desc'); break;
      case 'related':
        if (window.currentCategoryId) query = query.where('category', '==', window.currentCategoryId).orderBy('date', 'desc');
        else query = query.orderBy('date', 'desc');
        break;
    }
    query = query.limit(10).startAfter(footerLastVisible[type]);
    const snapshot = await query.get();
    if (snapshot.empty) {
      footerLastVisible[type] = null;
      return;
    }
    footerLastVisible[type] = snapshot.docs[snapshot.docs.length - 1];
    snapshot.forEach(doc => {
      const post = doc.data(); post.id = doc.id;
      wrapper.appendChild(createFooterHorizontalCard(post));
    });
  } catch (e) { console.error(e); }
}

function createFooterHorizontalCard(post) {
  const card = document.createElement('div');
  card.className = 'footer-horizontal-card';
  const firstImage = getFirstImage(post.content);
  const url = `${window.location.origin}${window.location.pathname}?post=${post.id}`;

  card.innerHTML = `
    <a href="${url}" target="_blank" onclick="event.preventDefault(); window.open('${url}', '_blank');">
      ${firstImage ? `<img src="${firstImage}" class="footer-card-image" loading="lazy" onerror="this.style.display='none'">` : ''}
      <div class="footer-card-content">
        <h4 class="footer-card-title">${post.title}</h4>
        <p class="footer-card-meta">${timeAgo(post.date)} · ${post.views || 0} 👁️</p>
      </div>
    </a>
  `;
  return card;
}

async function loadStaticPagesInFooter() {
  const container = document.getElementById('footerStaticPages');
  if (!container) return;
  try {
    const snapshot = await db.collection('static_pages')
      .where('visible', '==', true)
      .orderBy('createdAt', 'desc')
      .get();
    if (snapshot.empty) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = '<h4>صفحات</h4><div class="static-pages-links"></div>';
    const linksContainer = container.querySelector('.static-pages-links');
    snapshot.docs.forEach(doc => {
      const page = doc.data();
      if (page.link) {
        const link = document.createElement('a');
        link.href = page.link;
        link.target = '_blank';
        link.rel = 'noopener';
        link.className = 'static-page-link';
        link.textContent = page.name;
        linksContainer.appendChild(link);
      } else {
        const span = document.createElement('span');
        span.className = 'static-page-link';
        span.textContent = page.name;
        span.onclick = () => showStaticPagePopup(page.name, page.content);
        linksContainer.appendChild(span);
      }
    });
  } catch (e) {
    console.error('خطأ في تحميل الصفحات الثابتة:', e);
  }
}

function showStaticPagePopup(title, content) {
  const existing = document.querySelector('.static-page-popup-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'static-page-popup-overlay';
  overlay.innerHTML = `
    <div class="static-page-popup">
      <div class="static-page-popup-header">
        <h3>${title}</h3>
        <button class="static-page-popup-close" onclick="this.closest('.static-page-popup-overlay').remove()">✕</button>
      </div>
      <div class="static-page-popup-content">${content}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
}

function handleYearClick() {
  footerClickCount++;
  if (footerClickTimer) clearTimeout(footerClickTimer);
  footerClickTimer = setTimeout(() => { footerClickCount = 0; }, 1500);
  if (footerClickCount === 3) {
    footerClickCount = 0; clearTimeout(footerClickTimer);
    const password = prompt('🔐 أدخل كلمة المرور للوحة التحكم:');
    if (password === '@...C772809978_1998...@') {
      localStorage.setItem('adminSession', btoa(Date.now() + '_' + Math.random()));
      window.location.href = 'admin.html';
    } else if (password !== null) { showToast('❌ كلمة المرور غير صحيحة', 'error'); }
  }
}

function handleScrollVisibility() {
  const downBtn = document.getElementById('scrollDownBtn');
  const upBtn = document.getElementById('backToTopBtn');
  if (!downBtn || !upBtn) return;
  const scrollY = window.scrollY;
  const pageHeight = document.body.scrollHeight - window.innerHeight;
  if (scrollY < 200) { downBtn.classList.add('show'); upBtn.classList.remove('show'); }
  else if (scrollY > pageHeight - 200) { downBtn.classList.remove('show'); upBtn.classList.add('show'); }
  else { downBtn.classList.remove('show'); upBtn.classList.add('show'); }
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
function scrollToBottom() { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }
function startYearAutoUpdate() {
  const yearSpan = document.getElementById('copyrightYear');
  if (!yearSpan) return;
  setInterval(() => {
    const currentYear = new Date().getFullYear();
    if (yearSpan.textContent != currentYear) yearSpan.textContent = currentYear;
  }, 60000);
}

console.log("✅ footer.js تم تحميله بنجاح");
