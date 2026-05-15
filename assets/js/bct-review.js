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

/** Single-cohort review mode: no Firestore cohort validation on the critical path. */
const REVIEW_FIXED_COHORT = 'taigen-a';

// BCT Review System Class
class BCTReviewSystem {
    constructor() {
        this.componentVocab = [];
        this.characterVocab = [];
        this.lessonVocab = [];
        this.vocabA = [];
        this.userProgress = {};
        this.currentTab = null;
        this.currentLevel = 'btc1';  // BCT Level tracking
        // Vocabulary review settings
        this.reviewDirection = 'zh-en'; // 中文 → 英文
        this.pinyinDisplay = 'show'; // Show Pinyin by default
        this.reviewQueue = [];
        this.currentIndex = 0;
        this.currentUser = null; // Firebase auth user (anonymous)
        this.deviceCode = null;
        this.isCardFlipped = false;
        this.studentId = null;   // master student doc id
        this.studentName = '';

        // Lazy-loading: per-section state (components | characters | vocab)
        this.sectionLoadState = {
            components: { status: 'idle', promise: null },
            characters: { status: 'idle', promise: null },
            vocab: { status: 'idle', promise: null },
            vocabA: { status: 'idle', promise: null }
        };
        this._sectionsLoadedLevel = null;
        this._lessonPartition = null;
        this._lessonLoadPromise = null;
        this._lessonLoadLevel = null;
        this._timelineVocabItems = null;
        this._timelineVocabLevel = null;
        this._timelineVocabPromise = null;
        this._timelineComponentsItems = null;
        this._timelineComponentsLevel = null;
        this._timelineTargetCharsItems = null;
        this._timelineTargetCharsLevel = null;
        this._bootstrapPromise = null;
    }

    getStudentCohort() {
        return REVIEW_FIXED_COHORT;
    }

    syncLevelButtons() {
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.level === this.currentLevel);
        });
    }

    isSectionReady(tab) {
        return this.sectionLoadState[tab]?.status === 'ready'
            && this._sectionsLoadedLevel === this.currentLevel;
    }

    invalidateLevelCaches() {
        this.sectionLoadState = {
            components: { status: 'idle', promise: null },
            characters: { status: 'idle', promise: null },
            vocab: { status: 'idle', promise: null },
            vocabA: { status: 'idle', promise: null }
        };
        this._sectionsLoadedLevel = null;
        this._lessonPartition = null;
        this._lessonLoadPromise = null;
        this._lessonLoadLevel = null;
        this._timelineVocabItems = null;
        this._timelineVocabLevel = null;
        this._timelineVocabPromise = null;
        this._timelineComponentsItems = null;
        this._timelineComponentsLevel = null;
        this._timelineTargetCharsItems = null;
        this._timelineTargetCharsLevel = null;
        this.componentVocab = [];
        this.characterVocab = [];
        this.lessonVocab = [];
        this.vocabA = [];
    }

    sectionCacheKey(tab) {
        return `bct_vocab_cache:${this.currentLevel}:${tab}`;
    }

    tryReadSectionCache(tab) {
        try {
            const raw = localStorage.getItem(this.sectionCacheKey(tab));
            if (!raw) return false;
            const items = JSON.parse(raw);
            if (!Array.isArray(items)) return false;
            if (tab === 'components') this.componentVocab = items;
            else if (tab === 'characters') this.characterVocab = items;
            else if (tab === 'vocab') this.lessonVocab = items;
            else if (tab === 'vocabA') this.vocabA = items;
            return true;
        } catch (_) {
            return false;
        }
    }

    saveSectionCache(tab) {
        const payload = tab === 'components'
            ? this.componentVocab
            : tab === 'characters'
                ? this.characterVocab
                : tab === 'vocab'
                    ? this.lessonVocab
                    : this.vocabA;
        try {
            localStorage.setItem(this.sectionCacheKey(tab), JSON.stringify(payload));
        } catch (e) {
            console.warn('Section cache save failed:', e);
        }
    }

    clearVocabCachesForLevel(level) {
        ['components', 'characters', 'vocab', 'vocabA'].forEach(tab => {
            localStorage.removeItem(`bct_vocab_cache:${level}:${tab}`);
        });
        if (level === this.currentLevel) {
            localStorage.removeItem('bct_vocab_cache');
        }
    }

    renderSectionPlaceholder() {
        const grid = document.getElementById('lessonGrid');
        if (!grid) return;
        grid.innerHTML = `
            <div class="section-placeholder" role="status">
                <p>Select <strong>Components</strong>, <strong>汉字</strong>, <strong>Vocabulary</strong>, or <strong>Vocab A</strong> above to load lessons.</p>
            </div>`;
        const countEl = document.getElementById('selectedCount');
        if (countEl) countEl.textContent = '(0/0)';
    }

    showSectionLoading() {
        const grid = document.getElementById('lessonGrid');
        if (!grid) return;
        grid.innerHTML = `
            <div class="section-loading" role="status" aria-live="polite">
                <div class="loader"></div>
                <p>Loading ${this.currentTab || 'content'}...</p>
            </div>`;
    }

    async init() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlLevel = urlParams.get('level');

            if (urlLevel) {
                this.currentLevel = urlLevel;
                localStorage.setItem('bct-current-level', urlLevel);
            } else {
                this.currentLevel = localStorage.getItem('bct-current-level') || 'btc1';
            }

            localStorage.setItem('bct-cohort', REVIEW_FIXED_COHORT);
            console.log(`🎯 BCT Review 初始化：Level=${this.currentLevel}, Cohort=${REVIEW_FIXED_COHORT} (fixed)`);

            this.currentTab = null;
            this.setupEventListeners();
            this.syncLevelButtons();
            document.querySelectorAll('#typeTabSystem .tab-btn').forEach(b => b.classList.remove('active'));
            this.renderSectionPlaceholder();
            this.updateStepIndicator(1);

            document.getElementById('loadingContainer').classList.add('hidden');
            document.getElementById('mainContent').classList.remove('hidden');

            this._bootstrapPromise = this.bootstrapBackground(REVIEW_FIXED_COHORT);
        } catch (error) {
            console.error('Initialization failed:', error);
            alert('Failed to initialize: ' + error.message);
        }
    }

    async bootstrapBackground(cohortId) {
        try {
            if (!auth) {
                throw new Error('Firebase Auth is not initialized. Make sure Firebase SDK is loaded.');
            }

            try {
                if (auth.currentUser && auth.currentUser.isAnonymous) {
                    this.currentUser = auth.currentUser;
                } else {
                    await auth.signInAnonymously();
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('Auth state change timeout')), 10000);
                        const unsub = auth.onAuthStateChanged((user) => {
                            if (!user) return;
                            clearTimeout(timeout);
                            unsub && unsub();
                            resolve(user);
                        }, (err) => {
                            clearTimeout(timeout);
                            unsub && unsub();
                            reject(err);
                        });
                    });
                    this.currentUser = auth.currentUser;
                }
            } catch (authError) {
                if (authError.code === 'auth/admin-restricted-operation') {
                    throw new Error('Anonymous sign-in is disabled. Please enable it in Firebase Console: Authentication → Sign-in method → Anonymous → Enable.');
                }
                throw new Error('Failed to sign in anonymously: ' + (authError.message || authError.code || 'Unknown error'));
            }

            if (!this.currentUser?.uid) {
                throw new Error('Anonymous auth failed: no user uid received');
            }
            this.deviceCode = this.currentUser.uid.substring(0, 6).toUpperCase();
            const deviceEl = document.getElementById('deviceCode');
            if (deviceEl) deviceEl.textContent = this.deviceCode;

            await this.resolveOrLinkStudent(cohortId);
            const nameEl = document.getElementById('studentName');
            if (nameEl) nameEl.textContent = this.studentName || 'Not linked';

            await this.loadUserProgress();
        } catch (error) {
            console.error('Background bootstrap failed:', error);
            const nameEl = document.getElementById('studentName');
            if (nameEl) nameEl.textContent = 'Setup incomplete';
        }
    }

    async ensureBootstrapReady() {
        if (this._bootstrapPromise) {
            await this._bootstrapPromise;
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

    partitionLessonDoc(docData, lessonId) {
        const data = {
            ...docData,
            source: 'lesson',
            lesson: lessonId,
            firestoreId: docData.firestoreId
        };
        if (data.type === 'component') {
            return { bucket: 'components', data };
        }
        if (data.type === 'vocab' || !data.type) {
            return { bucket: 'vocab', data };
        }
        return { bucket: 'characters', data };
    }

    async ensureLessonVocabularyLoaded() {
        const level = this.currentLevel;
        if (this._lessonLoadLevel === level && this._lessonPartition) {
            return this._lessonPartition;
        }
        if (this._lessonLoadPromise && this._lessonLoadLevel === level) {
            return this._lessonLoadPromise;
        }

        this._lessonLoadLevel = level;
        this._lessonLoadPromise = (async () => {
            const partition = { components: [], characters: [], vocab: [] };
            const lessonLoads = Array.from({ length: 20 }, (_, idx) => {
                const i = idx + 1;
                const lessonId = `lesson${i}`;
                return db.collection('courses')
                    .doc(level)
                    .collection('lessons')
                    .doc(lessonId)
                    .collection('vocabulary')
                    .get()
                    .then((vocabSnap) => ({ lessonId, vocabSnap }))
                    .catch(() => {
                        console.log(`Lesson ${i} not found, skipping...`);
                        return null;
                    });
            });

            const lessonResults = await Promise.all(lessonLoads);
            for (const result of lessonResults) {
                if (!result) continue;
                const { lessonId, vocabSnap } = result;
                vocabSnap.forEach(doc => {
                    const { bucket, data } = this.partitionLessonDoc({
                        ...doc.data(),
                        firestoreId: doc.id
                    }, lessonId);
                    partition[bucket].push(data);
                });
            }

            this._lessonPartition = partition;
            return partition;
        })();

        try {
            return await this._lessonLoadPromise;
        } finally {
            if (this._lessonLoadLevel === level) {
                this._lessonLoadPromise = null;
            }
        }
    }

    normalizeLessonId(rawLesson) {
        const lesson = String(rawLesson || '').trim().toLowerCase();
        const lessonMatch = lesson.match(/lesson\s*0*([1-9][0-9]*)/i)
            || lesson.match(/^l\s*0*([1-9][0-9]*)/i)
            || lesson.match(/^0*([1-9][0-9]*)$/);
        if (lessonMatch) {
            return `lesson${parseInt(lessonMatch[1], 10)}`;
        }
        return lesson || 'unknown';
    }

    async ensureTimelineVocabItems() {
        const level = this.currentLevel;
        const cohort = this.getStudentCohort();
        if (this._timelineVocabLevel === level && this._timelineVocabItems) {
            return this._timelineVocabItems;
        }
        if (this._timelineVocabPromise && this._timelineVocabLevel === level) {
            return this._timelineVocabPromise;
        }

        this._timelineVocabLevel = level;
        this._timelineVocabPromise = (async () => {
            const items = [];
            const vocabPaths = [
                `timeline/${level}/vocab/${cohort}/items`,
                `timeline/${level}/vocab/${cohort}`
            ];

            for (const path of vocabPaths) {
                try {
                    const vocabSnap = await db.collection(path).get();
                    console.log(`Timeline vocab path tried: ${path}, docs: ${vocabSnap.size}`);
                    if (vocabSnap.size > 0) {
                        vocabSnap.forEach(doc => {
                            const data = doc.data();
                            const lesson = this.normalizeLessonId(data.lesson);
                            items.push({
                                ...data,
                                source: 'timeline',
                                cohort,
                                lesson,
                                firestoreId: doc.id
                            });
                        });
                        break;
                    }
                } catch (error) {
                    console.log(`Timeline vocab path failed: ${path}`, error.message);
                }
            }

            if (items.length === 0) {
                console.log(`No timeline vocab items found for ${level}/${cohort} using any known path`);
            }

            this._timelineVocabItems = items;
            return items;
        })();

        try {
            return await this._timelineVocabPromise;
        } finally {
            if (this._timelineVocabLevel === level) {
                this._timelineVocabPromise = null;
            }
        }
    }

    async ensureTimelineComponents() {
        const level = this.currentLevel;
        if (this._timelineComponentsLevel === level && this._timelineComponentsItems) {
            return this._timelineComponentsItems;
        }

        const items = [];
        try {
            const compSnap = await db.collection(`timeline/${level}/components`).get();
            console.log(`Found ${compSnap.size} timeline components for ${level}`);
            compSnap.forEach(doc => {
                const data = doc.data();
                if (data.is_published === true) {
                    items.push({
                        ...data,
                        source: 'timeline',
                        lesson: data.lesson || 'unknown',
                        firestoreId: doc.id
                    });
                }
            });
        } catch (error) {
            console.log(`No timeline components for ${level}:`, error.message);
        }

        this._timelineComponentsItems = items;
        this._timelineComponentsLevel = level;
        return items;
    }

    async ensureTimelineTargetCharacters() {
        const level = this.currentLevel;
        if (this._timelineTargetCharsLevel === level && this._timelineTargetCharsItems) {
            return this._timelineTargetCharsItems;
        }

        const items = [];
        try {
            const targetCharsSnapshot = await db.collection(`timeline/${level}/target-characters`).get();
            console.log(`Found ${targetCharsSnapshot.size} target character documents for ${level}`);
            targetCharsSnapshot.forEach(doc => {
                const cardData = doc.data();
                if (cardData.is_published !== false) {
                    items.push({
                        ...cardData,
                        source: 'timeline',
                        lesson: cardData.lesson || 'unknown',
                        isCharacterCard: true,
                        firestoreId: doc.id
                    });
                }
            });
        } catch (error) {
            console.log(`No character cards for ${level}:`, error.message);
        }

        this._timelineTargetCharsItems = items;
        this._timelineTargetCharsLevel = level;
        return items;
    }

    async loadSectionComponents() {
        const partition = await this.ensureLessonVocabularyLoaded();
        const items = [...partition.components];
        const timelineComponents = await this.ensureTimelineComponents();
        items.push(...timelineComponents);

        const timelineVocab = await this.ensureTimelineVocabItems();
        timelineVocab.forEach(data => {
            if (data.type === 'component' && data.is_published === true) {
                items.push(data);
            }
        });

        this.componentVocab = items;
        console.log(`Loaded ${items.length} components for ${this.currentLevel}`);
    }

    async loadSectionCharacters() {
        const partition = await this.ensureLessonVocabularyLoaded();
        const items = [...partition.characters];

        const timelineVocab = await this.ensureTimelineVocabItems();
        timelineVocab.forEach(data => {
            if (data.type === 'component') return;
            if (data.type === 'vocab' || !data.type) return;
            items.push(data);
        });

        const targetChars = await this.ensureTimelineTargetCharacters();
        items.push(...targetChars);

        this.characterVocab = items;
        console.log(`Loaded ${items.length} characters for ${this.currentLevel}`);
    }

    async loadSectionVocab() {
        const partition = await this.ensureLessonVocabularyLoaded();
        const items = [...partition.vocab];
        this.lessonVocab = items;
        console.log(`Loaded ${items.length} lesson vocabulary items for ${this.currentLevel}`);
    }

    async loadSectionVocabA() {
        const items = [];
        const timelineVocab = await this.ensureTimelineVocabItems();
        timelineVocab.forEach(data => {
            const type = String(data.type || '').trim().toLowerCase();
            if (type === 'component') return;
            if (type === 'vocab' || !type) {
                items.push(data);
            }
        });
        this.vocabA = items;
        console.log(`Loaded ${items.length} timeline vocab items for ${this.currentLevel}`);
    }

    async ensureSectionLoaded(tab) {
        if (!tab || !this.sectionLoadState[tab]) {
            throw new Error(`Unknown review section: ${tab}`);
        }

        if (this.isSectionReady(tab)) {
            return;
        }

        const state = this.sectionLoadState[tab];
        if (state.promise) {
            return state.promise;
        }

        const hadCache = this.tryReadSectionCache(tab);
        if (hadCache) {
            this._sectionsLoadedLevel = this.currentLevel;
            state.status = 'ready';
            this.renderLessonSelector();
        } else {
            state.status = 'loading';
            this.showSectionLoading();
        }

        const usedCache = hadCache;
        state.promise = (async () => {
            console.time(`Loading section: ${tab}`);
            try {
                if (tab === 'components') {
                    await this.loadSectionComponents();
                } else if (tab === 'characters') {
                    await this.loadSectionCharacters();
                } else if (tab === 'vocab') {
                    await this.loadSectionVocab();
                } else if (tab === 'vocabA') {
                    await this.loadSectionVocabA();
                }

                this._sectionsLoadedLevel = this.currentLevel;
                state.status = 'ready';
                this.saveSectionCache(tab);
            } catch (error) {
                if (!usedCache) {
                    state.status = 'error';
                    throw error;
                }
                console.warn(`Section refresh failed (${tab}), using cached data:`, error);
            } finally {
                state.promise = null;
                console.timeEnd(`Loading section: ${tab}`);
            }
        })();

        await state.promise;

        if (this.currentTab === tab) {
            this.renderLessonSelector();
        }
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
        if (!this.currentTab) {
            this.renderSectionPlaceholder();
            return;
        }
        if (!this.isSectionReady(this.currentTab)) {
            return;
        }

        const grid = document.getElementById('lessonGrid');
        const lessons = [];

        // Get unique lessons
        let currentVocab = [];
        if (this.currentTab === 'components') currentVocab = this.componentVocab;
        else if (this.currentTab === 'characters') currentVocab = this.characterVocab;
        else if (this.currentTab === 'vocab') currentVocab = this.lessonVocab;
        else if (this.currentTab === 'vocabA') currentVocab = this.vocabA;

        for (let i = 1; i <= 20; i++) {
            const lessonId = `lesson${i}`;
            const chars = currentVocab.filter(c => this.normalizeLessonId(c.lesson) === lessonId);

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
        else if (this.currentTab === 'vocabA') currentVocab = this.vocabA;

        return currentVocab.filter(vocab => selectedLessons.includes(this.normalizeLessonId(vocab.lesson)));
    }

    // 取得進度用的 key，依照當前 tab 區分，避免不同 tab 互相覆蓋
    getProgressKey(vocab) {
        const baseId = vocab.firestoreId || `${vocab.character || vocab.pinyin || vocab.meaning || 'item'}:${vocab.lesson || ''}:${vocab.source || ''}`;
        return `${this.currentTab || 'unknown'}:${baseId}`;
    }

    updateSelectedCount() {
        const checked = document.querySelectorAll('.lesson-card[data-selected="true"]').length;
        const total = document.querySelectorAll('.lesson-card:not(.locked)').length;
        document.getElementById('selectedCount').textContent = `(${checked}/${total})`;
    }

    updateReviewSections() {
        const selectedLessons = this.getSelectedLessons();
        const reviewMethodTabs = document.getElementById('reviewMethodTabs');
        const smartReviewSection = document.getElementById('smartReviewSection');
        const difficultySection = document.getElementById('difficultySection');

        if (selectedLessons.length > 0) {
            reviewMethodTabs.classList.remove('hidden');
            // Default to Smart Review tab
            smartReviewSection.classList.remove('hidden');
            difficultySection.classList.add('hidden');
            this.updateStats();
            this.updateStepIndicator(4); // Show step 4
        } else {
            reviewMethodTabs.classList.add('hidden');
            smartReviewSection.classList.add('hidden');
            difficultySection.classList.add('hidden');
            this.updateStepIndicator(3); // Back to step 3
        }
    }

    updateStepIndicator(currentStep) {
        document.querySelectorAll('.step-item').forEach((item, index) => {
            const stepNum = index + 1;
            item.classList.remove('active', 'completed');
            if (stepNum < currentStep) {
                item.classList.add('completed');
            } else if (stepNum === currentStep) {
                item.classList.add('active');
            }
        });
    }

    updateStats() {
        const vocab = this.getSelectedVocab();
        const boxes = { forgot: 0, hard: 0, good: 0, easy: 0 };

        vocab.forEach(v => {
            const progress = this.userProgress[this.getProgressKey(v)];
            const box = progress ? progress.box : 'forgot';
            boxes[box]++;
        });

        // Update Smart Review breakdown (with null checks)
        const forgotEl = document.getElementById('forgotCount');
        const hardEl = document.getElementById('hardCount');
        const goodEl = document.getElementById('goodCount');
        const easyEl = document.getElementById('easyCount');
        const dueEl = document.getElementById('dueCount');
        
        if (forgotEl) forgotEl.textContent = boxes.forgot;
        if (hardEl) hardEl.textContent = boxes.hard;
        if (goodEl) goodEl.textContent = boxes.good;
        if (easyEl) easyEl.textContent = boxes.easy;

        // Update By Difficulty boxes
        const countForgotEl = document.getElementById('count-forgot');
        const countHardEl = document.getElementById('count-hard');
        const countGoodEl = document.getElementById('count-good');
        const countEasyEl = document.getElementById('count-easy');
        
        if (countForgotEl) countForgotEl.textContent = boxes.forgot;
        if (countHardEl) countHardEl.textContent = boxes.hard;
        if (countGoodEl) countGoodEl.textContent = boxes.good;
        if (countEasyEl) countEasyEl.textContent = boxes.easy;

        // Update due count
        const dueVocab = this.getDueVocab(vocab);
        if (dueEl) dueEl.textContent = dueVocab.length;
        
        console.log('📊 Stats updated:', { vocab: vocab.length, boxes, due: dueVocab.length });
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

        // Tab switching (lazy-load section on click)
        document.querySelectorAll('#typeTabSystem .tab-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const tab = e.currentTarget.dataset.tab;
                document.querySelectorAll('#typeTabSystem .tab-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                try {
                    await this.setCurrentTab(tab);
                } catch (err) {
                    console.error('Failed to load section:', err);
                    alert('Failed to load content: ' + (err.message || 'Unknown error'));
                }
            });
        });

        // Review Method Tab switching (Smart Review vs By Difficulty)
        document.querySelectorAll('#reviewMethodTabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                
                // Remove active from all tabs
                document.querySelectorAll('#reviewMethodTabs .tab-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                // Hide all content
                document.getElementById('smartReviewSection').classList.add('hidden');
                document.getElementById('difficultySection').classList.add('hidden');
                
                // Show selected content
                if (tab === 'smart-review') {
                    document.getElementById('smartReviewSection').classList.remove('hidden');
                } else if (tab === 'by-difficulty') {
                    document.getElementById('difficultySection').classList.remove('hidden');
                }
            });
        });

        // Vocabulary settings (Review Direction and Pinyin Display)
        const reviewDirectionSelect = document.getElementById('reviewDirection');
        const pinyinDisplaySelect = document.getElementById('pinyinDisplay');
        
        if (reviewDirectionSelect) {
            reviewDirectionSelect.addEventListener('change', (e) => {
                this.reviewDirection = e.target.value;
            });
        }
        
        if (pinyinDisplaySelect) {
            pinyinDisplaySelect.addEventListener('change', (e) => {
                this.pinyinDisplay = e.target.value;
            });
        }
    }

    async setCurrentTab(tab) {
        const previousTab = this.currentTab;
        if (previousTab && previousTab !== tab) {
            this.saveCurrentSelections();
        }

        this.currentTab = tab;
        this.clearSelections();
        this.updateStepIndicator(2);

        const vocabSettings = document.getElementById('vocabSettings');
        if (vocabSettings) {
            if (tab === 'vocab' || tab === 'vocabA') {
                vocabSettings.classList.remove('hidden');
                const reviewDirectionSelect = document.getElementById('reviewDirection');
                const pinyinDisplaySelect = document.getElementById('pinyinDisplay');
                if (reviewDirectionSelect) {
                    this.reviewDirection = reviewDirectionSelect.value;
                }
                if (pinyinDisplaySelect) {
                    this.pinyinDisplay = pinyinDisplaySelect.value;
                }
            } else {
                vocabSettings.classList.add('hidden');
            }
        }

        await this.ensureSectionLoaded(tab);
        this.restoreSelections();
        this.updateReviewSections();
    }

    // Switch BCT Level
    async switchLevel(level) {
        try {
            this.saveCurrentSelections();

            const previousLevel = this.currentLevel;
            this.currentLevel = level;
            localStorage.setItem('bct-current-level', level);

            const newUrl = `${window.location.pathname}?level=${level}&cohort=${REVIEW_FIXED_COHORT}`;
            window.history.pushState({ level, cohort: REVIEW_FIXED_COHORT }, '', newUrl);

            console.log(`✅ 已切换到 ${level}，URL 已更新`);

            this.syncLevelButtons();
            this.invalidateLevelCaches();
            if (previousLevel) {
                this.clearVocabCachesForLevel(previousLevel);
            }

            this.clearSelections();

            const activeTab = this.currentTab;
            if (activeTab) {
                await this.ensureSectionLoaded(activeTab);
                this.restoreSelections();
                this.updateReviewSections();
            } else {
                this.renderSectionPlaceholder();
            }
        } catch (error) {
            console.error('Level switch failed:', error);
            alert('Failed to switch level: ' + (error.message || 'Unknown error'));
        }
    }

    // Save current lesson selections
    saveCurrentSelections() {
        const selected = this.getSelectedLessons();
        localStorage.setItem(`${this.currentLevel}-${this.currentTab}-selected`, JSON.stringify(selected));
    }

    // Restore lesson selections
    restoreSelections() {
        const saved = localStorage.getItem(`${this.currentLevel}-${this.currentTab}-selected`);
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

    async startReview() {
        if (!this.currentTab || !this.isSectionReady(this.currentTab)) {
            alert('Please wait for lesson content to finish loading.');
            return;
        }
        await this.ensureBootstrapReady();

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

    async startBoxReview(box) {
        if (!this.currentTab || !this.isSectionReady(this.currentTab)) {
            alert('Please wait for lesson content to finish loading.');
            return;
        }
        await this.ensureBootstrapReady();

        const vocab = this.getSelectedVocab();
        this.reviewQueue = vocab.filter(v => {
            const progress = this.userProgress[this.getProgressKey(v)];
            return progress ? progress.box === box : box === 'forgot';
        });

        if (this.reviewQueue.length === 0) {
            alert(`No items in ${box} difficulty!`);
            return;
        }

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
        document.getElementById('vocabSettings').classList.add('hidden');
        document.getElementById('reviewMethodTabs').classList.add('hidden');
        document.getElementById('smartReviewSection').classList.add('hidden');
        document.getElementById('difficultySection').classList.add('hidden');
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

        // 確保設定是最新的（從 select 元素讀取）
        if (this.currentTab === 'vocab' || this.currentTab === 'vocabA') {
            const reviewDirectionSelect = document.getElementById('reviewDirection');
            const pinyinDisplaySelect = document.getElementById('pinyinDisplay');
            if (reviewDirectionSelect) {
                this.reviewDirection = reviewDirectionSelect.value;
            }
            if (pinyinDisplaySelect) {
                this.pinyinDisplay = pinyinDisplaySelect.value;
            }
        }

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
        
        // 字（優先顯示文字，否則顯示字形補丁圖片）
        let charDisplay = '';
        let isImage = false;
        if (vocab.character && vocab.character.trim()) {
            charDisplay = vocab.character;
        } else if (vocab.display_image && vocab.display_image.trim()) {
            charDisplay = `<img src="${vocab.display_image}" class="img-comp" alt="comp" style="height: 1.8em; width: auto; vertical-align: middle;">`;
            isImage = true;
        }

        // 隱藏 toggle 按鈕（不再需要）
        pinyinToggle.classList.add('hidden');

        if (this.currentTab === 'vocab' || this.currentTab === 'vocabA') {
            // Vocabulary 模式：根據 Review Direction 顯示
            if (this.reviewDirection === 'zh-en') {
                // 中文 → 英文：正面顯示中文（字+可選拼音）
                if (isImage) {
                    frontCharacter.innerHTML = charDisplay;
                    frontCharacter.classList.remove('pinyin-large');
                } else {
                    frontCharacter.textContent = vocab.character || '';
                    frontCharacter.classList.remove('pinyin-large');
                }
                
                // 根據 pinyinDisplay 設定顯示拼音
                if (this.pinyinDisplay === 'show') {
                    frontPinyin.textContent = vocab.pinyin || '';
                    frontPinyin.classList.remove('hidden');
                } else {
                    frontPinyin.textContent = '';
                    frontPinyin.classList.add('hidden');
                }
            } else if (this.reviewDirection === 'en-zh') {
                // 英文 → 中文：正面顯示英文
                const englishText = vocab.meaning || vocab.english || vocab.spanish || '';
                frontCharacter.textContent = englishText;
                frontCharacter.classList.add('pinyin-large');
                frontPinyin.textContent = '';
                frontPinyin.classList.add('hidden');
            }
        } else {
            // Components 或 汉字：正面只顯示字，不顯示拼音
            if (isImage) {
                frontCharacter.innerHTML = charDisplay;
            } else {
                frontCharacter.textContent = vocab.character || '';
            }
            frontCharacter.classList.remove('pinyin-large');
            frontPinyin.textContent = '';
            frontPinyin.classList.add('hidden');
        }
    }

    renderCardBack(vocab) {
        // 字（優先顯示文字，否則顯示字形補丁圖片）
        const backCharacter = document.getElementById('backCharacter');
        const backPinyin = document.getElementById('backPinyin');
        const backMeaning = document.getElementById('backMeaning');
        
        if ((this.currentTab === 'vocab' || this.currentTab === 'vocabA') && this.reviewDirection === 'en-zh') {
            // Vocabulary 英文→中文模式：背面顯示中文（字+拼音）
            let charDisplay = '';
            if (vocab.character && vocab.character.trim()) {
                charDisplay = vocab.character;
                backCharacter.textContent = charDisplay;
            } else if (vocab.display_image && vocab.display_image.trim()) {
                backCharacter.innerHTML = `<img src="${vocab.display_image}" class="img-comp" alt="comp" style="height: 1.8em; width: auto; vertical-align: middle;">`;
            } else {
                backCharacter.textContent = '';
            }
            backPinyin.textContent = vocab.pinyin || '';
            backMeaning.textContent = vocab.meaning || `${vocab.english || ''} | ${vocab.spanish || ''}`;
        } else if ((this.currentTab === 'vocab' || this.currentTab === 'vocabA') && this.reviewDirection === 'zh-en') {
            // Vocabulary 中文→英文模式：背面顯示英文 + 字 + 拼音
            let charDisplay = '';
            if (vocab.character && vocab.character.trim()) {
                charDisplay = vocab.character;
                backCharacter.textContent = charDisplay;
            } else if (vocab.display_image && vocab.display_image.trim()) {
                backCharacter.innerHTML = `<img src="${vocab.display_image}" class="img-comp" alt="comp" style="height: 1.8em; width: auto; vertical-align: middle;">`;
            } else {
                backCharacter.textContent = '';
            }
            backPinyin.textContent = vocab.pinyin || '';
            backMeaning.textContent = vocab.meaning || vocab.english || vocab.spanish || '';
        } else {
            // Components 或 汉字：背面顯示字+拼音+意思
            let charDisplay = '';
            if (vocab.character && vocab.character.trim()) {
                charDisplay = vocab.character;
                backCharacter.textContent = charDisplay;
            } else if (vocab.display_image && vocab.display_image.trim()) {
                backCharacter.innerHTML = `<img src="${vocab.display_image}" class="img-comp" alt="comp" style="height: 1.8em; width: auto; vertical-align: middle;">`;
            } else {
                backCharacter.textContent = '';
            }
            backPinyin.textContent = vocab.pinyin || '';
            backMeaning.textContent = vocab.meaning ||
                `${vocab.english || ''} | ${vocab.spanish || ''}`;
        }

        // Source tag
        const sourceTag = document.getElementById('sourceTag');
        if (vocab.isCharacterCard) {
            sourceTag.textContent = `字卡 Card`;
            sourceTag.className = 'source-tag timeline';
        } else if (vocab.source === 'timeline') {
            sourceTag.textContent = `Timeline ${vocab.sourceDate?.replace('timeline-', '') || ''}`;
            sourceTag.className = 'source-tag timeline';
        } else {
            sourceTag.textContent = `Lesson ${vocab.lesson?.replace('lesson', '') || ''}`;
            sourceTag.className = 'source-tag lesson';
        }

        // 輔助插圖（如果有的話）- 放在形音义之後，補充說明之前
        const imageDiv = document.getElementById('backImage');
        if (vocab.image && vocab.image.trim()) {
            imageDiv.style.marginTop = '15px';
            imageDiv.style.textAlign = 'center';
            imageDiv.innerHTML = `<img src="${vocab.image}" style="max-width: 100%; border-radius: 8px;" onerror="this.style.display='none';">`;
            imageDiv.classList.remove('hidden');
        } else {
            imageDiv.innerHTML = '';
            imageDiv.classList.add('hidden');
        }
        
        // Notes（支援 Markdown 和圖片）- 放在圖片之後
        const notesDiv = document.getElementById('backNotes');
        if (vocab.notes && vocab.notes.trim()) {
            let notesHtml = marked.parse(vocab.notes);
            // 處理圖片分類
            notesHtml = notesHtml.replace(
                /<img src="([^"]+)" alt="([^"]+)"/g,
                (match, src, alt) => {
                    if (alt === 'comp') {
                        return `<img src="${src}" class="img-comp" alt="comp" loading="lazy" style="height: 1.6em; width: auto; vertical-align: middle; margin: 0 2px;">`;
                    } else if (alt === 'origin') {
                        return `<img src="${src}" class="img-origin" alt="origin" loading="lazy" style="width: 55%; min-width: 180px; margin: 15px auto; display: block; border: 1px solid #eee; padding: 8px; background: #fff; border-radius: 6px;">`;
                    } else if (alt === 'story') {
                        return `<img src="${src}" class="img-story" alt="story" loading="lazy" style="width: 90%; margin: 20px auto; display: block; border-radius: 10px;">`;
                    }
                    return `<img src="${src}" alt="${alt}" loading="lazy" style="max-width: 100%; height: auto; display: block;">`;
                }
            );
            notesDiv.innerHTML = notesHtml;
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
        await this.ensureBootstrapReady();

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

        // Show Vocabulary settings if Vocabulary or Vocab A tab is selected
        if (this.currentTab === 'vocab' || this.currentTab === 'vocabA') {
            const vocabSettings = document.getElementById('vocabSettings');
            if (vocabSettings) {
                vocabSettings.classList.remove('hidden');
            }
        }

        // Reset to Smart Review tab
        document.querySelectorAll('#reviewMethodTabs .tab-btn').forEach(b => b.classList.remove('active'));
        const smartReviewTab = document.querySelector('#reviewMethodTabs .tab-btn[data-tab="smart-review"]');
        if (smartReviewTab) {
            smartReviewTab.classList.add('active');
            document.getElementById('smartReviewSection').classList.remove('hidden');
            document.getElementById('difficultySection').classList.add('hidden');
        }

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

function startBoxReview(box) {
    reviewSystem.startBoxReview(box);
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

async function refreshData() {
    if (!confirm('This will reload fresh data from the server. Continue?')) {
        return;
    }
    const tab = reviewSystem.currentTab;
    const level = reviewSystem.currentLevel;
    reviewSystem.clearVocabCachesForLevel(level);
    localStorage.removeItem('bct_vocab_cache');
    reviewSystem.invalidateLevelCaches();
    reviewSystem.currentTab = tab;
    if (tab) {
        reviewSystem.showSectionLoading();
        try {
            await reviewSystem.ensureSectionLoaded(tab);
            reviewSystem.updateReviewSections();
        } catch (e) {
            alert('Refresh failed: ' + (e.message || 'Unknown error'));
        }
    } else {
        reviewSystem.renderSectionPlaceholder();
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
