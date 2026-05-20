// ============================================================
//  ملف: admin.js (كامل ومدمج)
//  الوظيفة: إدارة لوحة التحكم وعمليات CRUD على جميع المجموعات
//  يشمل: الهيدر، البدي، الفوتر، التبويبات، المنشورات، الكتّاب، المفاتيح
//         ونافذة إضافة منشور جديدة مع تبويبات أنواع المحتوى واختيار التبويبة والفرع
//  يعتمد على: firebase-config.js, utils.js
// ============================================================

// ---------- 1. المتغيرات العامة ----------
let adminCurrentSection = 'header';
let isAdminLoggedIn = false;

// خاصة بنافذة إضافة المنشور
let postContentItems = [];
let selectedCategoryId = null;
let selectedSubcategoryId = null;

// ---------- 2. التحقق من الجلسة عند التحميل ----------
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('adminSession')) {
        auth.onAuthStateChanged(user => {
            if (user) {
                showAdminPanel(user);
            } else {
                showLoginScreen();
            }
        });
    } else {
        showLoginScreen();
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    setupSidebarEvents();
});

// ---------- 3. دوال الجلسة وتسجيل الدخول ----------
function showLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    const adminScreen = document.getElementById('admin-screen');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (adminScreen) adminScreen.style.display = 'none';
    localStorage.removeItem('adminSession');
}

function showAdminPanel(user) {
    const loginScreen = document.getElementById('login-screen');
    const adminScreen = document.getElementById('admin-screen');
    if (loginScreen) loginScreen.style.display = 'none';
    if (adminScreen) adminScreen.style.display = 'flex';

    localStorage.setItem('adminSession', 'true');
    isAdminLoggedIn = true;

    console.log(`✅ تم تسجيل الدخول كـ: ${user.email}`);
    loadSection(adminCurrentSection);
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const loginBtn = e.target.querySelector('button[type="submit"]');
    if (!email || !password) return alert('يرجى إدخال البريد الإلكتروني وكلمة المرور');

    loginBtn.disabled = true;
    loginBtn.textContent = 'جاري الدخول...';

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        let errorMessage = 'حدث خطأ في تسجيل الدخول';
        switch (error.code) {
            case 'auth/invalid-email': errorMessage = 'صيغة البريد الإلكتروني غير صحيحة'; break;
            case 'auth/user-not-found': errorMessage = 'لا يوجد مستخدم بهذا البريد الإلكتروني'; break;
            case 'auth/wrong-password': errorMessage = 'كلمة المرور غير صحيحة'; break;
            case 'auth/too-many-requests': errorMessage = 'محاولات كثيرة جداً. حاول مرة أخرى لاحقاً'; break;
        }
        alert('❌ ' + errorMessage);
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'دخول';
    }
}

async function logoutAdmin() {
    try { await auth.signOut(); } catch (error) {}
    localStorage.removeItem('adminSession');
    isAdminLoggedIn = false;
    window.location.href = 'index.html';
}

// ---------- 4. إعداد الشريط الجانبي ----------
function setupSidebarEvents() {
    const sidebarItems = document.querySelectorAll('.admin-sidebar ul li');
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            if (section) {
                sidebarItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                loadSection(section);
            }
        });
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logoutAdmin);
}

// ---------- 5. تحميل الأقسام ----------
async function loadSection(section) {
    const panel = document.getElementById('content-panel');
    if (!panel) return;
    adminCurrentSection = section;
    panel.innerHTML = '<div class="loading-spinner">⏳ جاري تحميل القسم...</div>';

    try {
        switch (section) {
            case 'header': await loadHeaderSection(panel); break;
            case 'body': await loadBodySection(panel); break;
            case 'footer': await loadFooterSection(panel); break;
            case 'categories': await loadCategoriesSection(panel); break;
            case 'posts': await loadPostsSection(panel); break;
            case 'authors': await loadAuthorsSection(panel); break;
            case 'keys': await loadKeysSection(panel); break;
            default: panel.innerHTML = '<p>القسم غير معروف</p>';
        }
    } catch (error) {
        console.error(`خطأ في تحميل قسم ${section}:`, error);
        panel.innerHTML = '<p class="error-message">⚠️ حدث خطأ أثناء تحميل القسم</p>';
    }
}

// ---------- 6. قسم إدارة الهيدر ----------
async function loadHeaderSection(panel) {
    const settings = await getAllSettingsCached();
    const siteName = settings.siteName || 'ALSHANFRICC';
    const titleFont = settings.titleFont || 'Playfair Display';
    const bodyFont = settings.bodyFont || 'Cairo';
    const primaryColor = settings.primaryColor || '#c48b4c';
    const darkMode = settings.darkMode || false;

    const fontsOptions = AVAILABLE_FONTS.map(f =>
        `<option value="${f.name}" ${titleFont === f.name ? 'selected' : ''}>${f.name} (${f.type})</option>`
    ).join('');

    const bodyFontsOptions = AVAILABLE_FONTS.map(f =>
        `<option value="${f.name}" ${bodyFont === f.name ? 'selected' : ''}>${f.name} (${f.type})</option>`
    ).join('');

    panel.innerHTML = `
        <h2>إدارة الهيدر</h2>
        <div class="card">
            <div class="form-group">
                <label>اسم الموقع</label>
                <input type="text" id="header-site-name" class="form-control" value="${siteName}">
            </div>
            <div class="form-group">
                <label>خط العنوان (الشعار والعناوين)</label>
                <select id="title-font" class="form-control">${fontsOptions}</select>
            </div>
            <div class="form-group">
                <label>خط النص (المحتوى العام)</label>
                <select id="body-font" class="form-control">${bodyFontsOptions}</select>
            </div>
            <div class="form-group">
                <label>اللون الأساسي</label>
                <input type="color" id="header-color" class="form-control" value="${primaryColor}">
            </div>
            <div class="form-group">
                <label><input type="checkbox" id="header-darkmode" ${darkMode ? 'checked' : ''}> تفعيل الوضع الليلي افتراضياً</label>
            </div>
            <button class="btn btn-primary" onclick="saveHeaderSettings()">💾 حفظ إعدادات الهيدر</button>
        </div>
    `;
}

async function saveHeaderSettings() {
    await updateSetting('siteName', document.getElementById('header-site-name').value);
    await updateSetting('titleFont', document.getElementById('title-font').value);
    await updateSetting('bodyFont', document.getElementById('body-font').value);
    await updateSetting('primaryColor', document.getElementById('header-color').value);
    await updateSetting('darkMode', document.getElementById('header-darkmode').checked);
    alert('✅ تم حفظ إعدادات الهيدر بنجاح');
}

// ---------- 7. قسم إدارة البدي ----------
async function loadBodySection(panel) {
    const bodyBg = await getSetting('bodyBackground', '#f0f2f5');
    panel.innerHTML = `
        <h2>إدارة البدي</h2>
        <div class="card">
            <div class="form-group">
                <label>لون خلفية المحتوى</label>
                <input type="color" id="body-bg" class="form-control" value="${bodyBg}">
            </div>
            <button class="btn btn-primary" onclick="saveBodySettings()">💾 حفظ</button>
        </div>`;
}

async function saveBodySettings() {
    await updateSetting('bodyBackground', document.getElementById('body-bg').value);
    alert('✅ تم الحفظ');
}

// ---------- 8. قسم إدارة الفوتر ----------
async function loadFooterSection(panel) {
    const settings = await getAllSettingsCached();
    const footerText = settings.footerText || 'جميع الحقوق محفوظة';
    const fb = settings.facebookUrl || '#';
    const tw = settings.twitterUrl || '#';
    const ig = settings.instagramUrl || '';

    panel.innerHTML = `
        <h2>إدارة الفوتر</h2>
        <div class="card">
            <div class="form-group"><label>نص الحقوق</label><input type="text" id="footer-text" class="form-control" value="${footerText}"></div>
            <div class="form-group"><label>فيسبوك</label><input type="url" id="footer-fb" class="form-control" value="${fb}"></div>
            <div class="form-group"><label>تويتر</label><input type="url" id="footer-tw" class="form-control" value="${tw}"></div>
            <div class="form-group"><label>انستغرام</label><input type="url" id="footer-ig" class="form-control" value="${ig}"></div>
            <button class="btn btn-primary" onclick="saveFooterSettings()">💾 حفظ</button>
        </div>`;
}

async function saveFooterSettings() {
    await updateSetting('footerText', document.getElementById('footer-text').value);
    await updateSetting('facebookUrl', document.getElementById('footer-fb').value);
    await updateSetting('twitterUrl', document.getElementById('footer-tw').value);
    await updateSetting('instagramUrl', document.getElementById('footer-ig').value);
    alert('✅ تم حفظ إعدادات الفوتر');
}

// ---------- 9. التبويبات والفروع ----------
async function loadCategoriesSection(panel) {
    panel.innerHTML = `
        <h2>إدارة التبويبات</h2>
        <div class="card">
            <input type="text" id="cat-name" class="form-control" placeholder="اسم التبويبة">
            <input type="text" id="cat-icon" class="form-control" placeholder="الأيقونة (إيموجي)">
            <button class="btn btn-primary" onclick="addCategory()">➕ إضافة</button>
        </div>
        <div id="categories-list" class="card"><div id="categories-container">⏳</div></div>`;
    await renderCategories();
}

async function addCategory() {
    const name = document.getElementById('cat-name').value.trim();
    const icon = document.getElementById('cat-icon').value.trim();
    if (!name) return alert('أدخل الاسم');
    const snapshot = await db.collection('categories').orderBy('order', 'desc').limit(1).get();
    let maxOrder = 0;
    snapshot.forEach(doc => maxOrder = doc.data().order || 0);
    await db.collection('categories').add({ name, icon: icon || '📌', order: maxOrder + 1, subcategories: [] });
    document.getElementById('cat-name').value = '';
    document.getElementById('cat-icon').value = '';
    await renderCategories();
}

async function deleteCategory(catId) {
    if (!confirm('حذف التبويبة؟')) return;
    await db.collection('categories').doc(catId).delete();
    await renderCategories();
}

async function addSubcategory(catId) {
    const name = prompt('اسم الفرع:');
    if (!name) return;
    const catRef = db.collection('categories').doc(catId);
    const doc = await catRef.get();
    if (doc.exists) {
        const data = doc.data();
        const subs = data.subcategories || [];
        subs.push({ id: generateId(), name });
        await catRef.update({ subcategories: subs });
        await renderCategories();
    }
}

async function deleteSubcategory(catId, subId) {
    if (!confirm('حذف الفرع؟')) return;
    const catRef = db.collection('categories').doc(catId);
    const doc = await catRef.get();
    if (doc.exists) {
        const subs = (doc.data().subcategories || []).filter(s => s.id !== subId);
        await catRef.update({ subcategories: subs });
        await renderCategories();
    }
}

async function renderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;
    const snapshot = await db.collection('categories').orderBy('order').get();
    if (snapshot.empty) { container.innerHTML = '<p>لا توجد تبويبات</p>'; return; }
    let html = '';
    snapshot.forEach(doc => {
        const cat = doc.data();
        html += `<div class="list-item">
            <div class="item-info"><span class="item-title">${cat.icon} ${cat.name}</span>
            <div class="item-meta">فروع: ${(cat.subcategories||[]).map(s=>s.name).join('، ')||'لا يوجد'}</div></div>
            <div class="item-actions">
                <button class="btn btn-sm btn-outline" onclick="addSubcategory('${doc.id}')">➕ فرع</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory('${doc.id}')">🗑️</button>
            </div></div>`;
        if (cat.subcategories) cat.subcategories.forEach(sub => {
            html += `<div class="list-item" style="padding-right:40px;background:#f9f9f9">
                <span>↳ ${sub.name}</span>
                <button class="btn btn-sm btn-danger" onclick="deleteSubcategory('${doc.id}','${sub.id}')">🗑️</button></div>`;
        });
    });
    container.innerHTML = html;
}

// ---------- 10. المنشورات (مع نافذة الإضافة المطورة) ----------
async function loadPostsSection(panel) {
    panel.innerHTML = `
        <h2>إدارة المنشورات</h2>
        <button class="btn btn-primary" onclick="showAddPostForm()">➕ إضافة منشور جديد</button>
        <div id="posts-list" class="card" style="margin-top:20px;">
            <h3>المنشورات الحالية</h3>
            <div id="posts-container">⏳ جاري التحميل...</div>
        </div>`;
    await renderPostsList();
}

// ---- دوال نافذة إضافة المنشور ----
async function showAddPostForm() {
    postContentItems = [];
    selectedCategoryId = null;
    selectedSubcategoryId = null;

    // جلب التبويبات من Firestore
    const catsSnapshot = await db.collection('categories').orderBy('order').get();
    let catOptions = '<option value="">-- اختر التبويبة --</option>';
    catsSnapshot.forEach(doc => {
        const cat = doc.data();
        catOptions += `<option value="${doc.id}">${cat.icon || '📌'} ${cat.name}</option>`;
    });

    const modalHTML = `
    <div id="addPostModal" class="modal-overlay">
      <div class="modal-content">
        <button class="modal-close" onclick="closeAddPostModal()">✕</button>
        <h3>إضافة منشور جديد</h3>

        <div class="form-group">
          <label>العنوان الرئيسي</label>
          <input type="text" id="postMainTitle" class="form-control" placeholder="أدخل عنوان المنشور">
        </div>

        <div class="form-group">
          <label>التبويبة</label>
          <select id="postCategory" class="form-control" onchange="onCategoryChange()">
            ${catOptions}
          </select>
        </div>

        <div class="form-group" id="subcategoryGroup" style="display:none;">
          <label>الفرع</label>
          <select id="postSubcategory" class="form-control">
            <option value="">الكل</option>
          </select>
        </div>

        <div class="admin-tabs" id="contentTypeTabs">
          <button class="admin-tab active" data-type="subtitle">عنوان فرعي</button>
          <button class="admin-tab" data-type="images">صور</button>
          <button class="admin-tab" data-type="code">كود</button>
          <button class="admin-tab" data-type="link">رابط</button>
          <button class="admin-tab" data-type="markdown">مقال (Markdown)</button>
          <button class="admin-tab" data-type="html">مقال (HTML)</button>
        </div>

        <div id="contentInputArea" class="content-input-area"></div>
        <button class="btn btn-primary" id="addContentItemBtn">➕ أضف إلى المحتوى</button>

        <div class="added-items-list">
          <h4>العناصر المضافة:</h4>
          <div id="addedItemsContainer"></div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-primary" onclick="saveNewPost()">💾 نشر المنشور</button>
          <button class="btn btn-outline" onclick="closeAddPostModal()">إلغاء</button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    switchContentType('subtitle');
    setupContentTabs();
}

function closeAddPostModal() {
    const modal = document.getElementById('addPostModal');
    if (modal) modal.remove();
}

async function onCategoryChange() {
    const catId = document.getElementById('postCategory').value;
    selectedCategoryId = catId || null;
    selectedSubcategoryId = null;

    const subGroup = document.getElementById('subcategoryGroup');
    const subSelect = document.getElementById('postSubcategory');

    if (!catId) {
        subGroup.style.display = 'none';
        return;
    }

    const catDoc = await db.collection('categories').doc(catId).get();
    if (!catDoc.exists) {
        subGroup.style.display = 'none';
        return;
    }

    const cat = catDoc.data();
    const subs = cat.subcategories || [];
    if (subs.length === 0) {
        subGroup.style.display = 'none';
        return;
    }

    subSelect.innerHTML = '<option value="">الكل</option>';
    subs.forEach(sub => {
        subSelect.innerHTML += `<option value="${sub.id}">${sub.name}</option>`;
    });
    subGroup.style.display = 'block';
}

function setupContentTabs() {
    document.querySelectorAll('#contentTypeTabs .admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#contentTypeTabs .admin-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            switchContentType(tab.dataset.type);
        });
    });

    document.getElementById('addContentItemBtn').addEventListener('click', () => {
        const activeTab = document.querySelector('#contentTypeTabs .admin-tab.active');
        if (activeTab) addContentItem(activeTab.dataset.type);
    });
}

function switchContentType(type) {
    const area = document.getElementById('contentInputArea');
    switch (type) {
        case 'subtitle':
            area.innerHTML = `<input type="text" id="subtitleInput" class="form-control" placeholder="أدخل عنواناً فرعياً">`;
            break;
        case 'images':
            area.innerHTML = `
                <input type="file" id="imageFiles" class="form-control" multiple accept="image/*" style="display:none" onchange="handleImageSelect(event)">
                <button class="btn btn-outline" onclick="document.getElementById('imageFiles').click()">اختر صوراً</button>
                <div id="imagePreview" class="file-preview"></div>`;
            break;
        case 'code':
            area.innerHTML = `
                <select id="codeLanguage" class="form-control">
                    <option value="html">HTML</option><option value="python">Python</option>
                    <option value="php">PHP</option><option value="javascript">JavaScript</option>
                    <option value="ruby">Ruby</option><option value="css">CSS</option>
                </select>
                <textarea id="codeContent" class="form-control editor-content" placeholder="أدخل الكود..."></textarea>`;
            break;
        case 'link':
            area.innerHTML = `
                <input type="text" id="linkUrl" class="form-control" placeholder="https://example.com">
                <input type="text" id="linkText" class="form-control" placeholder="نص الرابط (اختياري)">`;
            break;
        case 'markdown':
            area.innerHTML = `<textarea id="markdownContent" class="form-control editor-content" placeholder="أدخل مقال Markdown..."></textarea>`;
            break;
        case 'html':
            area.innerHTML = `<textarea id="htmlContent" class="form-control editor-content" placeholder="أدخل كود HTML..."></textarea>`;
            break;
    }
}

function handleImageSelect(event) {
    const files = event.target.files;
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = e => preview.innerHTML += `<img src="${e.target.result}" style="width:80px;height:80px;object-fit:cover;margin:4px;">`;
        reader.readAsDataURL(files[i]);
    }
}

function addContentItem(type) {
    let item = { type };
    switch (type) {
        case 'subtitle':
            const subVal = document.getElementById('subtitleInput').value.trim();
            if (!subVal) return alert('أدخل العنوان الفرعي');
            item.value = subVal;
            break;
        case 'images':
            const files = document.getElementById('imageFiles').files;
            if (files.length === 0) return alert('اختر صورة');
            const promises = Array.from(files).map(file => new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = e => resolve({ dataUrl: e.target.result, name: file.name });
                reader.readAsDataURL(file);
            }));
            Promise.all(promises).then(images => {
                item.images = images;
                postContentItems.push(item);
                renderAddedItems();
                document.getElementById('imageFiles').value = '';
                document.getElementById('imagePreview').innerHTML = '';
            });
            return; // منع الإضافة المباشرة
        case 'code':
            const lang = document.getElementById('codeLanguage').value;
            const codeVal = document.getElementById('codeContent').value.trim();
            if (!codeVal) return alert('أدخل الكود');
            item.language = lang;
            item.value = codeVal;
            break;
        case 'link':
            const url = document.getElementById('linkUrl').value.trim();
            if (!url) return alert('أدخل الرابط');
            item.url = url;
            item.text = document.getElementById('linkText').value.trim() || url;
            break;
        case 'markdown':
            const mdVal = document.getElementById('markdownContent').value.trim();
            if (!mdVal) return alert('أدخل مقال Markdown');
            item.value = mdVal;
            break;
        case 'html':
            const htmlVal = document.getElementById('htmlContent').value.trim();
            if (!htmlVal) return alert('أدخل كود HTML');
            item.value = htmlVal;
            break;
    }
    postContentItems.push(item);
    renderAddedItems();
    switchContentType(type);
}

function renderAddedItems() {
    const container = document.getElementById('addedItemsContainer');
    container.innerHTML = postContentItems.map((item, i) => {
        let desc = '';
        switch (item.type) {
            case 'subtitle': desc = `عنوان فرعي: ${item.value}`; break;
            case 'images': desc = `${item.images.length} صورة`; break;
            case 'code': desc = `كود ${item.language}`; break;
            case 'link': desc = `رابط: ${item.text}`; break;
            case 'markdown': desc = 'مقال Markdown'; break;
            case 'html': desc = 'مقال HTML'; break;
        }
        return `<div class="list-item"><span>${desc}</span><button class="btn btn-sm btn-danger" onclick="removeContentItem(${i})">🗑️</button></div>`;
    }).join('');
}

function removeContentItem(index) {
    postContentItems.splice(index, 1);
    renderAddedItems();
}

async function saveNewPost() {
    const mainTitle = document.getElementById('postMainTitle').value.trim();
    if (!mainTitle) return alert('أدخل العنوان الرئيسي');

    // قراءة التبويبة والفرع من الحقول الظاهرة
    const catSelect = document.getElementById('postCategory');
    const subSelect = document.getElementById('postSubcategory');
    const categoryId = catSelect?.value || null;
    const subcategoryId = (subSelect && subSelect.style.display !== 'none') ? (subSelect.value || null) : null;

    if (!categoryId) return alert('اختر التبويبة');
    if (postContentItems.length === 0) return alert('أضف عنصراً واحداً على الأقل');

    await db.collection('posts').add({
        title: mainTitle,
        content: postContentItems,
        author: 'مجهول',
        category: categoryId,
        subcategory: subcategoryId,
        date: new Date().toISOString(),
        likes: 0,
        likedBy: [],
        comments: [],
        views: 0
    });

    closeAddPostModal();
    await renderPostsList();
    alert('✅ تم نشر المنشور');
}

async function deletePost(postId) {
    if (!confirm('حذف المنشور؟')) return;
    await db.collection('posts').doc(postId).delete();
    await renderPostsList();
}

async function renderPostsList() {
    const container = document.getElementById('posts-container');
    if (!container) return;
    const snapshot = await db.collection('posts').orderBy('date', 'desc').limit(30).get();
    if (snapshot.empty) { container.innerHTML = '<p>لا توجد منشورات</p>'; return; }
    let html = '';
    snapshot.forEach(doc => {
        const post = doc.data();
        html += `<div class="list-item">
            <div class="item-info"><span class="item-title">${post.title}</span>
            <div class="item-meta">${post.author||'مجهول'} · ${timeAgo(post.date)}</div></div>
            <button class="btn btn-sm btn-danger" onclick="deletePost('${doc.id}')">🗑️</button>
        </div>`;
    });
    container.innerHTML = html;
}

// ---------- 11. الكتّاب ----------
async function loadAuthorsSection(panel) {
    panel.innerHTML = `
        <h2>الكتّاب</h2>
        <div class="card"><input type="text" id="author-name" class="form-control" placeholder="اسم الكاتب"><button class="btn btn-primary" onclick="addAuthor()">➕ إضافة</button></div>
        <div id="authors-list" class="card"><div id="authors-container">⏳</div></div>`;
    await renderAuthors();
}
async function addAuthor() {
    const name = document.getElementById('author-name').value.trim();
    if (!name) return alert('أدخل الاسم');
    await db.collection('authors').add({ name, createdAt: new Date().toISOString() });
    document.getElementById('author-name').value = '';
    await renderAuthors();
}
async function deleteAuthor(id) {
    if (!confirm('حذف؟')) return;
    await db.collection('authors').doc(id).delete();
    await renderAuthors();
}
async function renderAuthors() {
    const container = document.getElementById('authors-container');
    if (!container) return;
    const snapshot = await db.collection('authors').orderBy('createdAt').get();
    if (snapshot.empty) { container.innerHTML = '<p>لا يوجد كتّاب</p>'; return; }
    container.innerHTML = snapshot.docs.map(doc => {
        const a = doc.data();
        return `<div class="list-item"><span>✍️ ${a.name}</span><button class="btn btn-sm btn-danger" onclick="deleteAuthor('${doc.id}')">🗑️</button></div>`;
    }).join('');
}

// ---------- 12. المفاتيح ----------
async function loadKeysSection(panel) {
    panel.innerHTML = `
        <h2>المفاتيح</h2>
        <div class="card">
            <input type="text" id="key-name" class="form-control" placeholder="الاسم">
            <select id="key-type" class="form-control"><option value="ai">ذكاء اصطناعي</option><option value="database">قاعدة بيانات</option></select>
            <input type="text" id="key-value" class="form-control" placeholder="المفتاح">
            <textarea id="key-instructions" class="form-control" placeholder="تعليمات"></textarea>
            <button class="btn btn-primary" onclick="addKey()">➕ إضافة</button>
        </div>
        <div id="keys-list" class="card"><div id="keys-container">⏳</div></div>`;
    await renderKeys();
}
async function addKey() {
    const name = document.getElementById('key-name').value.trim();
    const type = document.getElementById('key-type').value;
    const value = document.getElementById('key-value').value.trim();
    const instructions = document.getElementById('key-instructions').value.trim();
    if (!name || !value) return alert('أدخل الاسم والمفتاح');
    await db.collection('api_keys').add({ name, type, value, instructions, createdAt: new Date().toISOString() });
    document.getElementById('key-name').value = '';
    document.getElementById('key-value').value = '';
    document.getElementById('key-instructions').value = '';
    await renderKeys();
}
async function deleteKey(id) {
    if (!confirm('حذف؟')) return;
    await db.collection('api_keys').doc(id).delete();
    await renderKeys();
}
async function renderKeys() {
    const container = document.getElementById('keys-container');
    if (!container) return;
    const snapshot = await db.collection('api_keys').orderBy('createdAt', 'desc').get();
    if (snapshot.empty) { container.innerHTML = '<p>لا توجد مفاتيح</p>'; return; }
    container.innerHTML = snapshot.docs.map(doc => {
        const k = doc.data();
        return `<div class="list-item"><span>🔑 ${k.name} (${k.type})</span><button class="btn btn-sm btn-danger" onclick="deleteKey('${doc.id}')">🗑️</button></div>`;
    }).join('');
}

// ---------- 13. تأكيد التحميل ----------
console.log("✅ ملف admin.js تم تحميله بنجاح - جميع الأقسام جاهزة");
