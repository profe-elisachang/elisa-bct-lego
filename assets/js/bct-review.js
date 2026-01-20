// BCT Review System
// Integrates Lesson vocabulary + Timeline supplementary content
// Three review modes: Character / Pinyin-hint / Pinyin

// Firebase Configuration (bct-lego project)
const firebaseConfig = {
    apiKey: "AIzaSyBIJ0YDcX438Tq0G05qpvIANiolTrNM8Ds",
    authDomain: "bct-lego.firebaseapp.com",
    projectId: "bct-lego",
    storageBucket: "bct-lego.firebasestorage.app",
    messagingSenderId: "205694748282",
    appId: "1:205694748282:web:9a8e9a196b2d1829bdddc3",
    measurementId: "G-1CBF9H64WN"
};

// Initialize Firebase
if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// BCT Review System Class
class BCTReviewSystem {
    constructor() {
        this.componentVocab = [];
        this.characterVocab = [];
        this.lessonVocab = [];
        this.userProgress = {};
        this.currentTab = 'components';
        this.currentLevel = 'btc1';  // BCT Level tracking
        this.reviewMode = 'pinyin-hint';
        this.reviewQueue = [];
        this.currentIndex = 0;
        this.currentUser = null; // Firebase auth user (anonymous)
        this.deviceCode = null;
        this.isCardFlipped = false;
        this.studentId = null;   // master student doc id
        this.studentName = '';
    }

    async init() {
        try {
            // Wait for cohort guard if present (ensures active cohort is enforced)
            if (window.__cohortGuardReady && typeof window.__cohortGuardReady.then === 'function') {
                try { await window.__cohortGuardReady; } catch (_) {}
            }

            // 从 URL 读取参数
            const urlParams = new URLSearchParams(window.location.search);
            const urlLevel = urlParams.get('level');
            const urlCohort = urlParams.get('cohort');
            
            // 优先使用 URL 参数，其次 localStorage，最后默认值
            if (urlLevel) {
                this.currentLevel = urlLevel;
                // 保存到 localStorage 供下次使用
                localStorage.setItem('bct-current-level', urlLevel);
            } else {
                // 从 localStorage 读取上次的选择
                this.currentLevel = localStorage.getItem('bct-current-level') || 'btc1';
            }
            
            // Cohort is enforced by cohort-guard (active-only). Keep localStorage consistent.
            const enforcedCohort = window.BCT_ACTIVE_COHORT || urlCohort || localStorage.getItem('bct-cohort') || 'taigen-a';
            localStorage.setItem('bct-cohort', enforcedCohort);
            const currentCohort = enforcedCohort;
            console.log(`🎯 BCT Review 初始化：Level=${this.currentLevel}, Cohort=${currentCohort}`);

            // Anonymous auth (fixed uid per browser profile)
            await auth.signInAnonymously();
            await new Promise((resolve, reject) => {
                const unsub = auth.onAuthStateChanged((user) => {
                    if (!user) return;
                    unsub && unsub();
                    resolve(user);
                }, reject);
            });
            this.currentUser = auth.currentUser;
            if (!this.currentUser?.uid) throw new Error('Anonymous auth uid missing');
            this.deviceCode = this.currentUser.uid.substring(0, 6).toUpperCase();
            document.getElementById('deviceCode').textContent = this.deviceCode;

            await this.resolveOrLinkStudent(currentCohort);
            document.getElementById('studentName').textContent = this.studentName || 'Not linked';

            await this.loadAllVocabulary();
            await this.loadUserProgress();

            this.renderLessonSelector();
            this.setupEventListeners();

            document.getElementById('loadingContainer').classList.add('hidden');
            document.getElementById('mainContent').classList.remove('hidden');
        } catch (error) {
            console.error('Initialization failed:', error);
            alert('Failed to initialize: ' + error.message);
        }
    }

    // -------------------- Student master model --------------------
    progressDocRef() {
        const level = this.currentLevel || 'btc1';
        if (!this.studentId) return null;
        return db.collection('students').doc(this.studentId).collection('progress').doc(level);
    }

    async resolveOrLinkStudent(cohortId) {
        // 1) If this browser already linked, use it
        const anonUid = this.currentUser?.uid;
        if (!anonUid) throw new Error('resolveOrLinkStudent: missing anon uid');

        const linkRef = db.collection('device_links').doc(anonUid);
        const linkSnap = await linkRef.get();
        if (linkSnap.exists) {
            const link = linkSnap.data() || {};
            this.studentId = link.studentId || null;
            if (this.studentId) {
                const stu = await db.collection('students').doc(this.studentId).get();
                if (stu.exists) {
                    const data = stu.data() || {};
                    this.studentName = data.displayName || '';
                    // keep lastSeenAt fresh
                    await db.collection('students').doc(this.studentId).set({
                        lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
                        cohort: cohortId
                    }, { merge: true });
                    return;
                }
            }
            // Broken link: continue to re-link
            this.studentId = null;
        }

        // 2) Not linked: prompt Name + PIN to link to an existing student master
        const { name, pin } = await this.promptNameAndPin();
        const trimmedName = (name || '').trim();
        if (!trimmedName) throw new Error('Name is required');

        // Search candidates by displayName; small cohort so client-side filtering is OK.
        const candSnap = await db.collection('students').where('displayName', '==', trimmedName).get();
        const candidates = [];
        candSnap.forEach((doc) => {
            const data = doc.data() || {};
            // Only allow enforced cohort (frozen cohorts blocked upstream anyway)
            if ((data.cohort || cohortId) !== cohortId) return;
            candidates.push({ id: doc.id, data });
        });

        const pinHash = (studentId) => this.hashPinForStudent(pin, studentId);
        let matchId = null;
        for (const c of candidates) {
            const expected = c.data.pinHash || '';
            if (!expected) continue;
            const got = await pinHash(c.id);
            if (got === expected) {
                matchId = c.id;
                break;
            }
        }

        if (!matchId) {
            // No match: create new student master
            const newRef = db.collection('students').doc();
            const newId = newRef.id;
            const newHash = await pinHash(newId);
            await newRef.set({
                displayName: trimmedName,
                cohort: cohortId,
                pinHash: newHash,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastSeenAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            matchId = newId;
        }

        // Link this browser uid -> studentId
        await linkRef.set({
            studentId: matchId,
            cohort: cohortId,
            linkedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        this.studentId = matchId;
        this.studentName = trimmedName;
    }

    async promptNameAndPin() {
        const modal = document.getElementById('studentLinkModal');
        const nameEl = document.getElementById('studentNameInput');
        const pinEl = document.getElementById('studentPinInput');
        const okBtn = document.getElementById('studentLinkConfirmBtn');
        const cancelBtn = document.getElementById('studentLinkCancelBtn');
        if (!modal || !nameEl || !pinEl || !okBtn || !cancelBtn) {
            throw new Error('Student link modal elements missing');
        }

        modal.style.display = 'flex';
        nameEl.focus();

        return await new Promise((resolve, reject) => {
            const cleanup = () => {
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                modal.style.display = 'none';
            };
            const onOk = () => {
                const name = String(nameEl.value || '').trim();
                const pin = String(pinEl.value || '').trim();
                if (!/^\d{4}$/.test(pin)) {
                    alert('PIN must be 4 digits.');
                    pinEl.focus();
                    return;
                }
                cleanup();
                resolve({ name, pin });
            };
            const onCancel = () => {
                cleanup();
                reject(new Error('Student linking cancelled'));
            };
            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
        });
    }

    async hashPinForStudent(pin, studentId) {
        // pinHash = SHA-256(`${pin}:${studentId}`), stored as hex string.
        const text = `${pin}:${studentId}`;
        const enc = new TextEncoder().encode(text);
        const digest = await crypto.subtle.digest('SHA-256', enc);
        const bytes = Array.from(new Uint8Array(digest));
        return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async loadAllVocabulary() {
        console.time('Loading vocabulary');

        // 不使用 cache，避免新增後資料鎖定；如需可在此處改回
        localStorage.removeItem('bct_vocab_cache');

        // Load from Firestore
        this.componentVocab = [];
        this.characterVocab = [];
        this.lessonVocab = [];

        // 1. Load from Lessons (1-20) under courses/[currentLevel]
        for (let i = 1; i <= 20; i++) {
            try {
                const lessonId = `lesson${i}`;
                const vocabSnap = await db.collection('courses')
                    .doc(this.currentLevel)
                    .collection('lessons')
                    .doc(lessonId)
                    .collection('vocabulary')
                    .get();

                vocabSnap.forEach(doc => {
                    const data = {
                        ...doc.data(),
                        source: 'lesson',
                        lesson: lessonId,
                        firestoreId: doc.id
                    };

                    if (data.type === 'component') {
                        this.componentVocab.push(data);
                    } else if (data.type === 'vocab' || !data.type) {
                        this.lessonVocab.push(data);
                    } else {
                        this.characterVocab.push(data);
                    }
                });
            } catch (error) {
                console.log(`Lesson ${i} not found, skipping...`);
            }
        }

        // 2. Load from Timeline (新数据结构)
        try {
            // 获取学生班级
            const studentCohort = window.BCT_ACTIVE_COHORT || localStorage.getItem('bct-cohort') || 'taigen-a';
            console.log(`Loading timeline data for ${this.currentLevel}, cohort: ${studentCohort}`);
            
            // Load components (所有班共用)
            try {
                const compSnap = await db.collection(`timeline/${this.currentLevel}/components`).get();
                console.log(`Found ${compSnap.size} timeline components for ${this.currentLevel}`);
                
                compSnap.forEach(doc => {
                    const data = doc.data();
                    this.componentVocab.push({
                        ...data,
                        source: 'timeline',
                        lesson: data.lesson || 'unknown',
                        firestoreId: doc.id
                    });
                });
            } catch (error) {
                console.log(`No timeline components for ${this.currentLevel}:`, error.message);
            }

            // Load vocabulary (只加载学生自己班级的)
            try {
                const vocabSnap = await db.collection(`timeline/${this.currentLevel}/vocab/${studentCohort}/items`).get();
                console.log(`Found ${vocabSnap.size} timeline vocab for ${this.currentLevel}/${studentCohort}`);
                
                vocabSnap.forEach(doc => {
                    const data = doc.data();
                    const vocabItem = {
                        ...data,
                        source: 'timeline',
                        cohort: studentCohort,
                        lesson: data.lesson || 'unknown',
                        firestoreId: doc.id
                    };
                    // 根据 type 分类
                    if (data.type === 'component') {
                        this.componentVocab.push(vocabItem);
                    } else if (data.type === 'vocab' || !data.type) {
                        this.lessonVocab.push(vocabItem);
                    } else {
                        this.characterVocab.push(vocabItem);
                    }
                });
            } catch (error) {
                console.log(`No timeline vocab for ${this.currentLevel}/${studentCohort}:`, error.message);
            }
        } catch (error) {
            console.error('Error loading timeline:', error);
        }

        console.log(`Loaded ${this.componentVocab.length} components, ${this.characterVocab.length} characters`);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'H3',
                location:'assets/js/bct-review.js:loadAllVocabulary',
                message:'Vocabulary loaded',
                data:{components:this.componentVocab.length, characters:this.characterVocab.length},
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion

        // Save to cache
        localStorage.setItem('bct_vocab_cache', JSON.stringify({
            components: this.componentVocab,
            characters: this.characterVocab,
            lessonsVocab: this.lessonVocab
        }));

        console.timeEnd('Loading vocabulary');
    }

    async loadUserProgress() {
        const ref = this.progressDocRef();
        if (!ref) return;
        try {
            const doc = await ref.get();
            if (doc.exists) {
                const data = doc.data() || {};
                this.userProgress = data.characterProgress || {};
                return;
            }

            // One-time legacy import (old schema: user_progress/{anonUid})
            const legacy = await db.collection('user_progress').doc(this.currentUser.uid).get();
            if (legacy.exists) {
                const legacyData = legacy.data() || {};
                const imported = legacyData.characterProgress || {};
                if (imported && Object.keys(imported).length) {
                    this.userProgress = imported;
                    await ref.set({
                        characterProgress: this.userProgress,
                        lastReview: legacyData.lastReview || new Date().toISOString(),
                        importedFromLegacy: true,
                        importedAt: new Date().toISOString(),
                        deviceCode: this.deviceCode,
                        studentName: this.studentName || ''
                    }, { merge: true });
                }
            }
        } catch (error) {
            console.error('Error loading progress:', error);
        }
    }

    async saveUserProgress() {
        const ref = this.progressDocRef();
        if (!ref) return;
        try {
            await ref.set({
                characterProgress: this.userProgress,
                lastReview: new Date().toISOString(),
                deviceCode: this.deviceCode,
                studentName: this.studentName || ''
            }, { merge: true });
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }

    renderLessonSelector() {
        const grid = document.getElementById('lessonGrid');
        const lessons = [];

        // Get unique lessons
        let currentVocab = [];
        if (this.currentTab === 'components') currentVocab = this.componentVocab;
        else if (this.currentTab === 'characters') currentVocab = this.characterVocab;
        else if (this.currentTab === 'vocab') currentVocab = this.lessonVocab;

        for (let i = 1; i <= 20; i++) {
            const lessonId = `lesson${i}`;
            const chars = currentVocab.filter(c => c.lesson === lessonId);

            // Calculate progress (Easy count / Total)
            let easyCount = 0;
            if (chars.length > 0) {
                easyCount = chars.filter(char => {
                    const progress = this.userProgress[this.getProgressKey(char)];
                    return progress && progress.box === 'easy';
                }).length;
            }
            const progress = chars.length > 0 ? Math.round((easyCount / chars.length) * 100) : 0;

            if (chars.length > 0) {
                lessons.push({
                    id: lessonId,
                    num: i,
                    count: chars.length,
                    progress: progress
                });
            } else {
                lessons.push({
                    id: lessonId,
                    num: i,
                    count: 0,
                    comingSoon: true
                });
            }
        }

        // Also add Timeline entries
        const timelineDates = [...new Set(currentVocab
            .filter(c => c.source === 'timeline')
            .map(c => c.sourceDate))];

        grid.innerHTML = lessons.map(lesson => {
            if (lesson.comingSoon) {
                return `
                    <div class="lesson-card locked" data-lesson="${lesson.id}">
                        <div class="lesson-num">L${lesson.num}</div>
                        <div class="lesson-lock">🔒</div>
                    </div>`;
            }

            const circumference = 2 * Math.PI * 36;
            const offset = circumference - (lesson.progress / 100) * circumference;
            const label = this.currentTab === 'components'
                ? `${lesson.count} comp`
                : this.currentTab === 'characters'
                    ? `${lesson.count} char`
                    : `${lesson.count} vocab`;

            return `
                <div class="lesson-card" data-lesson="${lesson.id}" data-selected="false" onclick="reviewSystem.toggleLesson('${lesson.id}')">
                    <svg class="progress-ring" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="36" class="progress-bg"/>
                        <circle cx="40" cy="40" r="36" class="progress-bar"
                                style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}"/>
                    </svg>
                    <div class="lesson-content">
                        <div class="lesson-num">L${lesson.num}</div>
                            <div class="lesson-progress">${lesson.progress}%</div>
                            <div class="lesson-count">${label}</div>
                    </div>
                </div>`;
        }).join('');

        this.updateSelectedCount();
    }

    toggleLesson(lessonId) {
        const card = document.querySelector(`[data-lesson="${lessonId}"]`);
        if (card.classList.contains('locked')) return;

        const isSelected = card.dataset.selected === 'true';
        card.dataset.selected = !isSelected;

        this.updateSelectedCount();
        this.updateReviewSections();
    }

    getSelectedLessons() {
        const selected = [];
        document.querySelectorAll('.lesson-card[data-selected="true"]').forEach(card => {
            selected.push(card.dataset.lesson);
        });
        return selected;
    }

    getSelectedVocab() {
        const selectedLessons = this.getSelectedLessons();
        let currentVocab = [];
        if (this.currentTab === 'components') currentVocab = this.componentVocab;
        else if (this.currentTab === 'characters') currentVocab = this.characterVocab;
        else if (this.currentTab === 'vocab') currentVocab = this.lessonVocab;

        return currentVocab.filter(vocab => selectedLessons.includes(vocab.lesson));
    }

    // 取得進度用的 key，避免 vocab 與字互相覆蓋
    getProgressKey(vocab) {
        const isVocab = this.currentTab === 'vocab' || vocab.type === 'vocab' || (!vocab.type && vocab.source === 'lesson');
        const base = vocab.character || vocab.firestoreId || vocab.pinyin || vocab.meaning || 'item';
        return isVocab ? `vocab:${vocab.lesson || ''}:${base}` : base;
    }

    updateSelectedCount() {
        const checked = document.querySelectorAll('.lesson-card[data-selected="true"]').length;
        const total = document.querySelectorAll('.lesson-card:not(.locked)').length;
        document.getElementById('selectedCount').textContent = `(${checked}/${total})`;
    }

    updateReviewSections() {
        const selectedLessons = this.getSelectedLessons();
        const reviewModeSection = document.getElementById('reviewModeSection');
        const smartReviewSection = document.getElementById('smartReviewSection');

        if (selectedLessons.length > 0) {
            reviewModeSection.classList.remove('hidden');
            smartReviewSection.classList.remove('hidden');
            this.updateStats();
        } else {
            reviewModeSection.classList.add('hidden');
            smartReviewSection.classList.add('hidden');
        }
    }

    updateStats() {
        const vocab = this.getSelectedVocab();
        const boxes = { forgot: 0, hard: 0, good: 0, easy: 0 };

        vocab.forEach(v => {
            const progress = this.userProgress[this.getProgressKey(v)];
            const box = progress ? progress.box : 'forgot';
            boxes[box]++;
        });

        document.getElementById('forgotCount').textContent = boxes.forgot;
        document.getElementById('hardCount').textContent = boxes.hard;
        document.getElementById('goodCount').textContent = boxes.good;
        document.getElementById('easyCount').textContent = boxes.easy;

        // Update due count
        const dueVocab = this.getDueVocab(vocab);
        document.getElementById('dueCount').textContent = dueVocab.length;
    }

    getDueVocab(vocabulary) {
        const today = new Date().setHours(0, 0, 0, 0);

        return vocabulary.filter(vocab => {
            const progress = this.userProgress[this.getProgressKey(vocab)];
            if (!progress) return true; // New = due

            const lastReviewed = progress.lastReviewed
                ? new Date(progress.lastReviewed).setHours(0, 0, 0, 0)
                : null;
            if (!lastReviewed) return true;

            const daysSince = Math.floor((today - lastReviewed) / (1000 * 60 * 60 * 24));

            switch (progress.box) {
                case 'forgot': return daysSince >= 0; // Daily
                case 'hard': return daysSince >= 1;
                case 'good': return daysSince >= 3;
                case 'easy': return daysSince >= 7;
                default: return true;
            }
        });
    }

    setupEventListeners() {
        // BCT Level switching
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const level = e.currentTarget.dataset.level;
                
                // Update button styles
                document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                // Execute level switch
                await this.switchLevel(level);
            });
        });

        // Tab switching
        document.querySelectorAll('#typeTabSystem .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#typeTabSystem .tab-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.setCurrentTab(e.currentTarget.dataset.tab);
            });
        });

        // Review mode selection
        document.querySelectorAll('input[name="reviewMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.reviewMode = e.target.value;
            });
        });
    }

    setCurrentTab(tab) {
        this.currentTab = tab;
        this.clearSelections();
        this.renderLessonSelector();
        this.updateReviewSections();
    }

    // Switch BCT Level
    async switchLevel(level) {
        // Show loading
        const mainContent = document.getElementById('mainContent');
        const loadingContainer = document.getElementById('loadingContainer');
        mainContent.classList.add('hidden');
        loadingContainer.classList.remove('hidden');
        
        try {
            // 1. Save current selections to localStorage
            this.saveCurrentSelections();
            
            // 2. Update level
            this.currentLevel = level;
            
            // 保存到 localStorage
            localStorage.setItem('bct-current-level', level);
            
            // 更新 URL（保持 cohort 参数）
            const cohort = localStorage.getItem('bct-cohort') || 'taigen-a';
            const newUrl = `${window.location.pathname}?level=${level}&cohort=${cohort}`;
            window.history.pushState({ level, cohort }, '', newUrl);
            
            console.log(`✅ 已切换到 ${level}，URL 已更新`);
            
            // 3. Clear current selections
            this.clearSelections();
            
            // 4. Reload data for this level
            await this.loadAllVocabulary();
            
            // 5. Restore selections for this level
            this.restoreSelections();
            
            // 6. Re-render
            this.renderLessonSelector();
            this.updateReviewSections();
        } finally {
            // Hide loading
            loadingContainer.classList.add('hidden');
            mainContent.classList.remove('hidden');
        }
    }

    // Save current lesson selections
    saveCurrentSelections() {
        const selected = this.getSelectedLessons();
        localStorage.setItem(`${this.currentLevel}-selected`, JSON.stringify(selected));
    }

    // Restore lesson selections
    restoreSelections() {
        const saved = localStorage.getItem(`${this.currentLevel}-selected`);
        if (saved) {
            const lessonIds = JSON.parse(saved);
            // Set after DOM renders
            setTimeout(() => {
                lessonIds.forEach(lessonId => {
                    const card = document.querySelector(`[data-lesson="${lessonId}"]`);
                    if (card && !card.classList.contains('locked')) {
                        card.dataset.selected = 'true';
                    }
                });
                this.updateSelectedCount();
                this.updateReviewSections();
            }, 100);
        }
    }

    // 清空選課選取
    clearSelections() {
        document.querySelectorAll('.lesson-card').forEach(card => {
            card.dataset.selected = 'false';
        });
        this.updateSelectedCount();
        this.updateReviewSections();
    }

    startReview() {
        const vocab = this.getSelectedVocab();
        const dueVocab = this.getDueVocab(vocab);
        const amount = document.getElementById('reviewAmount').value;

        if (dueVocab.length === 0) {
            alert('No items are due for review!');
            return;
        }

        // Get selected amount
        this.reviewQueue = amount === 'all'
            ? dueVocab
            : dueVocab.slice(0, parseInt(amount));

        // Shuffle
        this.shuffleArray(this.reviewQueue);

        // Start review
        this.currentIndex = 0;
        this.showReviewArea();
        this.showCard();
    }

    showReviewArea() {
        // Hide other sections
        document.getElementById('typeTabSystem').style.display = 'none';
        document.querySelector('.lesson-selector').style.display = 'none';
        document.getElementById('reviewModeSection').classList.add('hidden');
        document.getElementById('smartReviewSection').classList.add('hidden');
        document.querySelector('.data-section').style.display = 'none';

        // Show review area
        document.getElementById('reviewArea').classList.remove('hidden');
    }

    showCard() {
        if (this.currentIndex >= this.reviewQueue.length) {
            this.showCompletion();
            return;
        }

        const vocab = this.reviewQueue[this.currentIndex];
        this.isCardFlipped = false;

        // Reset card flip
        document.getElementById('flashcard').classList.remove('flipped');

        // Render based on mode
        this.renderCardFront(vocab);
        this.renderCardBack(vocab);

        // Update progress
        this.updateProgress();
    }

    renderCardFront(vocab) {
        const frontCharacter = document.getElementById('frontCharacter');
        const pinyinToggle = document.getElementById('pinyinToggle');
        const frontPinyin = document.getElementById('frontPinyin');

        if (this.currentTab === 'vocab') {
            // 詞組模式：預設顯示拼音為主，漢字隱藏
            frontCharacter.textContent = vocab.pinyin || vocab.character;
            frontCharacter.classList.add('pinyin-large');
            pinyinToggle.classList.add('hidden');
            frontPinyin.classList.add('hidden');
        } else if (this.reviewMode === 'character') {
            // Character mode: show character only
            frontCharacter.textContent = vocab.character;
            frontCharacter.classList.remove('pinyin-large');
            pinyinToggle.classList.add('hidden');
            frontPinyin.classList.add('hidden');
        } else if (this.reviewMode === 'pinyin-hint') {
            // Pinyin-hint mode: character + optional pinyin
            frontCharacter.textContent = vocab.character;
            frontCharacter.classList.remove('pinyin-large');
            pinyinToggle.classList.remove('hidden');
            pinyinToggle.textContent = '👁️ Show Pinyin';
            frontPinyin.textContent = vocab.pinyin;
            frontPinyin.classList.add('hidden');
        } else if (this.reviewMode === 'pinyin') {
            // Pinyin mode: show pinyin only
            frontCharacter.textContent = vocab.pinyin;
            frontCharacter.classList.add('pinyin-large');
            pinyinToggle.classList.add('hidden');
            frontPinyin.classList.add('hidden');
        }
    }

    renderCardBack(vocab) {
        document.getElementById('backCharacter').textContent = vocab.character || '';
        document.getElementById('backPinyin').textContent = vocab.pinyin || '';
        document.getElementById('backMeaning').textContent = vocab.meaning ||
            `${vocab.english || ''} | ${vocab.spanish || ''}`;

        // Source tag
        const sourceTag = document.getElementById('sourceTag');
        if (vocab.source === 'timeline') {
            sourceTag.textContent = `Timeline ${vocab.sourceDate?.replace('timeline-', '') || ''}`;
            sourceTag.className = 'source-tag timeline';
        } else {
            sourceTag.textContent = `Lesson ${vocab.lesson?.replace('lesson', '') || ''}`;
            sourceTag.className = 'source-tag lesson';
        }

        // Notes
        const notesDiv = document.getElementById('backNotes');
        if (vocab.notes && vocab.notes.trim()) {
            notesDiv.innerHTML = marked.parse(vocab.notes);
            notesDiv.classList.remove('hidden');
        } else {
            notesDiv.classList.add('hidden');
        }
    }

    updateProgress() {
        const total = this.reviewQueue.length;
        const current = this.currentIndex;
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;

        document.getElementById('progressFill').style.width = percent + '%';
        document.getElementById('progressText').textContent = `${current}/${total}`;
    }

    async rateCard(rating) {
        const vocab = this.reviewQueue[this.currentIndex];

        // Update progress
        const key = this.getProgressKey(vocab);
        this.userProgress[key] = {
            character: vocab.character,
            lesson: vocab.lesson,
            box: rating,
            reviews: (this.userProgress[key]?.reviews || 0) + 1,
            lastReviewed: new Date().toISOString()
        };

        // Save to Firestore
        await this.saveUserProgress();

        // Next card
        this.currentIndex++;
        this.showCard();
    }

    showCompletion() {
        document.getElementById('reviewArea').classList.add('hidden');
        document.getElementById('completionMessage').classList.remove('hidden');
        document.getElementById('completionText').textContent =
            `You've reviewed ${this.reviewQueue.length} items`;
    }

    endReview() {
        document.getElementById('reviewArea').classList.add('hidden');
        this.returnToHome();
    }

    returnToHome() {
        document.getElementById('completionMessage').classList.add('hidden');

        // Show all sections
        document.getElementById('typeTabSystem').style.display = 'block';
        document.querySelector('.lesson-selector').style.display = 'block';
        document.querySelector('.data-section').style.display = 'block';

        // Clear selection and refresh
        this.clearAllLessons();
        this.renderLessonSelector();
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

// Global instance
const reviewSystem = new BCTReviewSystem();

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    reviewSystem.init();
});

// Global functions
function selectAllLessons() {
    document.querySelectorAll('.lesson-card:not(.locked)').forEach(card => {
        card.dataset.selected = 'true';
    });
    reviewSystem.updateSelectedCount();
    reviewSystem.updateReviewSections();
}

function clearAllLessons() {
    document.querySelectorAll('.lesson-card').forEach(card => {
        card.dataset.selected = 'false';
    });
    reviewSystem.updateSelectedCount();
    reviewSystem.updateReviewSections();
}

function startReview() {
    reviewSystem.startReview();
}

function flipCard() {
    const card = document.getElementById('flashcard');
    card.classList.toggle('flipped');
    reviewSystem.isCardFlipped = !reviewSystem.isCardFlipped;
}

function togglePinyin(event) {
    event.stopPropagation();
    const pinyin = document.getElementById('frontPinyin');
    const toggle = document.getElementById('pinyinToggle');

    if (pinyin.classList.contains('hidden')) {
        pinyin.classList.remove('hidden');
        toggle.textContent = '👁️ Hide Pinyin';
    } else {
        pinyin.classList.add('hidden');
        toggle.textContent = '👁️ Show Pinyin';
    }
}

function rateCard(rating) {
    reviewSystem.rateCard(rating);
}

function endReview() {
    reviewSystem.endReview();
}

function returnToHome() {
    reviewSystem.returnToHome();
}

function speakCharacter(event) {
    event.stopPropagation();
    const character = document.getElementById('backCharacter').textContent;
    const utterance = new SpeechSynthesisUtterance(character);

    // Find Chinese voice
    const voices = speechSynthesis.getVoices();
    const chineseVoice = voices.find(v => v.lang.includes('zh'));
    if (chineseVoice) utterance.voice = chineseVoice;

    utterance.lang = 'zh-CN';
    utterance.rate = 0.8;
    speechSynthesis.speak(utterance);
}

function refreshData() {
    if (confirm('This will reload fresh data from the server. Continue?')) {
        localStorage.removeItem('bct_vocab_cache');
        location.reload();
    }
}

function exportProgress() {
    const data = {
        characterProgress: reviewSystem.userProgress,
        lastExport: new Date().toISOString(),
        deviceCode: reviewSystem.deviceCode
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bct-progress-${reviewSystem.deviceCode}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}
