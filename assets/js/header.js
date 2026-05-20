// ============================================================
//  ملف: header.js (مُدمَج - كامل ومُحدّث)
//  الوظيفة: بناء الهيدر وإدارة التبويبات والبحث والوضع الليلي
//  يشمل: خلفية الهيدر، أيقونات، اختفاء تلقائي، هامبرغر
//  يعتمد على: firebase-config.js, utils.js
// ============================================================

let currentCategoryId = null;
let currentSubcategoryId = null;
let categoriesData = [];
let headerTimer = null;
let tabsVisible = true;

// ---------- الدالة الرئيسية ----------
async function buildHeader() {
    const settings = await getAllSettingsCached();
    const siteName = settings.siteName || 'ALSHANFRICC';
    const primaryColor = settings.primaryColor || '#c48b4c';
    const titleFont = settings.titleFont || 'Playfair Display';
    const bodyFont = settings.bodyFont || 'Cairo';
    const darkMode = settings.darkMode || false;
    const headerBgImage = settings.headerBgImage || '';

    const catsSnapshot = await db.collection('categories').orderBy('order').get();
    categoriesData = [];
    catsSnapshot.forEach(doc => categoriesData.push({ id: doc.id, ...doc.data() }));

    const headerDiv = document.getElementById('site-header');

    // تطبيق الخلفية
    if (headerBgImage) {
        headerDiv.style.backgroundImage = `url('${headerBgImage}')`;
        headerDiv.style.backgroundSize = 'cover';
        headerDiv.style.backgroundPosition = 'center';
        headerDiv.classList.add('has-bg-image');
    } else {
        headerDiv.style.backgroundImage = '';
        headerDiv.classList.remove('has-bg-image');
    }

    headerDiv.innerHTML = `
        <div class="header-top">
            <div class="logo" style="color:${primaryColor}; font-family:'${titleFont}', serif;" onclick="goHome()">${siteName}</div>
            <div class="header-icons">
                <span class="icon-btn" id="searchToggle" title="بحث">🔍</span>
                <span class="icon-btn" id="notificationBell" title="الإشعارات">🔔</span>
                <span class="icon-btn" id="darkModeBtn" title="الوضع الليلي">${darkMode ? '☀️' : '🌙'}</span>
            </div>
        </div>
        <div class="search-bar" id="searchBar" style="display:none;">
            <input type="text" id="searchInput" placeholder="ابحث...">
            <span id="searchClose" style="cursor:pointer;">✕</span>
        </div>
        <div class="nav-container" id="navContainer">
            <div class="nav-tabs-wrapper" id="navTabsWrapper">
                <div class="nav-tabs" id="mainTabs">
                    <div class="tab-item ${!currentCategoryId ? 'active' : ''}" onclick="handleTabClick(event, null)">🏠 الرئيسية</div>
                    ${categoriesData.map(cat => `
                        <div class="tab-item" data-id="${cat.id}" onclick="handleTabClick(event, '${cat.id}')">
                            ${cat.icon || '📌'} ${cat.name} ${cat.subcategories && cat.subcategories.length ? '▾' : ''}
                        </div>
                    `).join('')}
                </div>
                <span class="hamburger-btn" id="hamburgerBtn" title="إظهار التبويبات" style="display:none;">☰</span>
            </div>
            <div class="subcategory-bar" id="subcategoryBar" style="display:none;"></div>
        </div>
    `;

    attachHeaderEvents();
    if (darkMode) document.body.classList.add('dark-mode');
    resetTabsTimer();
    window.addEventListener('scroll', onWindowScroll);
    window.addEventListener('mousemove', resetTabsTimer);
    window.addEventListener('touchstart', resetTabsTimer, {passive: true});
}

// ---------- ربط الأحداث ----------
function attachHeaderEvents() {
    document.getElementById('searchToggle').addEventListener('click', () => {
        const bar = document.getElementById('searchBar');
        bar.style.display = 'flex';
        document.getElementById('searchInput').focus();
    });
    document.getElementById('searchClose').addEventListener('click', () => {
        document.getElementById('searchBar').style.display = 'none';
        document.getElementById('searchInput').value = '';
        if (typeof searchPosts === 'function') searchPosts('');
    });
    document.getElementById('searchInput').addEventListener('input', debounce(function() {
        if (typeof searchPosts === 'function') searchPosts(this.value);
    }, 400));

    document.getElementById('notificationBell').addEventListener('click', () => {
        alert('🔔 لا توجد إشعارات جديدة حالياً.');
    });

    document.getElementById('darkModeBtn').addEventListener('click', toggleDarkMode);

    document.getElementById('hamburgerBtn').addEventListener('click', () => {
        tabsVisible = !tabsVisible;
        updateTabsVisibility();
    });

    document.addEventListener('click', (e) => {
        const bar = document.getElementById('searchBar');
        const toggle = document.getElementById('searchToggle');
        if (!bar.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
            bar.style.display = 'none';
        }
    });
}

// ---------- التبويبات (الاختفاء التلقائي) ----------
function resetTabsTimer() {
    clearTimeout(headerTimer);
    if (!tabsVisible) {
        tabsVisible = true;
        updateTabsVisibility();
    }
    headerTimer = setTimeout(() => {
        hideSubcategories();
        setTimeout(() => {
            if (tabsVisible) {
                tabsVisible = false;
                updateTabsVisibility();
            }
        }, 500);
    }, 5000);
}

function onWindowScroll() {
    resetTabsTimer();
}

function updateTabsVisibility() {
    const wrapper = document.getElementById('navTabsWrapper');
    wrapper.classList.toggle('tabs-hidden', !tabsVisible);
    document.getElementById('hamburgerBtn').style.display = tabsVisible ? 'none' : 'inline-block';
    if (!tabsVisible) {
        document.getElementById('subcategoryBar').style.display = 'none';
    }
}

// ---------- التعامل مع التبويبات والفروع ----------
function handleTabClick(event, catId) {
    document.querySelectorAll('.tab-item').forEach(tab => tab.classList.remove('active'));
    if (event.target.classList.contains('tab-item')) {
        event.target.classList.add('active');
    } else {
        event.target.closest('.tab-item')?.classList.add('active');
    }

    currentCategoryId = catId;
    currentSubcategoryId = null;
    const category = categoriesData.find(c => c.id === catId);

    if (category && category.subcategories && category.subcategories.length > 0) {
        showSubcategories(category.subcategories);
    } else {
        hideSubcategories();
    }

    if (typeof loadPosts === 'function') loadPosts(false);
    scrollToPosts();
}

function showSubcategories(subcategories) {
    const bar = document.getElementById('subcategoryBar');
    let html = '<div class="subcategory-list">';
    html += `<span class="sub-item ${!currentSubcategoryId ? 'active' : ''}" onclick="selectSubcategory(null)">الكل</span>`;
    subcategories.forEach((sub, index) => {
        const subId = sub.id || `sub-${index}`;
        html += `<span class="sub-item ${currentSubcategoryId === subId ? 'active' : ''}" onclick="selectSubcategory('${subId}')">${sub.name || sub}</span>`;
    });
    html += '</div>';
    bar.innerHTML = html;
    bar.style.display = 'block';
}

function hideSubcategories() {
    document.getElementById('subcategoryBar').style.display = 'none';
}

function selectSubcategory(subId) {
    currentSubcategoryId = subId;
    document.querySelectorAll('.sub-item').forEach(item => item.classList.remove('active'));
    if (subId === null) {
        document.querySelector('.sub-item[onclick*="null"]')?.classList.add('active');
    } else {
        document.querySelector(`.sub-item[onclick*="${subId}"]`)?.classList.add('active');
    }
    if (typeof loadPosts === 'function') loadPosts(false);
    scrollToPosts();
}

// ---------- البحث والتنقل ----------
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchBar').style.display = 'none';
    if (typeof searchPosts === 'function') searchPosts('');
}

function goHome() {
    currentCategoryId = null;
    currentSubcategoryId = null;
    hideSubcategories();
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab-item[onclick*="null"]')?.classList.add('active');
    if (typeof loadPosts === 'function') loadPosts(false);
    scrollToPosts();
}

function scrollToPosts() {
    const feed = document.getElementById('posts-feed');
    if (feed) feed.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- الوضع الليلي ----------
async function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    document.getElementById('darkModeBtn').textContent = isDark ? '☀️' : '🌙';
    await updateSetting('darkMode', isDark);
}

console.log("✅ header.js تم تحميله بنجاح");
