// Firebase & Firestore 初始化與資料存取
// 遵循 Lego Method：從 Firestore 載入 Lesson、Timeline、Review 資料

const FIRESTORE_JS_VERSION = 'debug-8';
// #region agent log
fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
        sessionId:'debug-session',
        runId:'baseline',
        hypothesisId:'H14',
        location:'assets/js/firestore.js:module',
        message:'Firestore module loaded',
        data:{version:FIRESTORE_JS_VERSION},
        timestamp:Date.now()
    })
}).catch(()=>{});
// #endregion
window.__firestoreVersion = FIRESTORE_JS_VERSION;

class FirestoreService {
    constructor() {
        this.db = null;
        this.auth = null;
        this.initialized = false;
    }

    // 初始化 Firebase
    async init() {
        try {
            // Firebase 配置（從 Firebase Console 取得）
            const firebaseConfig = {
                apiKey: "AIzaSyBIJ0YDcX438Tq0G05qpvIANiolTrNM8Ds",
                authDomain: "bct-lego.firebaseapp.com",
                projectId: "bct-lego",
                storageBucket: "bct-lego.firebasestorage.app",
                messagingSenderId: "205694748282",
                appId: "1:205694748282:web:9a8e9a196b2d1829bdddc3",
                measurementId: "G-1CBF9H64WN"
            };

            // 初始化 Firebase
            if (!firebase.apps || firebase.apps.length === 0) {
                firebase.initializeApp(firebaseConfig);
            }
            this.db = firebase.firestore();
            this.auth = firebase.auth();

            // Anonymous sign-in (required for Firestore rules: request.auth != null)
            // This ensures both lesson pages and review pages can access data
            if (!this.auth.currentUser || !this.auth.currentUser.isAnonymous) {
                try {
                    await this.auth.signInAnonymously();
                    // Wait for auth state to settle
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('Auth timeout')), 5000);
                        const unsub = this.auth.onAuthStateChanged((user) => {
                            if (user && user.isAnonymous) {
                                clearTimeout(timeout);
                                unsub();
                                resolve(user);
                            }
                        }, (err) => {
                            clearTimeout(timeout);
                            unsub();
                            reject(err);
                        });
                    });
                } catch (authError) {
                    console.warn('Anonymous sign-in failed (non-critical for read-only operations):', authError);
                    // Don't throw - some pages might work without auth if rules allow
                }
            }

            this.initialized = true;
            console.log('✅ Firebase initialized successfully');
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    sessionId:'debug-session',
                    runId:'baseline',
                    hypothesisId:'H1',
                    location:'assets/js/firestore.js:init',
                    message:'Firebase initialized',
                    data:{projectId:firebaseConfig.projectId, storageBucket:firebaseConfig.storageBucket, initialized:this.initialized, version:FIRESTORE_JS_VERSION},
                    timestamp:Date.now()
                })
            }).catch(()=>{});
            // #endregion
            return true;
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    sessionId:'debug-session',
                    runId:'baseline',
                    hypothesisId:'H1',
                    location:'assets/js/firestore.js:init',
                    message:'Firebase init failed',
                    data:{message:error?.message || 'unknown', stack: (error?.stack||'').slice(0,200)},
                    timestamp:Date.now()
                })
            }).catch(()=>{});
            // #endregion
            return false;
        }
    }

    // ==================== LESSON 資料存取 ====================

    /**
     * 取得單一課程的基本資訊
     * @param {string} lessonId - 課程 ID（例如："lesson1"）
     * @returns {Object} 課程資料
     */
    async getLesson(lessonId, classId = null) {
        try {
            const resolved = await this.getLessonRef(lessonId, classId);
            const doc = resolved.doc;
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    sessionId:'debug-session',
                    runId:'baseline',
                    hypothesisId:'H5',
                    location:'assets/js/firestore.js:getLesson',
                    message:'Lesson doc resolved',
                    data:{lessonId, classId, source:resolved.source, exists:doc.exists},
                    timestamp:Date.now()
                })
            }).catch(()=>{});
            // #endregion

            if (!doc.exists) {
                console.warn(`Lesson ${lessonId} not found`);
                return null;
            }

            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            console.error('Error getting lesson:', error);
            return null;
        }
    }

    /**
     * 取得課程的 Vocabulary 子集合
     * @param {string} lessonId - 課程 ID
     * @returns {Array} 單字陣列，按 order 排序
     */
    async getVocabulary(lessonId, classId = null) {
        try {
            const resolved = await this.getLessonRef(lessonId, classId);
            const snapshot = await resolved.ref
                .collection('vocabulary')
                .orderBy('order', 'asc')
                .get();

            const vocabulary = [];
            snapshot.forEach(doc => {
                vocabulary.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return vocabulary;
        } catch (error) {
            console.error('Error getting vocabulary:', error);
            return [];
        }
    }

    /**
     * 取得課程的 Dialogue 子集合
     * @param {string} lessonId - 課程 ID
     * @returns {Array} 對話陣列
     */
    async getDialogue(lessonId, classId = null) {
        try {
            const resolved = await this.getLessonRef(lessonId, classId);
            const snapshot = await resolved.ref
                .collection('dialogue')
                .orderBy('order', 'asc')
                .get();

            const dialogue = [];
            snapshot.forEach(doc => {
                dialogue.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return dialogue;
        } catch (error) {
            console.error('Error getting dialogue:', error);
            return [];
        }
    }

    /**
     * 取得課程的 Reading 子集合
     * @param {string} lessonId - 課程 ID
     * @returns {Array} 閱讀內容陣列
     */
    async getReading(lessonId, classId = null) {
        try {
            const resolved = await this.getLessonRef(lessonId, classId);
            const snapshot = await resolved.ref
                .collection('reading')
                .orderBy('order', 'asc')
                .get();

            const reading = [];
            snapshot.forEach(doc => {
                reading.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return reading;
        } catch (error) {
            console.error('Error getting reading:', error);
            return [];
        }
    }

    /**
     * 取得完整課程資料（包含所有子集合）
     * @param {string} lessonId - 課程 ID
     * @returns {Object} 完整課程資料
     */
    async getFullLesson(lessonId, classId = null) {
        try {
            const defaultClassId = window?.BCT_COURSE_CONFIG?.defaultClassId;
            const resolved = await this.getLessonRef(lessonId, classId);
            const doc = resolved.doc;
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    sessionId:'debug-session',
                    runId:'baseline',
                    hypothesisId:'H6',
                    location:'assets/js/firestore.js:getFullLesson',
                    message:'Resolve lesson ref',
                    data:{lessonId, classId, source:resolved.source, exists:doc.exists, version:FIRESTORE_JS_VERSION},
                    timestamp:Date.now()
                })
            }).catch(()=>{});
            // #endregion
            if (!doc.exists) {
                return null;
            }

            const [vocabulary, dialogue, reading] = await Promise.all([
                resolved.ref.collection('vocabulary').orderBy('order', 'asc').get(),
                resolved.ref.collection('dialogue').orderBy('order', 'asc').get(),
                resolved.ref.collection('reading').orderBy('order', 'asc').get()
            ]);

            const vocabArr = [];
            vocabulary.forEach(doc => vocabArr.push({ id: doc.id, ...doc.data() }));
            const dialogueArr = [];
            dialogue.forEach(doc => dialogueArr.push({ id: doc.id, ...doc.data() }));
            const readingArr = [];
            reading.forEach(doc => readingArr.push({ id: doc.id, ...doc.data() }));
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    sessionId:'debug-session',
                    runId:'baseline',
                    hypothesisId:'H12',
                    location:'assets/js/firestore.js:getFullLesson',
                    message:'Collections counts',
                    data:{
                        lessonId,
                        classId,
                        source:resolved.source,
                        vocabCount:vocabArr.length,
                        dialogueCount:dialogueArr.length,
                        readingCount:readingArr.length
                    },
                    timestamp:Date.now()
                })
            }).catch(()=>{});
            // #endregion
            if (classId && classId === defaultClassId && resolved.source === 'courses') {
                const legacyRef = this.db.collection('lessons').doc(lessonId);
                const [legacyVocabSnap, legacyDialogueSnap, legacyReadingSnap] = await Promise.all([
                    legacyRef.collection('vocabulary').orderBy('order', 'asc').get(),
                    legacyRef.collection('dialogue').orderBy('order', 'asc').get(),
                    legacyRef.collection('reading').orderBy('order', 'asc').get()
                ]);
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({
                        sessionId:'debug-session',
                        runId:'baseline',
                        hypothesisId:'H12',
                        location:'assets/js/firestore.js:getFullLesson',
                        message:'Legacy collections counts',
                        data:{
                            lessonId,
                            classId,
                            legacyVocab:legacyVocabSnap.size,
                            legacyDialogue:legacyDialogueSnap.size,
                            legacyReading:legacyReadingSnap.size
                        },
                        timestamp:Date.now()
                    })
                }).catch(()=>{});
                // #endregion

                const legacyVocabArr = [];
                legacyVocabSnap.forEach(doc => legacyVocabArr.push({ id: doc.id, ...doc.data() }));
                const legacyDialogueArr = [];
                legacyDialogueSnap.forEach(doc => legacyDialogueArr.push({ id: doc.id, ...doc.data() }));
                const legacyReadingArr = [];
                legacyReadingSnap.forEach(doc => legacyReadingArr.push({ id: doc.id, ...doc.data() }));

                const useLegacyVocab = vocabArr.length === 0 && legacyVocabArr.length > 0;
                const useLegacyDialogue = dialogueArr.length === 0 && legacyDialogueArr.length > 0;
                const useLegacyReading = readingArr.length === 0 && legacyReadingArr.length > 0;
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({
                        sessionId:'debug-session',
                        runId:'baseline',
                        hypothesisId:'H13',
                        location:'assets/js/firestore.js:getFullLesson',
                        message:'Fallback evaluation',
                        data:{
                            lessonId,
                            classId,
                            vocabCount:vocabArr.length,
                            dialogueCount:dialogueArr.length,
                            readingCount:readingArr.length,
                            legacyVocab:legacyVocabArr.length,
                            legacyDialogue:legacyDialogueArr.length,
                            legacyReading:legacyReadingArr.length,
                            useLegacyVocab,
                            useLegacyDialogue,
                            useLegacyReading
                        },
                        timestamp:Date.now()
                    })
                }).catch(()=>{});
                // #endregion

                if (useLegacyVocab) {
                    vocabArr.splice(0, vocabArr.length, ...legacyVocabArr);
                }
                if (useLegacyDialogue) {
                    dialogueArr.splice(0, dialogueArr.length, ...legacyDialogueArr);
                }
                if (useLegacyReading) {
                    readingArr.splice(0, readingArr.length, ...legacyReadingArr);
                }
            }

            return {
                id: doc.id,
                ...doc.data(),
                vocabulary: vocabArr,
                dialogue: dialogueArr,
                reading: readingArr
            };
        } catch (error) {
            console.error('Error getting full lesson:', error);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    sessionId:'debug-session',
                    runId:'baseline',
                    hypothesisId:'H12',
                    location:'assets/js/firestore.js:getFullLesson',
                    message:'getFullLesson error',
                    data:{message:error?.message || 'unknown', stack:(error?.stack||'').slice(0,200)},
                    timestamp:Date.now()
                })
            }).catch(()=>{});
            // #endregion
            return null;
        }
    }

    async getLessonRef(lessonId, classId = null) {
        const defaultClassId = window?.BCT_COURSE_CONFIG?.defaultClassId;
        if (classId) {
            const courseRef = this.db
                .collection('courses')
                .doc(classId)
                .collection('lessons')
                .doc(lessonId);
            const courseDoc = await courseRef.get();
            if (courseDoc.exists) {
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({
                        sessionId:'debug-session',
                        runId:'baseline',
                        hypothesisId:'H5',
                        location:'assets/js/firestore.js:getLessonRef',
                        message:'Resolved to courses path',
                        data:{lessonId, classId, defaultClassId, exists:true},
                        timestamp:Date.now()
                    })
                }).catch(()=>{});
                // #endregion
                return { ref: courseRef, doc: courseDoc, source: 'courses' };
            }
            if (classId !== defaultClassId) {
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({
                        sessionId:'debug-session',
                        runId:'baseline',
                        hypothesisId:'H5',
                        location:'assets/js/firestore.js:getLessonRef',
                        message:'Courses path empty for non-default class',
                        data:{lessonId, classId, defaultClassId, exists:false},
                        timestamp:Date.now()
                    })
                }).catch(()=>{});
                // #endregion
                return { ref: courseRef, doc: courseDoc, source: 'courses' };
            }
        }

        const legacyRef = this.db.collection('lessons').doc(lessonId);
        const legacyDoc = await legacyRef.get();
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'H5',
                location:'assets/js/firestore.js:getLessonRef',
                message:'Resolved to legacy lessons path',
                data:{lessonId, classId, defaultClassId, exists:legacyDoc.exists},
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion
        return { ref: legacyRef, doc: legacyDoc, source: 'lessons' };
    }

    // ==================== TIMELINE 資料存取 ====================

    /**
     * 取得所有 Timeline 項目（課堂補充）
     * @param {string} lessonRef - 可選：過濾特定課程的補充內容
     * @returns {Array} Timeline 項目陣列
     */
    async getTimeline(lessonRef = null) {
        try {
            let query = this.db.collection('timeline').orderBy('date', 'desc');

            // 如果指定課程，只取該課的補充
            if (lessonRef) {
                query = query.where('lessonRef', '==', lessonRef);
            }

            const snapshot = await query.get();
            const timeline = [];

            snapshot.forEach(doc => {
                timeline.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return timeline;
        } catch (error) {
            console.error('Error getting timeline:', error);
            return [];
        }
    }

    /**
     * 新增 Timeline 項目（老師用）
     * @param {Object} data - Timeline 資料
     * @returns {string} 新文件的 ID
     */
    async addTimelineItem(data) {
        try {
            const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const docId = `${timestamp}_${Date.now()}`;

            const timelineData = {
                scope: 'timeline',
                date: timestamp,
                createdBy: 'teacher',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                ...data
            };

            await this.db.collection('timeline').doc(docId).set(timelineData);
            console.log('✅ Timeline item added:', docId);
            return docId;
        } catch (error) {
            console.error('Error adding timeline item:', error);
            return null;
        }
    }

    /**
     * 取得特定日期 Timeline 的所有 Components
     * @param {string} timelineDocId - Timeline 文件 ID (例如: "timeline-2026-01-14")
     * @returns {Array} Components 陣列
     */
    async getTimelineComponents(timelineDocId) {
        try {
            const snapshot = await this.db
                .collection('timeline')
                .doc(timelineDocId)
                .collection('components')
                .get();

            const components = [];
            snapshot.forEach(doc => {
                components.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return components;
        } catch (error) {
            console.error('Error getting timeline components:', error);
            return [];
        }
    }

    /**
     * 取得特定日期 Timeline 的所有 Vocabulary
     * @param {string} timelineDocId - Timeline 文件 ID
     * @returns {Array} Vocabulary 陣列
     */
    async getTimelineVocabulary(timelineDocId) {
        try {
            const snapshot = await this.db
                .collection('timeline')
                .doc(timelineDocId)
                .collection('vocabulary')
                .get();

            const vocabulary = [];
            snapshot.forEach(doc => {
                vocabulary.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return vocabulary;
        } catch (error) {
            console.error('Error getting timeline vocabulary:', error);
            return [];
        }
    }

    /**
     * 取得所有 Timeline 文件 IDs
     * @returns {Array} Timeline document IDs 陣列
     */
    async getAllTimelineDocIds() {
        try {
            const snapshot = await this.db.collection('timeline').get();
            const docIds = [];

            snapshot.forEach(doc => {
                docIds.push(doc.id);
            });

            return docIds;
        } catch (error) {
            console.error('Error getting timeline doc IDs:', error);
            return [];
        }
    }

    /**
     * 取得特定課程的所有 Timeline 補充內容（從所有 timeline 文檔的子集合中過濾）
     * @param {string} lessonId - 課程 ID（例如："lesson1"）
     * @returns {Array} Timeline 項目陣列，包含 components、vocabulary、notes
     */
    async getTimelineForLesson(lessonId, cohort = 'taigen-a', level = 'btc1') {
        try {
            console.log('🔍 开始读取 Timeline 数据：', { lessonId, cohort, level });
            const timelineItems = [];

            // 1. 载入 Components（所有班共用）- 客户端过滤
            try {
                console.log('📦 读取 Components：timeline/' + level + '/components/');
                const compSnapshot = await this.db
                    .collection('timeline')
                    .doc(level)
                    .collection('components')
                    .get();  // 不用 where，全部读取

                console.log('📦 Components 原始数量：', compSnapshot.size);
                console.log('🔴 測試：這是新版本的代碼！如果看到這行，說明新代碼已載入');
                let lessonMatchCount = 0;
                let publishedCount = 0;
                let unpublishedCount = 0;
                compSnapshot.forEach(doc => {
                    const data = doc.data();
                    // 客户端过滤（去除空格）
                    if ((data.lesson || '').trim() === lessonId.trim()) {
                        lessonMatchCount++;
                        // 只載入已發布的部件（明確檢查 is_published === true）
                        console.log(`🔍 檢查部件: ${doc.id}, lesson=${data.lesson}, is_published=${data.is_published} (type: ${typeof data.is_published})`);
                        if (data.is_published === true) {
                            publishedCount++;
                            timelineItems.push({
                                id: doc.id,
                                type: 'component',
                                ...data
                            });
                        } else {
                            unpublishedCount++;
                            console.log(`⏭️ 跳過未發布部件: ${doc.id}, is_published=${data.is_published} (type: ${typeof data.is_published}), published=${data.published}`);
                        }
                    }
                });
                console.log(`📦 過濾統計: 匹配課次=${lessonMatchCount}, 已發布=${publishedCount}, 未發布=${unpublishedCount}`);
                console.log('📦 过滤后 Components（已發布）：', timelineItems.filter(i => i.type === 'component').length, '个');
            } catch (error) {
                console.warn('❌ Error loading timeline components:', error);
            }

            // 2. 载入 Vocab（分班）- 客户端过滤
            try {
                console.log('📝 读取 Vocab：timeline/' + level + '/vocab/' + cohort + '/items/');
                const vocabSnapshot = await this.db
                    .collection('timeline')
                    .doc(level)
                    .collection('vocab')
                    .doc(cohort)
                    .collection('items')
                    .get();  // 不用 where，全部读取

                console.log('📝 Vocab 原始数量：', vocabSnapshot.size);
                vocabSnapshot.forEach(doc => {
                    const data = doc.data();
                    // 客户端过滤（去除空格）
                    if ((data.lesson || '').trim() === lessonId.trim()) {
                        timelineItems.push({
                            id: doc.id,
                            type: 'vocab',
                            cohort: cohort,
                            ...data
                        });
                    }
                });
                console.log('📝 过滤后 Vocab：', timelineItems.filter(i => i.type === 'vocab').length, '个');
            } catch (error) {
                console.warn('❌ Error loading timeline vocab:', error);
            }

            // 3. 载入 Notes（分班）- 客户端过滤，按 order 排序
            try {
                console.log('📒 读取 Notes：timeline/' + level + '/notes/' + cohort + '/items/');
                let notesSnapshot;
                try {
                    notesSnapshot = await this.db
                        .collection('timeline')
                        .doc(level)
                        .collection('notes')
                        .doc(cohort)
                        .collection('items')
                        .orderBy('order', 'asc')
                        .get();
                } catch (orderError) {
                    console.warn('⚠️ Notes orderBy 失敗，改用無排序查詢:', orderError);
                    notesSnapshot = await this.db
                        .collection('timeline')
                        .doc(level)
                        .collection('notes')
                        .doc(cohort)
                        .collection('items')
                        .get();
                }

                console.log('📒 Notes 原始数量：', notesSnapshot.size);
                const notesForLesson = [];
                notesSnapshot.forEach(doc => {
                    const data = doc.data();
                    // 去除首尾空格后再比较
                    const dataLesson = (data.lesson || '').trim();
                    const targetLesson = lessonId.trim();
                    console.log('📒 检查 Note：', doc.id, 'lesson:', data.lesson, '(trimmed:', dataLesson + ')', '目标:', targetLesson);
                    // 客户端过滤
                    if (dataLesson === targetLesson) {
                        console.log('✅ 匹配！添加到结果');
                        const noteItem = {
                            id: doc.id,
                            cohort: cohort,
                            order: data.order !== undefined ? data.order : 999999,
                            ...data,
                            // 強制標記為 note，避免 Firestore 文件內的 type 欄位覆蓋導致無法在 lesson-template-b.html 顯示。
                            type: 'note'
                        };
                        console.log('✅ Note 对象：', noteItem);
                        notesForLesson.push(noteItem);
                    } else {
                        console.log('❌ 不匹配，跳过');
                    }
                });
                
                // 按 order 排序（如果 orderBy 失敗，需要手動排序）
                notesForLesson.sort((a, b) => {
                    if (a.order !== b.order) {
                        return a.order - b.order;
                    }
                    return a.id.localeCompare(b.id);
                });
                
                timelineItems.push(...notesForLesson);
                console.log('📒 过滤后 Notes：', timelineItems.filter(i => i.type === 'note').length, '个');
                console.log('📒 timelineItems 完整内容：', timelineItems);
            } catch (error) {
                console.warn('❌ Error loading timeline notes:', error);
            }

            // 4. 載入目標字（Target Characters）- 只載入已發布的
            try {
                console.log('🎯 [目標字載入] 開始讀取目標字，路徑：timeline/' + level + '/target-characters/');
                console.log('🎯 [目標字載入] 參數：', { level, lessonId, cohort });
                
                const targetCharsSnapshot = await this.db
                    .collection('timeline')
                    .doc(level)
                    .collection('target-characters')
                    .get();

                console.log('🎯 [目標字載入] 原始數量：', targetCharsSnapshot.size);
                
                let targetCharCount = 0;
                targetCharsSnapshot.forEach(doc => {
                    const data = doc.data();
                    // 客戶端過濾（去除空格）
                    if ((data.lesson || '').trim() === lessonId.trim()) {
                        // 只載入已發布的目標字
                        if (data.is_published !== false) {
                            timelineItems.push({
                                id: doc.id,
                                type: 'target-character', // 目標字類型
                                ...data
                            });
                            targetCharCount++;
                        }
                    }
                });
                
                console.log('🎯 [目標字載入] 已發布目標字：', targetCharCount, '个');
            } catch (error) {
                console.warn('❌ Error loading target characters:', error);
            }

            timelineItems.sort((a, b) => {
                const dateA = a.date || a.timestamp || '';
                const dateB = b.date || b.timestamp || '';
                return dateB.localeCompare(dateA);
            });

            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    sessionId:'debug-session',
                    runId:'timeline-read',
                    hypothesisId:'T-read',
                    location:'assets/js/firestore.js:getTimelineForLesson',
                    message:'Timeline query result',
                    data:{lessonId, cohort, level, count: timelineItems.length},
                    timestamp:Date.now()
                })
            }).catch(()=>{});
            // #endregion

            return timelineItems;
        } catch (error) {
            console.error('Error getting timeline for lesson:', error);
            fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    sessionId:'debug-session',
                    runId:'timeline-read',
                    hypothesisId:'T-read',
                    location:'assets/js/firestore.js:getTimelineForLesson',
                    message:'Timeline query error',
                    data:{lessonId, cohort, level, message:error?.message||'unknown'},
                    timestamp:Date.now()
                })
            }).catch(()=>{});
            return [];
        }
    }

    // ==================== REVIEW 資料存取 ====================

    /**
     * 取得所有可複習的項目（從 Lesson + Timeline 抓取 review: true 的項目）
     * @param {string} lessonId - 可選：只抓取特定課程的複習項目
     * @returns {Array} 複習項目陣列
     */
    async getReviewItems(lessonId = null) {
        try {
            const reviewItems = [];

            // 1. 從 Lessons 抓取 vocabulary（review: true）
            let lessonsQuery = this.db.collection('lessons');
            if (lessonId) {
                lessonsQuery = lessonsQuery.where(firebase.firestore.FieldPath.documentId(), '==', lessonId);
            }

            const lessons = await lessonsQuery.get();

            for (const lessonDoc of lessons.docs) {
                const vocabSnapshot = await lessonDoc.ref
                    .collection('vocabulary')
                    .where('review', '==', true)
                    .get();

                vocabSnapshot.forEach(vocabDoc => {
                    reviewItems.push({
                        id: vocabDoc.id,
                        sourceType: 'lesson',
                        sourceRef: `lessons/${lessonDoc.id}/vocabulary/${vocabDoc.id}`,
                        lessonId: lessonDoc.id,
                        ...vocabDoc.data()
                    });
                });
            }

            // 2. 從 Timeline 抓取 review: true 的項目
            const timelineSnapshot = await this.db
                .collection('timeline')
                .where('review', '==', true)
                .get();

            timelineSnapshot.forEach(doc => {
                reviewItems.push({
                    id: doc.id,
                    sourceType: 'timeline',
                    sourceRef: `timeline/${doc.id}`,
                    ...doc.data()
                });
            });

            console.log(`📚 Found ${reviewItems.length} review items`);
            return reviewItems;
        } catch (error) {
            console.error('Error getting review items:', error);
            return [];
        }
    }

    // ==================== 輔助方法 ====================

    /**
     * 取得所有課程列表
     * @returns {Array} 課程列表
     */
    async getAllLessons() {
        try {
            const snapshot = await this.db
                .collection('lessons')
                .orderBy('order', 'asc')
                .get();

            const lessons = [];
            snapshot.forEach(doc => {
                lessons.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return lessons;
        } catch (error) {
            console.error('Error getting all lessons:', error);
            return [];
        }
    }

    /**
     * 檢查 Firestore 連接狀態
     * @returns {boolean} 是否已連接
     */
    isConnected() {
        return this.initialized && this.db !== null;
    }
}

// 創建全域 Firestore 服務實例
const firestoreService = new FirestoreService();
