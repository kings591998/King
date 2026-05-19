// ============================================================
//  ملف: firebase-config.js
//  الوظيفة: إعداد الاتصال بقاعدة بيانات Firebase وجميع خدماتها
//  يتم استدعاؤه في جميع صفحات الموقع (الواجهة ولوحة التحكم)
// ============================================================

// بيانات اعتماد مشروع Firebase (خاصة بك)
const firebaseConfig = {
  apiKey: "AIzaSyDjgVxvtPXTn1tpr4IxOK3wOW4r3gzB1VU",
  authDomain: "awj-website-29f16.firebaseapp.com",
  projectId: "awj-website-29f16",
  storageBucket: "awj-website-29f16.firebasestorage.app",
  messagingSenderId: "406747568578",
  appId: "1:406747568578:web:741821d3c60df0011b5e5b",
  measurementId: "G-DFB0GYH7LN"
};

// تهيئة تطبيق Firebase
firebase.initializeApp(firebaseConfig);

// إنشاء كائنات للخدمات التي سنستخدمها
const db = firebase.firestore();       // قاعدة البيانات (Firestore)
const auth = firebase.auth();          // المصادقة (تسجيل الدخول)
const storage = firebase.storage();    // التخزين السحابي (رفع الصور والملفات)

// إعدادات إضافية لـ Firestore لتحسين الأداء
db.settings({
  merge: true,
  ignoreUndefinedProperties: true
});

// رسالة تأكيد في وحدة التحكم (للتأكد من التحميل)
console.log("✅ Firebase تم تهيئته بنجاح - Firestore جاهز");
