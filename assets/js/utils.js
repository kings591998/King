// ============================================================
//  ملف: utils.js (مُدمَج - كامل ومُحدّث)
//  الوظيفة: دوال مساعدة مشتركة لجميع أجزاء الموقع
//  يشمل: إدارة الإعدادات، التخزين المؤقت، الخطوط،
//         Markdown، الوقت، النصوص، الصور، Toast
//  يعتمد على: firebase-config.js
// ============================================================

// ---------- 1. الإعدادات الافتراضية ----------
const DEFAULT_SETTINGS = {
  siteName: 'ALSHANFRICC',
  subtitle: 'مساحة الأناقة والمعرفة',
  primaryColor: '#c48b4c',
  titleFont: 'Playfair Display',
  bodyFont: 'Cairo',
  darkMode: false,
  footerText: 'جميع الحقوق محفوظة',
  facebookUrl: '#',
  twitterUrl: '#',
  instagramUrl: '#',
  bodyBackground: '#f0f2f5',
  openai_api_key: '',
  headerBgImage: '',
  backgroundImages: [],
  backgroundInterval: 60
};

// ---------- 2. قائمة الخطوط الكاملة (20 عربي + 20 إنجليزي) ----------
const AVAILABLE_FONTS = [
  // خطوط عربية
  { name: 'Cairo', type: 'عربي' },
  { name: 'Tajawal', type: 'عربي' },
  { name: 'Amiri', type: 'عربي' },
  { name: 'El Messiri', type: 'عربي' },
  { name: 'Almarai', type: 'عربي' },
  { name: 'Changa', type: 'عربي' },
  { name: 'Reem Kufi', type: 'عربي' },
  { name: 'Scheherazade New', type: 'عربي' },
  { name: 'Markazi Text', type: 'عربي' },
  { name: 'Harmattan', type: 'عربي' },
  { name: 'Lateef', type: 'عربي' },
  { name: 'Aref Ruqaa', type: 'عربي' },
  { name: 'Rakkas', type: 'عربي' },
  { name: 'Lemonada', type: 'عربي' },
  { name: 'Baloo Bhaijaan 2', type: 'عربي' },
  { name: 'Noto Naskh Arabic', type: 'عربي' },
  { name: 'Noto Kufi Arabic', type: 'عربي' },
  { name: 'Mada', type: 'عربي' },
  { name: 'Zain', type: 'عربي' },
  { name: 'Ibrahim', type: 'عربي' },
  // خطوط إنجليزية
  { name: 'Playfair Display', type: 'إنجليزي' },
  { name: 'Poppins', type: 'إنجليزي' },
  { name: 'Lora', type: 'إنجليزي' },
  { name: 'Montserrat', type: 'إنجليزي' },
  { name: 'Roboto', type: 'إنجليزي' },
  { name: 'Open Sans', type: 'إنجليزي' },
  { name: 'Raleway', type: 'إنجليزي' },
  { name: 'Oswald', type: 'إنجليزي' },
  { name: 'Merriweather', type: 'إنجليزي' },
  { name: 'Pacifico', type: 'إنجليزي' },
  { name: 'Nunito', type: 'إنجليزي' },
  { name: 'Quicksand', type: 'إنجليزي' },
  { name: 'Fira Sans', type: 'إنجليزي' },
  { name: 'Ubuntu', type: 'إنجليزي' },
  { name: 'PT Serif', type: 'إنجليزي' },
  { name: 'Bitter', type: 'إنجليزي' },
  { name: 'Josefin Sans', type: 'إنجليزي' },
  { name: 'Dancing Script', type: 'إنجليزي' },
  { name: 'Cinzel', type: 'إنجليزي' },
  { name: 'Abril Fatface', type: 'إنجليزي' }
];

// ---------- 3. التخزين المؤقت للإعدادات ----------
const SETTINGS_CACHE_KEY = 'alshanfricc_settings_cache';
const SETTINGS_CACHE_TIME = 30 * 60 * 1000; // 30 دقيقة

/**
 * جلب الإعدادات المخزنة محلياً إذا كانت صالحة
 * @returns {Object|null}
 */
function getCachedSettingsFromLocal() {
    try {
        const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (Date.now() - data.timestamp < SETTINGS_CACHE_TIME) {
            return data.settings;
        }
    } catch (e) {}
    return null;
}

/**
 * حفظ الإعدادات في localStorage مع توقيت
 * @param {Object} settings
 */
function saveCachedSettingsToLocal(settings) {
    try {
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify({
            settings: settings,
            timestamp: Date.now()
        }));
    } catch (e) {}
}

/**
 * جلب جميع الإعدادات (من المخبأ أو Firestore)
 * @returns {Object}
 */
async function getAllSettingsCached() {
    // 1. تجربة المخبأ المحلي
    const local = getCachedSettingsFromLocal();
    if (local) {
        // تحديث صامت في الخلفية
        setTimeout(() => refreshSettingsFromServer(), 100);
        return local;
    }

    // 2. لا يوجد مخبأ، نجلب من Firestore مع مهلة
    try {
        const doc = await Promise.race([
            db.collection('settings').doc('site').get(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);
        const settings = doc.exists ? { ...DEFAULT_SETTINGS, ...doc.data() } : { ...DEFAULT_SETTINGS };
        saveCachedSettingsToLocal(settings);
        return settings;
    } catch (error) {
        console.warn('تعذر جلب الإعدادات، استخدام الافتراضي');
        return { ...DEFAULT_SETTINGS };
    }
}

/**
 * جلب قيمة إعداد واحد
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
async function getSetting(key, defaultValue = '') {
    const settings = await getAllSettingsCached();
    return settings[key] !== undefined ? settings[key] : defaultValue;
}

/**
 * تحديث إعداد معين في Firestore
 * @param {string} key
 * @param {*} value
 */
async function updateSetting(key, value) {
    try {
        await db.collection('settings').doc('site').set({ [key]: value }, { merge: true });
        // إبطال المخبأ ليعكس التغييرات
        saveCachedSettingsToLocal(null);
        console.log(`✅ تم تحديث الإعداد: ${key}`);
    } catch (error) {
        console.error(`خطأ في تحديث الإعداد (${key}):`, error);
    }
}

// متغير للمنع من تكرار طلب التحديث
let refreshPromise = null;

/**
 * تحديث الإعدادات من السيرفر بصمت
 */
function refreshSettingsFromServer() {
    if (refreshPromise) return;
    refreshPromise = db.collection('settings').doc('site').get()
        .then(doc => {
            const settings = doc.exists ? { ...DEFAULT_SETTINGS, ...doc.data() } : { ...DEFAULT_SETTINGS };
            saveCachedSettingsToLocal(settings);
            refreshPromise = null;
        })
        .catch(() => { refreshPromise = null; });
}

// ---------- 4. دوال الوقت والتاريخ ----------

/**
 * تحويل التاريخ إلى نص "منذ فترة" بالعربية
 * @param {string|Date} date
 * @returns {string}
 */
function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 0) return 'الآن';
    if (seconds < 60) return 'الآن';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `قبل ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `قبل ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `قبل ${days} يوم`;
    const months = Math.floor(days / 30);
    if (months < 12) return `قبل ${months} شهر`;
    return `قبل ${Math.floor(days / 365)} سنة`;
}

/**
 * تنسيق التاريخ بالعربية
 * @param {string|Date} date
 * @returns {string}
 */
function formatDateArabic(date) {
    return new Date(date).toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ---------- 5. دوال النصوص والمحتوى ----------

/**
 * اقتطاع النص إلى عدد معين من الأحرف
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncateText(text, maxLength = 200) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength) + '...';
}

/**
 * استخراج أول صورة من مصفوفة محتوى المقال
 * @param {Array} contentArray
 * @returns {string|null}
 */
function getFirstImage(contentArray) {
    if (!Array.isArray(contentArray)) return null;
    for (let item of contentArray) {
        if (item.type === 'image' && item.value) return item.value;
        if (item.type === 'images' && item.images && item.images.length > 0) {
            const first = item.images[0];
            return first.dataUrl || first.url || first;
        }
    }
    return null;
}

/**
 * استخراج النص فقط من محتوى المقال
 * @param {Array} contentArray
 * @returns {string}
 */
function getTextOnly(contentArray) {
    if (!Array.isArray(contentArray)) return '';
    return contentArray
        .filter(el => ['text', 'subtitle', 'markdown', 'html', 'quote', 'summary'].includes(el.type))
        .map(el => el.value || '')
        .join(' ')
        .substring(0, 300);
}

/**
 * تنظيف النص من أكواد HTML ضارة
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

/**
 * هروب الرموز الخاصة في النص (للبحث)
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- 6. دوال عامة ----------

/**
 * إنشاء معرف فريد
 * @returns {string}
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * تنظيف النص من HTML
 * @param {string} str
 * @returns {string}
 */
function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

/**
 * Debounce: تأخير تنفيذ دالة
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * تمرير سلس إلى عنصر
 * @param {string} elementId
 */
function scrollToElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ---------- 7. معالجة Markdown ----------

/**
 * تحويل نص Markdown إلى HTML
 * @param {string} text
 * @returns {string}
 */
function parseMarkdown(text) {
    if (!text) return '';
    let html = text;
    // هروب HTML
    html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // عناوين
    html = html.replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>');
    // خط عريض ومائل
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // روابط
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // صور
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">');
    // قوائم
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>)+)/g, '<ul>$1</ul>');
    // خط أفقي
    html = html.replace(/^---$/gm, '<hr>');
    // كود مضمّن
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    // أسطر جديدة
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

// ---------- 8. تطبيق خط ديناميكي ----------

/**
 * تطبيق خط على الصفحة
 * @param {string} fontFamily
 * @param {string} target - 'body' أو 'title'
 */
function applyFont(fontFamily, target = 'body') {
    if (target === 'body') {
        document.body.style.fontFamily = fontFamily + ', sans-serif';
    } else if (target === 'title') {
        const titles = document.querySelectorAll('.site-title, .post-title, .logo');
        titles.forEach(el => el.style.fontFamily = fontFamily + ', serif');
    }
    const link = document.getElementById('dynamic-font-link');
    if (link) {
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;700&display=swap`;
    }
}

// ---------- 9. نظام Toast Notifications ----------

/**
 * عرض رسالة Toast أنيقة
 * @param {string} message - نص الرسالة
 * @param {string} type - success, error, info, warning
 * @param {number} duration - مدة الظهور بالميلي ثانية
 */
function showToast(message, type = 'success', duration = 3000) {
    // إزالة أي توست موجود
    const existing = document.querySelector('.toast-container');
    if (existing) existing.remove();

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };

    const container = document.createElement('div');
    container.className = 'toast-container';
    container.innerHTML = `
        <div class="toast toast-${type}">
            <span class="toast-icon">${icons[type] || icons.success}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.closest('.toast-container').remove()">✕</button>
        </div>
    `;
    document.body.appendChild(container);

    // إظهار بأنميشن
    setTimeout(() => container.classList.add('show'), 10);

    // إخفاء تلقائي
    const timer = setTimeout(() => {
        container.classList.remove('show');
        setTimeout(() => container.remove(), 400);
    }, duration);

    // إغلاق بالنقر على التوست نفسه
    container.querySelector('.toast').addEventListener('click', () => {
        clearTimeout(timer);
        container.classList.remove('show');
        setTimeout(() => container.remove(), 400);
    });
}

// ---------- 10. تأكيد التحميل ----------
console.log("✅ ملف utils.js تم تحميله بنجاح - جميع الدوال المساعدة جاهزة");
