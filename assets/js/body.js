// ============================================================
//  ملف: body.js (مُدمَج - كامل ومُحدّث)
//  الوظيفة: عرض المقالات والتفاعلات (إعجاب، تعليق، مشاركة،
//         تلخيص AI، بحث داخل المقال، تمييز، مصادر، وسام،
//         تعديل/حذف التعليقات، شريط تقدم، نافذة الكاتب،
//         فلترة الكاتب، ترجمة ديناميكية، تصفح)
//  يعتمد على: firebase-config.js, utils.js, header.js
// ============================================================

let lastVisiblePost = null;
let isLoadingPosts = false;
let allPostsLoaded = false;
let activeCommentPostId = null;
let currentSearchQuery = '';
let currentAuthorId = null;
let currentPage = 1;
const postsPerPage = 20;
let totalPostsCount = 0;

// ---------- تحميل المقالات ----------
async function loadPosts(page = 1) {
  if (isLoadingPosts) return;
  isLoadingPosts = true;
  currentPage = page;

  const feed = document.getElementById('posts-feed');
  if (!feed) { isLoadingPosts = false; return; }

  feed.innerHTML = '<div class="loading-spinner">⏳ جاري تحميل المقالات...</div>';

  try {
    let baseQuery = db.collection('posts');
    if (window.currentCategoryId) baseQuery = baseQuery.where('category', '==', window.currentCategoryId);
    if (window.currentSubcategoryId) baseQuery = baseQuery.where('subcategory', '==', window.currentSubcategoryId);
    if (currentAuthorId) baseQuery = baseQuery.where('authorId', '==', currentAuthorId);
    if (currentSearchQuery) {
      baseQuery = baseQuery.where('title', '>=', currentSearchQuery)
                           .where('title', '<=', currentSearchQuery + '\uf8ff');
    }

    const countSnapshot = await baseQuery.get();
    totalPostsCount = countSnapshot.size;
    const totalPages = Math.ceil(totalPostsCount / postsPerPage);

    let query = baseQuery.orderBy('date', 'desc').limit(postsPerPage);
    if (page > 1) {
      const previousSnapshot = await baseQuery.orderBy('date', 'desc').limit((page - 1) * postsPerPage).get();
      if (previousSnapshot.docs.length > 0) {
        const lastVisible = previousSnapshot.docs[previousSnapshot.docs.length - 1];
        query = query.startAfter(lastVisible);
      }
    }

    const snapshot = await query.get();
    feed.innerHTML = '';

    if (snapshot.empty) {
      feed.innerHTML = `<div class="no-posts"><div class="no-posts-icon">📝</div><h3>لا توجد مقالات</h3><p>لم يتم العثور على أي مقال في هذه الصفحة.</p></div>`;
      isLoadingPosts = false;
      return;
    }

    const settings = await getAllSettingsCached();
    const titleFont = settings.titleFont || 'Playfair Display';
    const bodyFont = settings.bodyFont || 'Cairo';

    for (const doc of snapshot.docs) {
      const post = doc.data(); post.id = doc.id;
      const card = await createPostCard(post, titleFont, bodyFont);
      feed.appendChild(card);
    }

    addPaginationControls(page, totalPages);

  } catch (error) {
    console.error('خطأ في تحميل المقالات:', error);
    feed.innerHTML = '<p class="error-message">⚠️ حدث خطأ أثناء تحميل المقالات.</p>';
  }

  isLoadingPosts = false;
}

// ---------- إنشاء بطاقة المقال ----------
async function createPostCard(post, titleFont = 'Playfair Display', bodyFont = 'Cairo') {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.id = `post-${post.id}`;

  const categoryName = post.categoryName || '';
  const subcategoryName = post.subcategoryName || '';
  const categoryId = post.category || '';
  const subcategoryId = post.subcategory || '';

  let breadcrumbHTML = '';
  if (categoryName) {
    breadcrumbHTML += `<span class="breadcrumb-item" onclick="filterByCategory('${categoryId}')" title="عرض كل مقالات ${categoryName}">${categoryName}</span>`;
    if (subcategoryName) {
      breadcrumbHTML += ` <span class="breadcrumb-sep">›</span> `;
      breadcrumbHTML += `<span class="breadcrumb-item" onclick="filterBySubcategory('${categoryId}', '${subcategoryId}')" title="عرض مقالات ${subcategoryName}">${subcategoryName}</span>`;
    }
  }

  let contentHTML = '';
  if (post.content && Array.isArray(post.content)) {
    post.content.forEach(item => {
      switch (item.type) {
        case 'subtitle': contentHTML += `<h4 class="post-subtitle">${item.value}</h4>`; break;
        case 'images':
          if (item.images) item.images.forEach(img => {
            const src = img.dataUrl || img;
            contentHTML += `<img src="${src}" class="post-image" loading="lazy" onerror="this.style.display='none'">`;
          });
          break;
        case 'code': contentHTML += `<pre class="code-block"><code class="language-${item.language}">${escapeHTML(item.value)}</code></pre>`; break;
        case 'link': contentHTML += `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="post-link">🔗 ${item.text || item.url}</a>`; break;
        case 'markdown': contentHTML += `<div class="markdown-content">${parseMarkdown(item.value)}</div>`; break;
        case 'html': contentHTML += `<div class="html-content">${item.value}</div>`; break;
        case 'quote':
          contentHTML += `<blockquote class="elegant-quote"><div class="quote-icon">❝</div><p>${item.value}</p>${item.author ? `<cite>— ${item.author}</cite>` : ''}</blockquote>`;
          break;
        case 'summary':
          contentHTML += `<div class="article-summary-box"><div class="summary-badge">📋 ملخص المقال</div><p>${item.value}</p></div>`;
          break;
        default: contentHTML += `<p>${item.value}</p>`;
      }
    });
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = contentHTML;
  tempDiv.querySelectorAll('a').forEach(link => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    link.classList.add('post-link');
  });
  contentHTML = tempDiv.innerHTML;

  const authorName = post.author || 'مجهول';
  const authorId = post.authorId || '';
  const postDate = post.date ? timeAgo(post.date) : '';

  const articleText = (post.content && Array.isArray(post.content))
    ? post.content.map(item => item.value || '').join(' ').substring(0, 500)
    : '';
  const isArabic = /[\u0600-\u06FF]/.test(articleText);
  const translateDirection = isArabic ? 'ar2en' : 'en2ar';
  const translateLabel = isArabic ? 'EN' : 'AR';
  const translateTitle = isArabic ? 'ترجم إلى الإنجليزية' : 'ترجم إلى العربية';

  card.innerHTML = `
    <div class="post-header">
        ${breadcrumbHTML ? `<div class="post-breadcrumb">${breadcrumbHTML}</div>` : ''}
        <div class="post-options">
            <button class="icon-btn dropdown-btn" onclick="togglePostMenu(event, '${post.id}')">⋯</button>
            <div class="dropdown-menu" id="menu-${post.id}" style="display:none;">
                <div class="dropdown-item" onclick="copyPostLink('${post.id}')">🔗 نسخ الرابط</div>
                <div class="dropdown-item" onclick="saveForLater('${post.id}')">🔖 قراءة لاحقاً</div>
                <div class="dropdown-item ai-summary-btn" onclick="generateSummary('${post.id}')">🤖 تلخيص بالذكاء الاصطناعي</div>
                <div class="dropdown-item search-in-post-btn" onclick="searchInPost('${post.id}')">🔎 بحث داخل المقال</div>
                <div class="dropdown-item highlight-text-btn" onclick="highlightSelection('${post.id}')">🖍️ تمييز النص</div>
                <div class="dropdown-item show-references-btn" onclick="showReferences('${post.id}')">📊 عرض المصادر والمراجع</div>
                <div class="dropdown-item" onclick="filterByAuthor('${authorId}')">📄 مقالات الكاتب</div>
                <div class="dropdown-item" onclick="toggleFontSize('${post.id}')">🔤 تكبير/تصغير الخط</div>
                <div class="dropdown-item" onclick="reportPost('${post.id}')">🚩 إبلاغ</div>
            </div>
        </div>
    </div>

    <div class="reading-progress-container" id="progress-container-${post.id}">
        <div class="reading-progress-bar" id="progress-${post.id}"></div>
    </div>

    <div class="post-body" style="font-family: '${bodyFont}', sans-serif;">
        <h3 class="post-title" style="font-family: '${titleFont}', serif; cursor:pointer;" onclick="expandPost('${post.id}')">${post.title}</h3>
        <div class="post-meta">
            ${authorName !== 'مجهول' ? `<span class="post-author-name" onclick="showAuthorBio('${authorId}', '${post.id}')">✍️ ${authorName}</span>` : `<span class="post-author">✍️ ${authorName}</span>`}
            <span class="post-date">🕒 ${postDate}</span>
            ${post.views ? `<span class="post-views">👁️ ${post.views} مشاهدة</span>` : ''}
        </div>
        <div class="post-content">${contentHTML}</div>
        <span class="read-more-btn" onclick="expandPost('${post.id}')">📖 اقرأ المزيد</span>
        <span class="collapse-btn" style="display:none;" onclick="expandPost('${post.id}')">▲ طي المقال</span>
    </div>

    <div class="ai-summary-box" id="summary-${post.id}" style="display:none;">
        <div class="ai-summary-header"><span>🤖 ملخص الذكاء الاصطناعي</span><button class="ai-summary-close" onclick="closeSummary('${post.id}')">✕</button></div>
        <div class="ai-summary-content" id="summary-content-${post.id}">⏳ جارٍ التوليد...</div>
    </div>

    <div class="search-in-post-box" id="searchBox-${post.id}" style="display:none;">
        <input type="text" class="search-in-post-input" id="searchInput-${post.id}" placeholder="ابحث في المقال..." oninput="highlightInPost('${post.id}')">
        <span class="search-in-post-close" onclick="closeSearchInPost('${post.id}')">✕</span>
        <span class="search-in-post-count" id="searchCount-${post.id}"></span>
    </div>

    <div class="post-actions">
        <span class="action-circle like-btn ${(post.likedBy || []).includes(getVisitorId()) ? 'liked' : ''}" onclick="toggleLike('${post.id}')" title="أعجبني">
            ${(post.likedBy || []).includes(getVisitorId()) ? '❤️' : '🤍'}
            <span class="action-badge">${post.likes || 0}</span>
        </span>
        <span class="action-circle comment-btn" onclick="toggleComments('${post.id}')" title="تعليق">
            💬 <span class="action-badge">${post.comments ? post.comments.length : 0}</span>
        </span>
        <span class="action-circle translate-circle" onclick="translatePost('${post.id}', '${translateDirection}')" title="${translateTitle}">${translateLabel}</span>
        <span class="action-circle share-general-circle" onclick="generalShare('${post.id}')" title="مشاركة">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>
        </span>
        <span class="action-circle copy-circle" onclick="copyPostLink('${post.id}')" title="نسخ الرابط">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </span>
        <span class="action-circle save-circle ${isPostSaved(post.id) ? 'saved' : ''}" onclick="toggleSavePost('${post.id}')" title="حفظ">
            ${isPostSaved(post.id) ? '🔖' : '🏷️'}
        </span>
    </div>

    <div class="comments-section" id="comments-${post.id}" style="display:none;">
        <div class="comments-list" id="comments-list-${post.id}">
            ${(post.comments || []).map(comment => renderCommentHTML(comment, post.id)).join('')}
        </div>
        <div class="comment-form">
            <input type="text" class="comment-input" id="comment-input-${post.id}" placeholder="اكتب تعليقاً..." onkeypress="if(event.key==='Enter') addComment('${post.id}')">
            <button class="comment-submit-btn" onclick="addComment('${post.id}')">نشر</button>
        </div>
    </div>
  `;

  return card;
}

// ---------- توسيع/طي البطاقة ----------
function expandPost(postId) {
  const postBody = document.querySelector(`#post-${postId} .post-body`);
  const readMoreBtn = document.querySelector(`#post-${postId} .read-more-btn`);
  const collapseBtn = document.querySelector(`#post-${postId} .collapse-btn`);
  if (postBody) {
    if (postBody.classList.contains('expanded')) {
      postBody.classList.remove('expanded');
      if (readMoreBtn) readMoreBtn.style.display = 'inline-block';
      if (collapseBtn) collapseBtn.style.display = 'none';
    } else {
      postBody.classList.add('expanded');
      if (readMoreBtn) readMoreBtn.style.display = 'none';
      if (collapseBtn) collapseBtn.style.display = 'inline-flex';
      const card = document.getElementById(`post-${postId}`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

// ---------- الإعجاب ----------
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
        likedBy: firebase.firestore.FieldValue.arrayRemove(userFingerprint)
      });
    } else {
      await postRef.update({
        likes: (post.likes || 0) + 1,
        likedBy: firebase.firestore.FieldValue.arrayUnion(userFingerprint)
      });
      addInteraction('like');
    }
    updatePostCardLikes(postId);
  } catch (error) { console.error('خطأ في تحديث الإعجاب:', error); }
}

async function updatePostCardLikes(postId) {
  try {
    const postDoc = await db.collection('posts').doc(postId).get();
    if (!postDoc.exists) return;
    const post = postDoc.data();
    const likeBtn = document.querySelector(`#post-${postId} .like-btn`);
    const badge = document.querySelector(`#post-${postId} .like-btn .action-badge`);
    if (likeBtn) {
      const hasLiked = (post.likedBy || []).includes(getVisitorId());
      likeBtn.classList.toggle('liked', hasLiked);
      likeBtn.innerHTML = (hasLiked ? '❤️' : '🤍') + (badge ? '' : `<span class="action-badge">${post.likes || 0}</span>`);
    }
    if (badge) badge.textContent = post.likes || 0;
  } catch (e) {}
}

// ---------- التعليقات ----------
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
      id: generateId(), author: 'زائر',
      text: sanitizeHTML(text), date: new Date().toISOString(),
      visitorId: getVisitorId()
    };
    await postRef.update({ comments: firebase.firestore.FieldValue.arrayUnion(newComment) });
    addInteraction('comment');
    await refreshComments(postId);
    input.value = '';
  } catch (error) { console.error('خطأ في إضافة التعليق:', error); }
}

async function refreshComments(postId) {
  try {
    const postDoc = await db.collection('posts').doc(postId).get();
    if (!postDoc.exists) return;
    const post = postDoc.data();
    const list = document.getElementById(`comments-list-${postId}`);
    if (list) list.innerHTML = (post.comments || []).map(c => renderCommentHTML(c, postId)).join('');
    const count = document.querySelector(`#post-${postId} .comment-btn .action-badge`);
    if (count) count.textContent = (post.comments || []).length;
  } catch (e) {}
}

function renderCommentHTML(comment, postId) {
    const myId = getVisitorId();
    const isMyComment = comment.visitorId && comment.visitorId === myId;
    let actionsHTML = '';
    if (isMyComment) {
        actionsHTML = `<span class="comment-actions">
            <button class="comment-edit-btn" onclick="editComment('${postId}', '${comment.id}')" title="تعديل">✏️</button>
            <button class="comment-delete-btn" onclick="deleteComment('${postId}', '${comment.id}')" title="حذف">🗑️</button>
        </span>`;
    }
    return `<div class="comment-item">
        <div class="comment-avatar">👤</div>
        <div class="comment-content">
            <span class="comment-author">${comment.author || 'زائر'} ${actionsHTML}</span>
            <span class="comment-date">${timeAgo(comment.date)}</span>
            <p id="comment-text-${comment.id}">${comment.text}</p>
        </div>
    </div>`;
}

async function deleteComment(postId, commentId) {
    if (!confirm('هل أنت متأكد من حذف تعليقك؟')) return;
    const postRef = db.collection('posts').doc(postId);
    const doc = await postRef.get();
    if (!doc.exists) return;
    const post = doc.data();
    const updatedComments = (post.comments || []).filter(c => c.id !== commentId);
    await postRef.update({ comments: updatedComments });
    await refreshComments(postId);
}

async function editComment(postId, commentId) {
    const newText = prompt('عدّل تعليقك:', '');
    if (newText === null || newText.trim() === '') return;
    const postRef = db.collection('posts').doc(postId);
    const doc = await postRef.get();
    if (!doc.exists) return;
    const post = doc.data();
    const updatedComments = (post.comments || []).map(c => {
        if (c.id === commentId) { c.text = newText.trim(); c.edited = true; }
        return c;
    });
    await postRef.update({ comments: updatedComments });
    await refreshComments(postId);
}

// ---------- المشاركة والنسخ والحفظ ----------
function getVisitorId() {
  let id = localStorage.getItem('visitorId');
  if (!id) { id = generateId(); localStorage.setItem('visitorId', id); }
  return id;
}

function copyPostLink(postId) {
  const url = `${window.location.origin}${window.location.pathname}?post=${postId}`;
  navigator.clipboard.writeText(url).then(() => showToast('✅ تم نسخ الرابط'));
  closeAllMenus();
}

async function generalShare(postId) {
  const url = `${window.location.origin}${window.location.pathname}?post=${postId}`;
  const card = document.getElementById(`post-${postId}`);
  const titleEl = card?.querySelector('.post-title');
  const title = titleEl ? titleEl.textContent.trim() : 'مقال من ALSHANFRICC';
  if (navigator.share) {
    try { await navigator.share({ title, url }); } catch (err) {}
  } else {
    await navigator.clipboard.writeText(url);
    showToast('✅ تم نسخ الرابط للمشاركة');
  }
}

function saveForLater(postId) {
  let saved = JSON.parse(localStorage.getItem('savedPosts') || '[]');
  if (saved.includes(postId)) { saved = saved.filter(id => id !== postId); }
  else { saved.push(postId); }
  localStorage.setItem('savedPosts', JSON.stringify(saved));
  closeAllMenus();
}

function isPostSaved(postId) {
  const saved = JSON.parse(localStorage.getItem('savedPosts') || '[]');
  return saved.includes(postId);
}

function toggleSavePost(postId) {
  let saved = JSON.parse(localStorage.getItem('savedPosts') || '[]');
  if (saved.includes(postId)) { saved = saved.filter(id => id !== postId); }
  else { saved.push(postId); }
  localStorage.setItem('savedPosts', JSON.stringify(saved));
  const btn = document.querySelector(`#post-${postId} .save-circle`);
  if (btn) {
    btn.classList.toggle('saved', saved.includes(postId));
    btn.innerHTML = saved.includes(postId) ? '🔖' : '🏷️';
  }
}

// ---------- ترجمة ----------
function translatePost(postId, direction) {
  const url = `${window.location.origin}${window.location.pathname}?post=${postId}`;
  const sl = direction === 'ar2en' ? 'ar' : 'en';
  const tl = direction === 'ar2en' ? 'en' : 'ar';
  window.open(`https://translate.google.com/translate?sl=${sl}&tl=${tl}&u=${encodeURIComponent(url)}`, '_blank');
}

function reportPost(postId) { showToast('🚩 تم استلام بلاغك'); closeAllMenus(); }
function togglePostMenu(event, postId) { event.stopPropagation(); closeAllMenus(); const menu = document.getElementById(`menu-${postId}`); if (menu) menu.style.display = 'block'; }
function closeAllMenus() { document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none'); }
document.addEventListener('click', () => closeAllMenus());

// ---------- البحث داخل المقال ----------
function searchInPost(postId) {
  document.querySelectorAll('.search-in-post-box').forEach(b => b.style.display = 'none');
  clearHighlights(postId);
  const box = document.getElementById(`searchBox-${postId}`);
  if (box) { box.style.display = 'flex'; document.getElementById(`searchInput-${postId}`).focus(); }
}
function closeSearchInPost(postId) {
  const box = document.getElementById(`searchBox-${postId}`);
  if (box) box.style.display = 'none';
  clearHighlights(postId);
}
function highlightInPost(postId) {
  const input = document.getElementById(`searchInput-${postId}`);
  const countSpan = document.getElementById(`searchCount-${postId}`);
  const postBody = document.querySelector(`#post-${postId} .post-content`);
  if (!input || !postBody) return;
  clearHighlights(postId);
  const query = input.value.trim();
  if (!query) { if (countSpan) countSpan.textContent = ''; return; }
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  let matchCount = 0;
  function highlightText(node) {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (regex.test(text)) {
        const frag = document.createDocumentFragment();
        let lastIndex = 0, match;
        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIndex) frag.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
          const mark = document.createElement('mark'); mark.className = 'search-highlight'; mark.textContent = match[0];
          frag.appendChild(mark); matchCount++;
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.substring(lastIndex)));
        node.parentNode.replaceChild(frag, node);
      }
    } else if (node.nodeType === 1 && !['SCRIPT', 'STYLE', 'MARK'].includes(node.tagName)) {
      node.childNodes.forEach(highlightText);
    }
  }
  highlightText(postBody);
  if (countSpan) countSpan.textContent = matchCount > 0 ? `(${matchCount} تطابق)` : '(لا توجد نتائج)';
}
function clearHighlights(postId) {
  const postBody = document.querySelector(`#post-${postId} .post-content`);
  if (!postBody) return;
  postBody.querySelectorAll('mark.search-highlight').forEach(mark => {
    mark.parentNode.replaceChild(document.createTextNode(mark.textContent), mark);
    mark.parentNode.normalize();
  });
}

// ---------- تمييز النص ----------
function getHighlights(postId) { return JSON.parse(localStorage.getItem('highlights') || '{}')[postId] || []; }
function saveHighlights(postId, highlights) {
  const all = JSON.parse(localStorage.getItem('highlights') || '{}');
  all[postId] = highlights; localStorage.setItem('highlights', JSON.stringify(all));
}
function highlightSelection(postId) {
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed) return alert('الرجاء تحديد نص أولاً.');
  const range = selection.getRangeAt(0);
  const postBody = document.querySelector(`#post-${postId} .post-content`);
  if (!postBody || !postBody.contains(range.commonAncestorContainer)) return alert('يجب أن يكون النص داخل المقال.');
  const selectedText = range.toString().trim();
  if (!selectedText) return;
  let mark;
  try {
    mark = document.createElement('mark'); mark.className = 'user-highlight';
    mark.style.backgroundColor = '#ffeb3b'; mark.dataset.postId = postId; mark.dataset.highlightText = selectedText;
    range.surroundContents(mark);
  } catch (e) {
    const span = document.createElement('span'); span.className = 'user-highlight';
    span.style.backgroundColor = '#ffeb3b'; span.dataset.postId = postId; span.dataset.highlightText = selectedText;
    range.surroundContents(span);
    mark = span;
  }
  selection.removeAllRanges();
  const highlights = getHighlights(postId); highlights.push({ text: selectedText }); saveHighlights(postId, highlights);
  if (mark) {
    mark.addEventListener('click', function(e) {
      if (confirm('إلغاء تمييز هذا النص؟')) {
        this.parentNode.replaceChild(document.createTextNode(this.textContent), this);
        this.parentNode.normalize();
        saveHighlights(postId, getHighlights(postId).filter(h => h.text !== selectedText));
      }
    });
  }
  closeAllMenus();
}

// ---------- المصادر والمراجع ----------
function showReferences(postId) {
  document.querySelectorAll('.references-box').forEach(b => b.remove());
  const postBody = document.querySelector(`#post-${postId} .post-body`);
  if (!postBody) return;
  const links = postBody.querySelectorAll('a[href]');
  const urls = Array.from(links).map(l => ({ href: l.href, text: l.textContent.trim() || l.href })).filter(i => i.href && !i.href.startsWith('javascript'));
  if (urls.length === 0) return alert('لا توجد روابط.');
  const unique = [...new Map(urls.map(i => [i.href, i])).values()];
  let html = '<ul class="references-list">';
  unique.forEach(u => html += `<li><a href="${u.href}" target="_blank">🔗 ${u.text}</a></li>`);
  html += '</ul>';
  const box = document.createElement('div'); box.className = 'references-box';
  box.innerHTML = `<div class="references-header"><span>📊 المصادر (${unique.length})</span><button class="references-close" onclick="this.parentElement.parentElement.remove()">✕</button></div>${html}`;
  postBody.appendChild(box);
}

// ---------- وسام القارئ ----------
function getBadgeLevel(interactions) {
  if (interactions >= 100) return { name: 'أسطورة', icon: '👑' };
  if (interactions >= 50) return { name: 'خبير', icon: '⭐' };
  if (interactions >= 20) return { name: 'نشط', icon: '🔥' };
  if (interactions >= 5) return { name: 'مشارك', icon: '💬' };
  return null;
}
function addInteraction(type) {
  const key = `interactions_${getVisitorId()}`;
  let interactions = JSON.parse(localStorage.getItem(key) || '{"comments":0,"likes":0}');
  if (type === 'comment') interactions.comments++;
  else if (type === 'like') interactions.likes++;
  localStorage.setItem(key, JSON.stringify(interactions));
}

// ---------- تلخيص AI ----------
async function generateSummary(postId) {
  const box = document.getElementById(`summary-${postId}`);
  const content = document.getElementById(`summary-content-${postId}`);
  if (!box || !content) return;
  box.style.display = 'block'; content.innerHTML = '⏳ جارٍ التوليد...';
  const postBody = document.querySelector(`#post-${postId} .post-content`);
  if (!postBody) { content.innerHTML = '❌ لم يتم العثور على محتوى.'; return; }
  const fullText = postBody.innerText.trim().substring(0, 3000);
  if (fullText.length < 50) { content.innerHTML = '⚠️ المقال قصير جداً.'; return; }
  let apiKey = '';
  try {
    const keysSnap = await db.collection('api_keys').where('type', '==', 'ai').limit(1).get();
    if (!keysSnap.empty) apiKey = keysSnap.docs[0].data().value;
  } catch (e) {}
  if (!apiKey) apiKey = await getSetting('openai_api_key', '');
  if (!apiKey) { content.innerHTML = '⚠️ لم يتم تعيين مفتاح API.'; return; }
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [{ role: 'system', content: 'لخّص هذا المقال العربي في 3 جمل فقط.' }, { role: 'user', content: fullText }], max_tokens: 200, temperature: 0.5 })
    });
    const data = await res.json();
    content.innerHTML = data.error ? `❌ ${data.error.message}` : data.choices[0].message.content;
  } catch (e) { content.innerHTML = '❌ فشل الاتصال.'; }
}
function closeSummary(postId) { const box = document.getElementById(`summary-${postId}`); if (box) box.style.display = 'none'; }

// ---------- نافذة الكاتب ----------
async function showAuthorBio(authorId, postId) {
  if (!authorId) return;
  document.querySelectorAll('.author-popup').forEach(p => p.remove());
  let authorName = '', image = '', bio = '';
  try {
    const doc = await db.collection('authors').doc(authorId).get();
    if (doc.exists) { authorName = doc.data().name || ''; image = doc.data().image || ''; bio = doc.data().bio || 'لا توجد نبذة.'; }
  } catch (e) { return; }
  const card = document.getElementById(`post-${postId}`);
  if (!card) return;
  const btn = card.querySelector('.post-author-name');
  if (!btn) return;
  const popup = document.createElement('div');
  popup.className = 'author-popup horizontal';
  popup.innerHTML = `
    <div class="author-popup-card-horizontal">
      <span class="author-popup-close" onclick="this.parentElement.parentElement.remove()">✕</span>
      <div class="author-popup-avatar-horizontal">
        ${image ? `<img src="${image}" alt="${authorName}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;">` : '<div style="width:70px;height:70px;border-radius:50%;background:#f0f0f0;display:flex;align-items:center;justify-content:center;font-size:2rem;">👤</div>'}
      </div>
      <div class="author-popup-info">
        <h4>${authorName}</h4>
        <p>${bio}</p>
      </div>
    </div>`;
  const rect = btn.getBoundingClientRect();
  popup.style.position = 'absolute'; popup.style.zIndex = '2000';
  popup.style.top = (rect.bottom + window.scrollY + 5) + 'px';
  popup.style.left = (rect.left + window.scrollX) + 'px';
  document.body.appendChild(popup);
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', closeHandler); }
    };
    document.addEventListener('click', closeHandler);
  }, 10);
}

// ---------- فلترة الكاتب ----------
function filterByAuthor(authorId) {
  if (!authorId) return;
  currentAuthorId = authorId;
  window.currentCategoryId = null;
  window.currentSubcategoryId = null;
  currentSearchQuery = '';
  currentPage = 1;
  loadPosts(1);
  closeAllMenus();
}

function clearAuthorFilter() { currentAuthorId = null; clearFilter(); }

function clearFilter() {
  currentAuthorId = null;
  currentSearchQuery = '';
  currentPage = 1;
  window.currentCategoryId = null;
  window.currentSubcategoryId = null;
  loadPosts(1);
}

// ---------- فلترة التبويبات ----------
function filterByCategory(catId) {
  currentPage = 1;
  if (typeof handleTabClick === 'function') handleTabClick(new MouseEvent('click'), catId);
  else { window.currentCategoryId = catId; window.currentSubcategoryId = null; loadPosts(1); }
}
function filterBySubcategory(catId, subId) {
  currentPage = 1;
  if (typeof handleTabClick === 'function') { handleTabClick(new MouseEvent('click'), catId); setTimeout(() => { if (typeof selectSubcategory === 'function') selectSubcategory(subId); }, 100); }
  else { window.currentCategoryId = catId; window.currentSubcategoryId = subId; loadPosts(1); }
}
function searchPosts(query) { currentSearchQuery = query.trim(); currentPage = 1; loadPosts(1); }

// ---------- تكبير/تصغير الخط ----------
function toggleFontSize(postId) {
    const postContent = document.querySelector(`#post-${postId} .post-content`);
    if (!postContent) return;
    const currentSize = postContent.style.fontSize;
    if (!currentSize || currentSize === '0.95rem') {
        postContent.style.fontSize = '1.25rem';
        postContent.style.lineHeight = '2';
        showToast('🔤 حجم الخط: كبير', 'info', 1500);
    } else if (currentSize === '1.25rem') {
        postContent.style.fontSize = '1.5rem';
        postContent.style.lineHeight = '2.2';
        showToast('🔤 حجم الخط: كبير جداً', 'info', 1500);
    } else {
        postContent.style.fontSize = '0.95rem';
        postContent.style.lineHeight = '1.8';
        showToast('🔤 حجم الخط: عادي', 'info', 1500);
    }
    closeAllMenus();
}

// ---------- شريط تقدم القراءة ----------
function updateReadingProgress(postId) {
    const postBody = document.querySelector(`#post-${postId} .post-body`);
    const progressBar = document.getElementById(`progress-${postId}`);
    const container = document.getElementById(`progress-container-${postId}`);
    if (!postBody || !progressBar) return;
    const scrollTop = postBody.scrollTop;
    const scrollHeight = postBody.scrollHeight - postBody.clientHeight;
    if (scrollHeight <= 0) { if (container) container.style.display = 'none'; return; }
    if (container) container.style.display = 'block';
    const progress = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
    progressBar.style.width = progress + '%';
    if (progress >= 99) { progressBar.style.background = 'var(--primary)'; }
    else { progressBar.style.background = 'linear-gradient(90deg, var(--primary-light), var(--primary))'; }
}
function setupReadingProgressObservers() {
    document.addEventListener('scroll', function(e) {
        const postBody = e.target.closest('.post-body.expanded');
        if (postBody) {
            const postId = postBody.closest('.post-card')?.id?.replace('post-', '');
            if (postId) updateReadingProgress(postId);
        }
    }, true);
}
setupReadingProgressObservers();

// ---------- أزرار التصفح ----------
function addPaginationControls(page, totalPages) {
  const oldPagination = document.getElementById('pagination-container');
  if (oldPagination) oldPagination.remove();
  if (totalPages <= 1) return;
  const feed = document.getElementById('posts-feed');
  const pagination = document.createElement('div');
  pagination.id = 'pagination-container';
  pagination.className = 'pagination-container';
  let html = '';
  html += `<button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="loadPosts(${page - 1})">◀ السابق</button>`;
  html += '<div class="pagination-numbers">';
  for (let i = 1; i <= totalPages; i++) {
    if (i === page) html += `<span class="pagination-number active">${i}</span>`;
    else if (Math.abs(i - page) <= 2 || i === 1 || i === totalPages) html += `<span class="pagination-number" onclick="loadPosts(${i})">${i}</span>`;
    else if (Math.abs(i - page) === 3) html += `<span class="pagination-dots">...</span>`;
  }
  html += '</div>';
  html += `<button class="pagination-btn" ${page === totalPages ? 'disabled' : ''} onclick="loadPosts(${page + 1})">التالي ▶</button>`;
  html += `<span class="pagination-info">صفحة ${page} من ${totalPages} (${totalPostsCount} مقال)</span>`;
  pagination.innerHTML = html;
  feed.appendChild(pagination);
}

console.log("✅ body.js تم تحميله بنجاح");
