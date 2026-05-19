// ============================================================
//  ملف: footer.js
//  الوظيفة: بناء تذييل الموقع (الفوتر) وإدارته
//  يشمل: تبويبات المقالات السريعة، زر العودة للأعلى، بوابة الأدمن المخفية
//  يعتمد على: firebase-config.js, utils.js
// ============================================================

// ---------- متغيرات عامة للفوتر ----------
let footerActiveTab = 'latest';   // التبويب النشط حالياً في الفوتر
let footerClickCount = 0;         // عداد النقرات على السنة (للدخول للأدمن)
let footerClickTimer = null;      // مؤقت إعادة تعيين النقرات

// ---------- الدالة الرئيسية: بناء الفوتر ----------

/**
 * بناء الفوتر بالكامل وجلب الإعدادات من Firestore
 * تستدعى مرة واحدة عند تحميل الصفحة
 */
async function buildFooter() {
    const footerDiv = document.getElementById('site-footer');
    if (!footerDiv) {
        console.warn('⚠️ عنصر site-footer غير موجود في الصفحة');
        return;
    }
    
    // جلب الإعدادات من Firestore
    const footerButtons = await getSetting('footerButtons', '');
    const footerText = await getSetting('footerText', 'جميع الحقوق محفوظة');
    const primaryColor = await getSetting('primaryColor', '#c48b4c');
    const facebookUrl = await getSetting('facebookUrl', '#');
    const twitterUrl = await getSetting('twitterUrl', '#');
    const instagramUrl = await getSetting('instagramUrl', '#');
    
    // بناء HTML الفوتر
    footerDiv.innerHTML = `
        <div class="footer-container">
            <!-- القسم العلوي: تبويبات المقالات -->
            <div class="footer-top">
                <div class="footer-tabs">
                    <button class="footer-tab ${footerActiveTab === 'latest' ? 'active' : ''}" 
                            onclick="switchFooterTab('latest')" 
                            style="${footerActiveTab === 'latest' ? 'border-bottom-color: ' + primaryColor : ''}">
                        🆕 أحدث المقالات
                    </button>
                    <button class="footer-tab ${footerActiveTab === 'mostViewed' ? 'active' : ''}" 
                            onclick="switchFooterTab('mostViewed')" 
                            style="${footerActiveTab === 'mostViewed' ? 'border-bottom-color: ' + primaryColor : ''}">
                        🔥 الأكثر مشاهدة
                    </button>
                    <button class="footer-tab ${footerActiveTab === 'related' ? 'active' : ''}" 
                            onclick="switchFooterTab('related')" 
                            style="${footerActiveTab === 'related' ? 'border-bottom-color: ' + primaryColor : ''}">
                        🔗 مقالات ذات صلة
                    </button>
                </div>
                
                <!-- شبكة المقالات المصغرة -->
                <div class="footer-posts-grid" id="footerPostsGrid">
                    <div class="loading-mini">⏳ جاري التحميل...</div>
                </div>
            </div>
            
            <!-- القسم الأوسط: روابط وأزرار مخصصة -->
            <div class="footer-middle">
                <div class="footer-custom-buttons" id="footerCustomButtons">
                    ${footerButtons || ''}
                </div>
                
                <div class="footer-social">
                    ${facebookUrl !== '#' ? `<a href="${facebookUrl}" target="_blank" class="social-link">📘 فيسبوك</a>` : ''}
                    ${twitterUrl !== '#' ? `<a href="${twitterUrl}" target="_blank" class="social-link">🐦 تويتر</a>` : ''}
                    ${instagramUrl !== '#' ? `<a href="${instagramUrl}" target="_blank" class="social-link">📷 انستغرام</a>` : ''}
                </div>
            </div>
            
            <!-- القسم السفلي: حقوق النشر والسنة (بوابة الأدمن) -->
            <div class="footer-bottom">
                <button id="backToTopBtn" 
                        class="back-to-top" 
                        onclick="scrollToTop()" 
                        title="العودة إلى الأعلى"
                        style="background: ${primaryColor}">
                    ⬆️
                </button>
                
                <p class="footer-copyright">
                    © <span id="copyrightYear" class="admin-gate">${new Date().getFullYear()}</span> 
                    ${footerText}
                </p>
            </div>
        </div>
    `;
    
    // ربط الأحداث بعد بناء الفوتر
    attachFooterEvents();
    
    // تحميل التبويب الافتراضي (الأحدث)
    await loadFooterPosts('latest');
    
    console.log("✅ الفوتر تم بناؤه بنجاح");
}

// ---------- ربط الأحداث ----------

/**
 * ربط جميع أحداث الفوتر
 */
function attachFooterEvents() {
    // حدث النقر على السنة (بوابة الأدمن المخفية)
    const yearSpan = document.getElementById('copyrightYear');
    if (yearSpan) {
        yearSpan.addEventListener('click', handleYearClick);
    }
    
    // زر العودة للأعلى - يظهر/يختفي حسب التمرير
    window.addEventListener('scroll', handleScrollVisibility);
    handleScrollVisibility(); // فحص أولي
}

// ---------- دوال التبويبات في الفوتر ----------

/**
 * تبديل التبويب النشط في الفوتر
 * @param {string} tab - اسم التبويب ('latest', 'mostViewed', 'related')
 */
async function switchFooterTab(tab) {
    footerActiveTab = tab;
    
    // تحديث شكل التبويبات
    document.querySelectorAll('.footer-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.footer-tab[onclick*="${tab}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // تحميل المقالات المناسبة
    await loadFooterPosts(tab);
}

/**
 * جلب وعرض المقالات في الفوتر حسب التبويب المختار
 * @param {string} type - نوع المقالات ('latest', 'mostViewed', 'related')
 */
async function loadFooterPosts(type) {
    const grid = document.getElementById('footerPostsGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="loading-mini">⏳ جاري التحميل...</div>';
    
    try {
        let query = db.collection('posts');
        
        switch (type) {
            case 'latest':
                // أحدث المقالات
                query = query.orderBy('date', 'desc').limit(6);
                break;
                
            case 'mostViewed':
                // الأكثر مشاهدة
                query = query.orderBy('views', 'desc').limit(6);
                break;
                
            case 'related':
                // مقالات ذات صلة بالتبويبة الحالية
                if (window.currentCategoryId) {
                    query = query.where('category', '==', currentCategoryId)
                                 .orderBy('date', 'desc')
                                 .limit(6);
                } else {
                    // إذا لم تكن هناك تبويبة محددة، نعرض الأحدث
                    query = query.orderBy('date', 'desc').limit(6);
                }
                break;
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            grid.innerHTML = '<p class="no-footer-posts">لا توجد مقالات.</p>';
            return;
        }
        
        grid.innerHTML = '';
        snapshot.forEach(doc => {
            const post = doc.data();
            post.id = doc.id;
            const miniCard = createFooterMiniCard(post);
            grid.appendChild(miniCard);
        });
        
    } catch (error) {
        console.error('خطأ في تحميل مقالات الفوتر:', error);
        grid.innerHTML = '<p class="error-text">⚠️ خطأ في التحميل</p>';
    }
}

/**
 * إنشاء بطاقة مصغرة للمقال في الفوتر
 * @param {Object} post - بيانات المقال
 * @returns {HTMLElement} عنصر البطاقة المصغرة
 */
function createFooterMiniCard(post) {
    const card = document.createElement('div');
    card.className = 'footer-mini-card';
    
    const firstImage = getFirstImage(post.content);
    const textPreview = truncateText(getTextOnly(post.content), 80);
    
    card.innerHTML = `
        ${firstImage ? `<div class="mini-card-image"><img src="${firstImage}" alt="" loading="lazy" onerror="this.style.display='none'"></div>` : ''}
        <div class="mini-card-content">
            <h4 class="mini-card-title">
                <a href="#" onclick="openPost('${post.id}'); return false;">${post.title}</a>
            </h4>
            <p class="mini-card-meta">${timeAgo(post.date)} · ${post.views || 0} 👁️</p>
            <p class="mini-card-text">${textPreview}</p>
        </div>
    `;
    
    card.addEventListener('click', () => openPost(post.id));
    card.style.cursor = 'pointer';
    
    return card;
}

// ---------- بوابة الأدمن المخفية ----------

/**
 * معالجة النقر على السنة (للدخول للوحة التحكم)
 * يتطلب 3 نقرات متتالية خلال 1.5 ثانية
 */
function handleYearClick() {
    footerClickCount++;
    
    // إعادة تعيين العداد بعد 1.5 ثانية من آخر نقرة
    if (footerClickTimer) clearTimeout(footerClickTimer);
    footerClickTimer = setTimeout(() => {
        footerClickCount = 0;
    }, 1500);
    
    // عند الوصول إلى 3 نقرات
    if (footerClickCount === 3) {
        footerClickCount = 0;
        clearTimeout(footerClickTimer);
        
        // طلب كلمة المرور
        const password = prompt('🔐 أدخل كلمة المرور للوحة التحكم:');
        
        // التحقق من كلمة المرور (يمكن تغييرها لاحقاً من لوحة التحكم)
        const ADMIN_PASSWORD = '@...C772809978_1998...@';
        
        if (password === ADMIN_PASSWORD) {
            // إنشاء جلسة مؤقتة في localStorage
            const sessionToken = btoa(Date.now() + '_' + Math.random());
            localStorage.setItem('adminSession', sessionToken);
            
            // الانتقال إلى لوحة التحكم
            window.location.href = 'admin.html';
        } else if (password !== null) {
            alert('❌ كلمة المرور غير صحيحة');
        }
    }
}

/**
 * التحقق من صلاحية الجلسة (تستخدم في admin.html)
 * @returns {boolean} هل الجلسة صالحة؟
 */
function checkAdminSession() {
    return localStorage.getItem('adminSession') !== null;
}

/**
 * إنهاء جلسة الأدمن
 */
function logoutAdmin() {
    localStorage.removeItem('adminSession');
    window.location.href = 'index.html';
}

// ---------- زر العودة للأعلى ----------

/**
 * معالجة ظهور/إخفاء زر العودة للأعلى حسب موضع التمرير
 */
function handleScrollVisibility() {
    const btn = document.getElementById('backToTopBtn');
    if (!btn) return;
    
    if (window.scrollY > 500) {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
    } else {
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
    }
}

/**
 * التمرير إلى أعلى الصفحة بسلاسة
 */
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// ---------- الصفحات الثابتة ----------

/**
 * إنشاء روابط الصفحات الثابتة في الفوتر
 * (يمكن استدعاؤها لتحديث الروابط عند تغيير الإعدادات)
 */
async function updateStaticPages() {
    const pages = await getSetting('staticPages', []);
    const container = document.getElementById('staticPagesContainer');
    if (!container) return;
    
    container.innerHTML = pages.map(page => 
        `<a href="/pages/${page.slug}.html" class="static-page-link">📄 ${page.title}</a>`
    ).join('');
}

// ---------- تأكيد التحميل ----------
console.log("✅ ملف footer.js تم تحميله بنجاح");
