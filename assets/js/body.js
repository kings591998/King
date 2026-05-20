// ============================================================
//  ملف: body.js (مُحدّث)
//  الوظيفة: عرض المقالات في الواجهة الرئيسية بتصميم فيسبوكي
//  يشمل: التحميل، البطاقات، التفاعلات (إعجاب، تعليق، مشاركة)،
//         توسيع البطاقة عند "قراءة المزيد"، عرض أنواع المحتوى المتعددة
//  يعتمد على: firebase-config.js, utils.js, header.js
// ============================================================

// ---------- متغيرات عامة ----------
let lastVisiblePost = null;
let isLoadingPosts = false;
let allPostsLoaded = false;
let activeCommentPostId = null;
let currentSearchQuery = '';

// ---------- الدالة الرئيسية: تحميل المقالات ----------
async function loadPosts(loadMore = false) {
  if (isLoadingPosts || allPostsLoaded) return;
  isLoadingPosts = true;

  const feed = document.getElementById('posts-feed');
  if (!feed) {
    isLoadingPosts = false;
    return;
  }

  if (!loadMore) {
    feed.innerHTML = '<div class="loading-spinner">⏳ جاري تحميل المقالات...</div>';
    lastVisiblePost = null;
    allPostsLoaded = false;
  }

  try {
    let query = db.collection('posts');

    if (window.currentCategoryId) {
      query = query.where('category', '==', currentCategoryId);
    }
    if (window.currentSubcategoryId) {
      query = query.where('subcategory', '==', currentSubcategoryId);
    }
    if (currentSearchQuery) {
      // فلتر بسيط: نبحث في العنوان فقط (يمكن تحسينه لاحقاً)
      query = query.where('title', '>=', currentSearchQuery)
                   .where('title', '<=', currentSearchQuery + '\uf8ff');
    }

    query = query.orderBy('date', 'desc').limit(15);
    if (loadMore && lastVisiblePost) {
      query = query.startAfter(lastVisiblePost);
    }

    const snapshot = await query.get();

    if (!loadMore) {
      feed.innerHTML = '';
    }

    if (snapshot.empty && !loadMore) {
      feed.innerHTML = `<div class="no-posts">
                          <div class="no-posts-icon">📝</div>
                          <h3>لا توجد مقالات حالياً</h3>
                          <p>لم يتم العثور على أي مقال. جرب تغيير الفلتر أو إضافة مقال جديد من لوحة التحكم.</p>
                        </div>`;
      allPostsLoaded = true;
      isLoadingPosts = false;
      return;
    }

    if (snapshot.empty && loadMore) {
      allPostsLoaded = true;
      isLoadingPosts = false;
      return;
    }

    lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];

    // جلب الإعدادات مرة واحدة لاستخدامها في البطاقات
    const settings = await getAllSettingsCached();
    const titleFont = settings.titleFont || 'Playfair Display';
    const bodyFont = settings.bodyFont || 'Cairo';

    for (const doc of snapshot.docs) {
      const post = doc.data();
      post.id = doc.id;
      const card = await createPostCard(post, titleFont, bodyFont);
      feed.appendChild(card);
    }

    if (snapshot.docs.length < 15) {
      allPostsLoaded = true;
    }

  } catch (error) {
    console.error('خطأ في تحميل المقالات:', error);
    if (!loadMore) {
      feed.innerHTML = '<p class="error-message">⚠️ حدث خطأ أثناء تحميل المقالات. حاول مرة أخرى.</p>';
    }
  }

  isLoadingPosts = false;
}

// ---------- إنشاء بطاقة المقال ----------
async function createPostCard(post, titleFont = 'Playfair Display', bodyFont = 'Cairo') {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.id = `post-${post.id}`;

  // استخراج أول صورة من المحتوى
  const firstImage = getFirstImage(post.content);
  const textPreview = getTextOnly(post.content);
  const displayText = truncateText(textPreview, 250);

  // بناء محتوى البطاقة (معالجة جميع أنواع العناصر)
  let contentHTML = '';
  if (post.content && Array.isArray(post.content)) {
    post.content.forEach(item => {
      switch (item.type) {
        case 'subtitle':
          contentHTML += `<h4 class="post-subtitle">${item.value}</h4>`;
          break;
        case 'images':
          if (item.images) {
            item.images.forEach(img => {
              const src = img.dataUrl || img;
              contentHTML += `<img src="${src}" class="post-image" loading="lazy" onerror="this.style.display='none'">`;
            });
          }
          break;
        case 'code':
          contentHTML += `<pre class="code-block"><code class="language-${item.language}">${escapeHTML(item.value)}</code></pre>`;
          break;
        case 'link':
          contentHTML += `<a href="${item.url}" target="_blank" rel="noopener" class="post-link">🔗 ${item.text || item.url}</a>`;
          break;
        case 'markdown':
          // تحويل بسيط للنص (يمكن استخدام مكتبة markdown-it لاحقاً)
          contentHTML += `<div class="markdown-content">${item.value.replace(/\n/g, '<br>')}</div>`;
          break;
        case 'markdown':
          contentHTML += `<div class="markdown-content">${parseMarkdown(item.value)}</div>`;
          break;
        case 'html':
          contentHTML += `<div class="html-content">${item.value}</div>`;
          break;
        case 'text':
        default:
          contentHTML += `<p>${item.value}</p>`;
      }
    });
  }

  // إذا لم يكن هناك محتوى مصفوفة، استخدم المحتوى النصي المباشر
  if (!contentHTML) {
    contentHTML = `<p>${escapeHTML(displayText)}</p>`;
  }

  // اسم الكاتب والتاريخ
  const authorName = post.author || 'مجهول';
  const postDate = post.date ? timeAgo(post.date) : '';

  // بناء HTML البطاقة
  card.innerHTML = `
    <div class="post-header">
      <div class="post-category-badge">
        ${post.categoryName ? `<span class="category-tag">${post.categoryName}</span>` : ''}
        ${post.subcategoryName ? `<span class="subcategory-tag">▸ ${post.subcategoryName}</span>` : ''}
      </div>
      <div class="post-options">
        <button class="icon-btn dropdown-btn" onclick="togglePostMenu(event, '${post.id}')">⋯</button>
        <div class="dropdown-menu" id="menu-${post.id}" style="display:none;">
          <div class="dropdown-item" onclick="copyPostLink('${post.id}')">🔗 نسخ الرابط</div>
          <div class="dropdown-item" onclick="saveForLater('${post.id}')">🔖 قراءة لاحقاً</div>
          <div class="dropdown-item" onclick="reportPost('${post.id}')">🚩 إبلاغ</div>
        </div>
      </div>
    </div>

    ${firstImage ? `<div class="post-image-container"><img src="${firstImage}" alt="${post.title}" class="post-image" loading="lazy" onerror="this.style.display='none'"></div>` : ''}

    <div class="post-body" style="font-family: '${bodyFont}', sans-serif;">
      <h3 class="post-title" style="font-family: '${titleFont}', serif; cursor:pointer;" onclick="expandPost('${post.id}')">${post.title}</h3>
      <div class="post-meta">
        <span class="post-author">✍️ ${authorName}</span>
        <span class="post-date">🕒 ${postDate}</span>
        ${post.views ? `<span class="post-views">👁️ ${post.views} مشاهدة</span>` : ''}
      </div>
      <div class="post-content">
        ${contentHTML}
        ${textPreview.length > 250 ? `<span class="read-more" onclick="expandPost('${post.id}')">... اقرأ المزيد</span>` : ''}
      </div>
    </div>

    <div class="post-actions">
      <button class="action-btn like-btn ${post.likedByUser ? 'liked' : ''}" onclick="toggleLike('${post.id}')">
        👍 <span class="like-text">${post.likedByUser ? 'أعجبني' : 'إعجاب'}</span>
        <span class="like-count">(${post.likes || 0})</span>
      </button>
      <button class="action-btn comment-btn" onclick="toggleComments('${post.id}')">
        💬 تعليق <span class="comment-count">(${post.comments ? post.comments.length : 0})</span>
      </button>
      <button class="action-btn share-btn" onclick="sharePost('${post.id}')">
        📤 مشاركة
      </button>
      <button class="action-btn translate-btn" onclick="translatePost('${post.id}')">
        🌐 ترجمة
      </button>
    </div>

    <div class="comments-section" id="comments-${post.id}" style="display:none;">
      <div class="comments-list" id="comments-list-${post.id}">
        ${(post.comments || []).map(comment => `
          <div class="comment-item">
            <div class="comment-avatar">👤</div>
            <div class="comment-content">
              <span class="comment-author">${comment.author || 'زائر'}</span>
              <span class="comment-date">${timeAgo(comment.date)}</span>
              <p>${comment.text}</p>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="comment-form">
        <input type="text" class="comment-input" id="comment-input-${post.id}" placeholder="اكتب تعليقاً..." onkeypress="if(event.key==='Enter') addComment('${post.id}')">
        <button class="comment-submit-btn" onclick="addComment('${post.id}')">نشر</button>
      </div>
    </div>
  `;

  return card;
}

// ---------- توسيع البطاقة (قراءة المزيد) ----------
function expandPost(postId) {
  const postBody = document.querySelector(`#post-${postId} .post-body`);
  if (postBody) {
    postBody.classList.toggle('expanded');
    // التمرير إلى بداية البطاقة إذا توسعت
    if (postBody.classList.contains('expanded')) {
      document.getElementById(`post-${postId}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

// ---------- دوال التفاعل (إعجاب، تعليق، مشاركة...) ----------
async function toggleLike(postId) {
  try {
    const postRef = db.collection('posts').doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return;
    const post = postDoc.data();
    const userFingerprint = getVisitorId();
    const hasLiked = (post.likedBy || []).includes(userFingerprint);

    if (hasLiked) {
      await postRef.update({
        likes: Math.max(0, (post.likes || 0) - 1),
        likedBy: firebase.firestore.FieldValue.arrayRemove(userFingerprint),
        likedByUser: false
      });
    } else {
      await postRef.update({
        likes: (post.likes || 0) + 1,
        likedBy: firebase.firestore.FieldValue.arrayUnion(userFingerprint),
        likedByUser: true
      });
    }
    updatePostCardLikes(postId);
  } catch (error) {
    console.error('خطأ في تحديث الإعجاب:', error);
  }
}

async function updatePostCardLikes(postId) {
  try {
    const postDoc = await db.collection('posts').doc(postId).get();
    if (!postDoc.exists) return;
    const post = postDoc.data();
    const likeBtn = document.querySelector(`#post-${postId} .like-btn`);
    const likeCount = document.querySelector(`#post-${postId} .like-count`);
    const likeText = document.querySelector(`#post-${postId} .like-text`);
    if (likeBtn && likeCount) {
      const hasLiked = (post.likedBy || []).includes(getVisitorId());
      likeBtn.classList.toggle('liked', hasLiked);
      likeCount.textContent = `(${post.likes || 0})`;
      if (likeText) likeText.textContent = hasLiked ? 'أعجبني' : 'إعجاب';
    }
  } catch (e) {}
}

function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;
  const isVisible = section.style.display !== 'none';
  document.querySelectorAll('.comments-section').forEach(s => s.style.display = 'none');
  section.style.display = isVisible ? 'none' : 'block';
  activeCommentPostId = isVisible ? null : postId;
  if (!isVisible) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (input) setTimeout(() => input.focus(), 200);
  }
}

async function addComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  try {
    const postRef = db.collection('posts').doc(postId);
    const newComment = {
      id: generateId(),
      author: 'زائر',
      text: sanitizeHTML(text),
      date: new Date().toISOString()
    };
    await postRef.update({
      comments: firebase.firestore.FieldValue.arrayUnion(newComment)
    });
    await refreshComments(postId);
    input.value = '';
  } catch (error) {
    console.error('خطأ في إضافة التعليق:', error);
  }
}

async function refreshComments(postId) {
  try {
    const postDoc = await db.collection('posts').doc(postId).get();
    if (!postDoc.exists) return;
    const post = postDoc.data();
    const list = document.getElementById(`comments-list-${postId}`);
    const count = document.querySelector(`#post-${postId} .comment-count`);
    if (list) {
      list.innerHTML = (post.comments || []).map(c => `
        <div class="comment-item">
          <div class="comment-avatar">👤</div>
          <div class="comment-content">
            <span class="comment-author">${c.author || 'زائر'}</span>
            <span class="comment-date">${timeAgo(c.date)}</span>
            <p>${c.text}</p>
          </div>
        </div>
      `).join('');
    }
    if (count) count.textContent = `(${post.comments ? post.comments.length : 0})`;
  } catch (e) {}
}

// ---------- دوال مساعدة ----------
function getVisitorId() {
  let id = localStorage.getItem('visitorId');
  if (!id) {
    id = generateId();
    localStorage.setItem('visitorId', id);
  }
  return id;
}

function copyPostLink(postId) {
  const url = `${window.location.origin}${window.location.pathname}?post=${postId}`;
  navigator.clipboard.writeText(url).then(() => alert('✅ تم نسخ الرابط'));
  closeAllMenus();
}

async function sharePost(postId) {
  const url = `${window.location.origin}${window.location.pathname}?post=${postId}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'مقال من ALSHANFRICC', url }); } catch (e) {}
  } else {
    copyPostLink(postId);
  }
}

function openPost(postId) {
  const url = `${window.location.origin}${window.location.pathname}?post=${postId}`;
  window.open(url, '_blank');
}

function saveForLater(postId) {
  let saved = JSON.parse(localStorage.getItem('savedPosts') || '[]');
  if (saved.includes(postId)) {
    saved = saved.filter(id => id !== postId);
    alert('🔖 تمت إزالة المقال من المحفوظات');
  } else {
    saved.push(postId);
    alert('🔖 تم حفظ المقال للقراءة لاحقاً');
  }
  localStorage.setItem('savedPosts', JSON.stringify(saved));
  closeAllMenus();
}

function reportPost(postId) {
  alert('🚩 تم استلام بلاغك وسيتم مراجعته.');
  closeAllMenus();
}

function translatePost(postId) {
  const url = `${window.location.origin}${window.location.pathname}?post=${postId}`;
  window.open(`https://translate.google.com/translate?sl=ar&tl=en&u=${encodeURIComponent(url)}`, '_blank');
}

function togglePostMenu(event, postId) {
  event.stopPropagation();
  closeAllMenus();
  const menu = document.getElementById(`menu-${postId}`);
  if (menu) menu.style.display = 'block';
}

function closeAllMenus() {
  document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
}
document.addEventListener('click', () => closeAllMenus());

// ---------- البحث ----------
function searchPosts(query) {
  currentSearchQuery = query.trim();
  loadPosts(false);
}

// ---------- التمرير اللانهائي ----------
function setupInfiniteScroll() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !isLoadingPosts && !allPostsLoaded) {
        loadPosts(true);
      }
    });
  }, { rootMargin: '200px' });

  setInterval(() => {
    const cards = document.querySelectorAll('.post-card');
    if (cards.length > 0) {
      observer.observe(cards[cards.length - 1]);
    }
  }, 1000);
}
setupInfiniteScroll();

console.log("✅ ملف body.js تم تحميله بنجاح");
