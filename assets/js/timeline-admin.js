// Timeline Admin: 新增 / 列表 / 刪除（跨課次）

// Firebase config（與全站一致）
const firebaseConfig = {
    apiKey: "AIzaSyBIJ0YDcX438Tq0G05qpvIANiolTrNM8Ds",
    authDomain: "bct-lego.firebaseapp.com",
    projectId: "bct-lego",
    storageBucket: "bct-lego.firebasestorage.app",
    messagingSenderId: "205694748282",
    appId: "1:205694748282:web:9a8e9a196b2d1829bdddc3",
    measurementId: "G-1CBF9H64WN"
};

// #region agent log helper
function dlog(hypothesisId, location, message, data = {}, runId = 'admin') {
    fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            sessionId:'debug-session',
            runId,
            hypothesisId,
            location,
            message,
            data,
            timestamp:Date.now()
        })
    }).catch(()=>{});
}
// #endregion

let db = null;
let teacherPassword = 'yainu8up'; // 與原 timeline 相同簡易密碼
let currentPage = 1;
const pageSize = 20;
let allItems = [];
const lessons = Array.from({length:25}, (_,i)=>`lesson${i+1}`);

window.addEventListener('DOMContentLoaded', async () => {
    try {
        initDateDefaults();
        renderLessonOptions();
        setupTypeToggle();
        setupFilters();
        setupTabSystem();
        setupStudioSystem();
        setupLiveNoteSystem();
        await ensureAuth();
        
        // Initialize Firebase and ensure Anonymous Sign-in
        await initFirebase();
        
        // Verify auth state before proceeding
        const auth = firebase.auth();
        if (!auth.currentUser) {
            console.error('❌ Auth failed - no user after initFirebase');
            alert('無法連接到資料庫。請檢查 Firebase 設定或重新整理頁面。');
            document.getElementById('adminStatus').textContent = '連接失敗';
            return;
        }
        console.log('✅ Auth verified:', auth.currentUser.uid, auth.currentUser.isAnonymous ? '(anonymous)' : '(email)');
        
        bindActions();
        setupCharacterCardSystem();
        await refreshList();
    } catch (error) {
        console.error('❌ Initialization error:', error);
        alert('初始化失敗：' + error.message);
        document.getElementById('adminStatus').textContent = '錯誤';
    }
});

function initDateDefaults() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateInput').value = today;
    document.getElementById('startDate').value = today;
    document.getElementById('endDate').value = today;
}

function setupTypeToggle() {
    const radios = document.querySelectorAll('input[name="type"]');
    const cohortRow = document.querySelector('.cohort-select');
    
    radios.forEach(r => {
        r.addEventListener('change', () => {
            const isNote = r.value === 'note';
            const needsCohort = r.value === 'vocab' || r.value === 'note';
            
            // 显示/隐藏字段
            document.querySelectorAll('.type-note').forEach(el => el.classList.toggle('hidden', !isNote));
            document.querySelectorAll('.type-vocab').forEach(el => el.classList.toggle('hidden', isNote));
            
            // 显示/隐藏班级选择
            if (cohortRow) {
                cohortRow.classList.toggle('hidden', !needsCohort);
            }
        });
    });
}

function setupFilters() {
    document.getElementById('searchBtn').addEventListener('click', refreshList);
    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));
}

function renderLessonOptions() {
    const lessonSelect = document.getElementById('lessonInput');
    const filterSelect = document.getElementById('filterLesson');
    const cardLessonSelect = document.getElementById('cardLessonInput');
    lessons.forEach(id => {
        const opt1 = document.createElement('option');
        opt1.value = id;
        opt1.textContent = id.replace('lesson','Lesson ');
        lessonSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = id;
        opt2.textContent = id.replace('lesson','Lesson ');
        filterSelect.appendChild(opt2);

        if (cardLessonSelect) {
            const opt3 = document.createElement('option');
            opt3.value = id;
            opt3.textContent = id.replace('lesson','Lesson ');
            cardLessonSelect.appendChild(opt3);
        }
    });
}

async function ensureAuth() {
    const saved = localStorage.getItem('teacher_auth');
    if (saved === teacherPassword) {
        document.getElementById('adminStatus').textContent = '已验证';
        return;
    }
    const input = prompt('请输入老师密码：');
    if (input !== teacherPassword) {
        alert('密码错误');
        window.location.href = 'index.html';
        return;
    }
    localStorage.setItem('teacher_auth', input);
    document.getElementById('adminStatus').textContent = '已验证';
}

async function initFirebase() {
    if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    
    // Anonymous sign-in (required for Firestore rules: request.auth != null)
    const auth = firebase.auth();
    
    // Check if already signed in
    if (auth.currentUser && auth.currentUser.isAnonymous) {
        console.log('✅ Already signed in anonymously:', auth.currentUser.uid);
        dlog('TA1','timeline-admin:init','Firebase init (already authed)',{projectId: firebaseConfig.projectId, uid: auth.currentUser.uid});
        return;
    }
    
    // Need to sign in anonymously
    try {
        console.log('🔄 Signing in anonymously...');
        await auth.signInAnonymously();
        
        // Wait for auth state to settle
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Auth timeout')), 10000);
            const unsub = auth.onAuthStateChanged((user) => {
                if (user && user.isAnonymous) {
                    clearTimeout(timeout);
                    unsub();
                    console.log('✅ Anonymous sign-in successful:', user.uid);
                    resolve(user);
                } else if (user && !user.isAnonymous) {
                    clearTimeout(timeout);
                    unsub();
                    reject(new Error('Signed in but not anonymous (user: ' + user.uid + ')'));
                }
            }, (err) => {
                clearTimeout(timeout);
                unsub();
                reject(err);
            });
        });
    } catch (authError) {
        console.error('❌ Anonymous sign-in failed:', authError);
        if (authError.code === 'auth/admin-restricted-operation') {
            console.error('❌ Anonymous sign-in is disabled. Enable it in Firebase Console: Authentication → Sign-in method → Anonymous');
        }
        // Re-throw so caller knows auth failed
        throw new Error('Cannot proceed without authentication: ' + (authError.message || authError.code || 'Unknown error'));
    }
    
    dlog('TA1','timeline-admin:init','Firebase init',{projectId: firebaseConfig.projectId});
}

function bindActions() {
    document.getElementById('submitBtn').addEventListener('click', addEntry);
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('teacher_auth');
        location.reload();
    });
}

async function addEntry() {
    const date = document.getElementById('dateInput').value;
    const lesson = document.getElementById('lessonInput').value;
    const type = document.querySelector('input[name="type"]:checked').value;
    const level = document.querySelector('input[name="level"]:checked').value;
    const cohort = document.querySelector('input[name="cohort"]:checked')?.value;

    if (!date || !lesson) {
        alert('请填日期与课次');
        return;
    }

    // 生词和笔记需要班级
    if ((type === 'vocab' || type === 'note') && !cohort) {
        alert('生词和笔记需要选择班级');
        return;
    }

    if (type !== 'note') {
        const ch = document.getElementById('characterInput').value.trim();
        const py = document.getElementById('pinyinInput').value.trim();
        const me = document.getElementById('meaningInput').value.trim();
        if (!ch || !py || !me) {
            alert('请填写汉字、拼音、意思');
            return;
        }
    }

    let data = {
        type,
        lesson,
        date,
        review: type !== 'note',
        timestamp: new Date().toISOString()
    };

    // 生词和笔记添加 cohort 字段
    if (type === 'vocab' || type === 'note') {
        data.cohort = cohort;
    }

    if (type === 'note') {
        data.title = document.getElementById('noteTitleInput').value;
        data.content = document.getElementById('noteContentInput').value;
    } else {
        data.character = document.getElementById('characterInput').value;
        data.pinyin = document.getElementById('pinyinInput').value;
        data.meaning = document.getElementById('meaningInput').value;
        data.notes = document.getElementById('notesInput').value;
    }

    // 新的路径结构
    let collectionPath;
    if (type === 'component') {
        // components: timeline/{level}/components/
        collectionPath = `timeline/${level}/components`;
    } else if (type === 'vocab') {
        // vocab: timeline/{level}/vocab/{cohort}/items/
        collectionPath = `timeline/${level}/vocab/${cohort}/items`;
    } else {
        // notes: timeline/{level}/notes/{cohort}/items/
        collectionPath = `timeline/${level}/notes/${cohort}/items`;
    }

    try {
        await db.collection(collectionPath).add(data);

        dlog('TA2','timeline-admin:addEntry','write success',{level, cohort, type, lesson});
        alert('储存成功！');
        clearForm(type);
        await refreshList();
    } catch (error) {
        console.error(error);
        dlog('TA2','timeline-admin:addEntry','write failed',{message:error.message});
        alert('储存失败：' + error.message);
    }
}

function clearForm(type) {
    document.getElementById('characterInput').value = '';
    document.getElementById('pinyinInput').value = '';
    document.getElementById('meaningInput').value = '';
    document.getElementById('notesInput').value = '';
    document.getElementById('noteTitleInput').value = '';
    document.getElementById('noteContentInput').value = '';
}

async function refreshList() {
    const filterLesson = document.getElementById('filterLesson').value;
    const filterLevel = document.getElementById('filterLevel').value;
    const filterCohort = document.getElementById('filterCohort').value;
    const keyword = document.getElementById('keywordInput').value.trim().toLowerCase();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const types = Array.from(document.querySelectorAll('input[name="filterType"]:checked')).map(i=>i.value);

    dlog('TA3','timeline-admin:refreshList','query start',{filterLesson, filterLevel, filterCohort, keyword, types, startDate, endDate});

    // 读取所有等级的数据
    const levels = filterLevel ? [filterLevel] : ['btc1', 'btc2', 'btc3'];
    const cohorts = filterCohort ? [filterCohort] : ['taigen-a', 'taigen-b'];
    
    const items = [];
    
    for (const level of levels) {
        // 读取 components (所有班共用)
        if (types.includes('component')) {
            try {
                const compSnap = await db.collection(`timeline/${level}/components`).get();
                compSnap.forEach(doc => {
                    items.push({
                        id: doc.id,
                        level,
                        cohort: null,
                        ...doc.data()
                    });
                });
            } catch (e) {
                console.warn('Error loading components:', e);
            }
        }
        
        // 读取 vocab (分班)
        if (types.includes('vocab')) {
            for (const cohort of cohorts) {
                try {
                    const vocabSnap = await db.collection(`timeline/${level}/vocab/${cohort}/items`).get();
                    vocabSnap.forEach(doc => {
                        items.push({
                            id: doc.id,
                            level,
                            cohort,
                            ...doc.data()
                        });
                    });
                } catch (e) {
                    console.warn('Error loading vocab:', e);
                }
            }
        }
        
        // 读取 notes (分班)
        if (types.includes('note')) {
            for (const cohort of cohorts) {
                try {
                    const noteSnap = await db.collection(`timeline/${level}/notes/${cohort}/items`).get();
                    noteSnap.forEach(doc => {
                        items.push({
                            id: doc.id,
                            level,
                            cohort,
                            ...doc.data()
                        });
                    });
                } catch (e) {
                    console.warn('Error loading notes:', e);
                }
            }
        }
    }

    // 筛选逻辑
    allItems = items.filter(item => {
        // 课次筛选
        if (filterLesson && item.lesson !== filterLesson) return false;
        
        // 日期筛选
        if (startDate && item.date < startDate) return false;
        if (endDate && item.date > endDate) return false;
        
        // 关键字筛选
        if (keyword) {
            const text = [
                item.character || '',
                item.pinyin || '',
                item.meaning || '',
                item.title || '',
                item.content || ''
            ].join(' ').toLowerCase();
            if (!text.includes(keyword)) return false;
        }
        
        return true;
    });

    // 排序：最新的在前
    allItems.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
    });

    currentPage = 1;
    renderPage();
    
    dlog('TA3','timeline-admin:refreshList','filtered',{total: allItems.length});
}

function renderPage() {
    const list = document.getElementById('entryList');
    const stats = document.getElementById('listStats');
    
    if (!allItems.length) {
        list.innerHTML = `<div class="no-data">尚无资料</div>`;
        stats.textContent = '共 0 笔';
        document.getElementById('prevPage').disabled = true;
        document.getElementById('nextPage').disabled = true;
        document.getElementById('pageInfo').textContent = '0 / 0';
        return;
    }

    const totalPages = Math.ceil(allItems.length / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const pageItems = allItems.slice(start, start + pageSize);

    list.innerHTML = pageItems.map(item => {
        const typeTag = `<span class="tag ${item.type}">${item.type}</span>`;
        const levelTag = `<span class="tag level">${item.level.toUpperCase()}</span>`;
        const cohortTag = item.cohort ? `<span class="tag cohort">${item.cohort === 'taigen-a' ? 'A班' : 'B班'}</span>` : '';
        
        const main = item.type === 'note'
            ? (item.title || '(无标题)')
            : [item.character, item.pinyin].filter(Boolean).join(' · ');
        const sub = item.type === 'note'
            ? (item.content || '')
            : (item.meaning || '');
            
        return `
            <div class="entry-row">
                <div class="text-muted">${item.date || '-'}</div>
                <div>${item.lesson || '-'}</div>
                <div>${levelTag} ${typeTag} ${cohortTag}</div>
                <div class="line-tight">
                    <div>${main}</div>
                    <div class="text-muted">${sub}</div>
                </div>
                <div>
                    <button class="btn btn-danger btn-sm" onclick="deleteItem('${item.id}','${item.level}','${item.type}','${item.cohort || ''}')">删除</button>
                </div>
            </div>
        `;
    }).join('');

    stats.textContent = `共 ${allItems.length} 笔`;
    document.getElementById('pageInfo').textContent = `${currentPage} / ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

function changePage(delta) {
    currentPage += delta;
    renderPage();
}

async function deleteItem(id, level, type, cohort) {
    if (!confirm('确定删除这笔资料？')) return;
    
    let path;
    if (type === 'component') {
        path = `timeline/${level}/components/${id}`;
    } else if (type === 'vocab') {
        path = `timeline/${level}/vocab/${cohort}/items/${id}`;
    } else {
        path = `timeline/${level}/notes/${cohort}/items/${id}`;
    }
    
    try {
        await db.doc(path).delete();
        dlog('TA4','timeline-admin:delete','delete success',{type, path});
        await refreshList();
    } catch (error) {
        console.error(error);
        dlog('TA4','timeline-admin:delete','delete failed',{message:error.message});
        alert('删除失败：' + error.message);
    }
}

// ==================== Tab 切換系統 ====================
function setupTabSystem() {
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    const tabPanes = document.querySelectorAll('.admin-tab-pane');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // 移除所有 active 狀態
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // 添加 active 到當前選擇
            btn.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

// ==================== 字卡管理系統 ====================
let characterCards = []; // 用於儲存當前選擇類型的項目（部件或目標字）
let currentEditCardIndex = null;
let currentCardType = 'component'; // 當前選擇的類型：'component' 或 'target-character'

function setupCharacterCardSystem() {
    // 綁定事件
    document.getElementById('addCardBtn')?.addEventListener('click', addCharacterCard);
    document.getElementById('clearCardFormBtn')?.addEventListener('click', clearCardForm);
    document.getElementById('batchPublishCardsBtn')?.addEventListener('click', () => batchPublishCards(true));
    document.getElementById('batchUnpublishCardsBtn')?.addEventListener('click', () => batchPublishCards(false));
    
    // 類型選擇變更時切換顯示
    const cardTypeRadios = document.querySelectorAll('input[name="cardType"]');
    cardTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            currentCardType = this.value;
            const lessonId = document.getElementById('cardLessonInput')?.value;
            if (lessonId) {
                loadCharacterCards(lessonId);
            } else {
                characterCards = [];
                renderCharacterCardList();
            }
        });
    });
    
    // 課次選擇變更時載入資料
    const cardLessonSelect = document.getElementById('cardLessonInput');
    if (cardLessonSelect) {
        cardLessonSelect.addEventListener('change', function() {
            const lessonId = this.value;
            if (lessonId) loadCharacterCards(lessonId);
            else {
                characterCards = [];
                renderCharacterCardList();
            }
        });
    }
    
    // 初始化 Cloudinary 上傳
    initCloudinaryUpload();
}

async function loadCharacterCards(lessonId) {
    const level = document.querySelector('input[name="cardLevel"]:checked')?.value;
    const cardType = document.querySelector('input[name="cardType"]:checked')?.value || 'component';
    
    if (!level) {
        alert('請先選擇等級');
        return;
    }
    
    showCardLoader();
    try {
        if (cardType === 'component') {
            // 部件：從 timeline/{level}/components/ collection 載入，過濾 lesson
            const snapshot = await db.collection(`timeline/${level}/components`).get();
            characterCards = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if ((data.lesson || '').trim() === lessonId.trim()) {
                    characterCards.push({
                        id: doc.id,
                        ...data
                    });
                }
            });
        } else {
            // 目標字：從 timeline/{level}/target-characters/ collection 載入，過濾 lesson
            const snapshot = await db.collection(`timeline/${level}/target-characters`).get();
            characterCards = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if ((data.lesson || '').trim() === lessonId.trim()) {
                    characterCards.push({
                        id: doc.id,
                        ...data
                    });
                }
            });
        }
        renderCharacterCardList();
    } catch (error) {
        console.error('載入失敗:', error);
        alert('載入失敗：' + error.message);
    }
    hideCardLoader();
}

async function addCharacterCard() {
    const level = document.querySelector('input[name="cardLevel"]:checked')?.value;
    const lessonId = document.getElementById('cardLessonInput')?.value;
    const cardType = document.querySelector('input[name="cardType"]:checked')?.value || 'component';
    
    if (!level || !lessonId) {
        alert('請選擇等級和課次');
        return;
    }
    
    const character = document.getElementById('cardCharacter')?.value.trim();
    const pinyin = document.getElementById('cardPinyin')?.value.trim();
    const meaning = document.getElementById('cardMeaning')?.value.trim();
    
    if (!character && !document.getElementById('cardDisplayImage')?.value.trim()) {
        alert('請填寫字或上傳字形補丁圖片');
        return;
    }
    if (!pinyin || !meaning) {
        alert('請填寫拼音和意思');
        return;
    }
    
    const cardData = {
        type: cardType,
        lesson: lessonId,
        character: character || '',
        display_image: document.getElementById('cardDisplayImage')?.value.trim() || '',
        pinyin,
        meaning,
        image: document.getElementById('cardImage')?.value.trim() || '',
        notes: document.getElementById('cardNotes')?.value.trim() || '',
        is_published: false,
        published_at: null,
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString()
    };
    
    showCardLoader();
    try {
        if (currentEditCardIndex !== null) {
            // 編輯模式：更新現有文檔
            const original = characterCards[currentEditCardIndex];
            cardData.is_published = original.is_published;
            cardData.published_at = original.published_at;
            
            const collectionPath = cardType === 'component' 
                ? `timeline/${level}/components`
                : `timeline/${level}/target-characters`;
            
            await db.collection(collectionPath).doc(original.id).set(cardData, { merge: true });
            
            characterCards[currentEditCardIndex] = { ...cardData, id: original.id };
            currentEditCardIndex = null;
            alert('更新成功！');
        } else {
            // 新增模式：建立新文檔
            const collectionPath = cardType === 'component' 
                ? `timeline/${level}/components`
                : `timeline/${level}/target-characters`;
            
            const docRef = await db.collection(collectionPath).add(cardData);
            cardData.id = docRef.id;
            characterCards.push(cardData);
            alert('新增成功！（預設未發布）');
        }
        
        renderCharacterCardList();
        clearCardForm();
    } catch (error) {
        console.error('儲存失敗:', error);
        alert('儲存失敗：' + error.message);
    }
    hideCardLoader();
}

function clearCardForm() {
    document.getElementById('cardCharacter').value = '';
    document.getElementById('cardDisplayImage').value = '';
    document.getElementById('cardPinyin').value = '';
    document.getElementById('cardMeaning').value = '';
    document.getElementById('cardImage').value = '';
    document.getElementById('cardNotes').value = '';
    currentEditCardIndex = null;
}

function renderCharacterCardList() {
    const container = document.getElementById('cardList');
    if (!container) return;
    
    const cardType = document.querySelector('input[name="cardType"]:checked')?.value || 'component';
    const typeLabel = cardType === 'component' ? '部件' : '目標字';
    
    if (characterCards.length === 0) {
        container.innerHTML = `<div class="no-data">尚未新增任何${typeLabel}</div>`;
        return;
    }
    
    container.innerHTML = characterCards.map((card, index) => {
        const charDisplay = card.character || 
            (card.display_image ? `<img src="${card.display_image}" class="img-comp" alt="comp">` : '');
        const isPublished = card.is_published !== false;
        const notesHtml = card.notes ? renderMarkdown(card.notes) : '';
        
        return `
            <div class="character-card ${isPublished ? '' : 'unpublished'}">
                <div class="char-display">${charDisplay}</div>
                <div class="char-pinyin-display">${card.pinyin || ''}</div>
                <div class="char-meaning-display">${card.meaning || ''}</div>
                ${card.image ? `<img src="${card.image}" style="max-width:100%;margin:10px 0;border-radius:6px;" onerror="this.style.display='none';">` : ''}
                ${notesHtml ? `<div class="char-notes-display">${notesHtml}</div>` : ''}
                <div class="publish-toggle">
                    <label class="toggle-switch">
                        <input type="checkbox" ${isPublished ? 'checked' : ''} onchange="toggleCardPublish(${index}, this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                    <span class="publish-status ${isPublished ? 'published' : 'unpublished'}">
                        ${isPublished ? '已發布' : '未發布'}
                    </span>
                </div>
                <div class="card-actions">
                    <button class="btn btn-secondary btn-small" onclick="editCharacterCard(${index})">✏️ 編輯</button>
                    <button class="btn btn-danger btn-small" onclick="deleteCharacterCard(${index})">🗑️ 刪除</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderMarkdown(text) {
    if (!text) return '';
    let html = marked.parse(text);
    // 處理圖片分類
    html = html.replace(
        /<img src="([^"]+)" alt="([^"]+)"/g,
        (match, src, alt) => {
            if (alt === 'comp') {
                return `<img src="${src}" class="img-comp" alt="comp" loading="lazy">`;
            } else if (alt === 'origin') {
                return `<img src="${src}" class="img-origin" alt="origin" loading="lazy">`;
            } else if (alt === 'story') {
                return `<img src="${src}" class="img-story" alt="story" loading="lazy">`;
            }
            return match;
        }
    );
    return html;
}

function editCharacterCard(index) {
    const card = characterCards[index];
    document.getElementById('cardCharacter').value = card.character || '';
    document.getElementById('cardDisplayImage').value = card.display_image || '';
    document.getElementById('cardPinyin').value = card.pinyin || '';
    document.getElementById('cardMeaning').value = card.meaning || '';
    document.getElementById('cardImage').value = card.image || '';
    document.getElementById('cardNotes').value = card.notes || '';
    
    // 設定類型選擇
    if (card.type) {
        const typeRadio = document.querySelector(`input[name="cardType"][value="${card.type}"]`);
        if (typeRadio) {
            typeRadio.checked = true;
            currentCardType = card.type;
        }
    }
    
    currentEditCardIndex = index;
    alert('進入編輯模式，修改後點擊「新增」即可更新');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteCharacterCard(index) {
    const card = characterCards[index];
    const cardType = card.type || document.querySelector('input[name="cardType"]:checked')?.value || 'component';
    const typeLabel = cardType === 'component' ? '部件' : '目標字';
    
    if (!confirm(`確定要刪除此${typeLabel}？`)) return;
    
    const level = document.querySelector('input[name="cardLevel"]:checked')?.value;
    if (!level || !card.id) {
        alert('無法刪除：缺少必要資訊');
        return;
    }
    
    showCardLoader();
    try {
        const collectionPath = cardType === 'component' 
            ? `timeline/${level}/components`
            : `timeline/${level}/target-characters`;
        
        await db.collection(collectionPath).doc(card.id).delete();
        characterCards.splice(index, 1);
        renderCharacterCardList();
        alert('刪除成功！');
    } catch (error) {
        console.error('刪除失敗:', error);
        alert('刪除失敗：' + error.message);
    }
    hideCardLoader();
}

async function toggleCardPublish(index, isPublished) {
    const card = characterCards[index];
    const level = document.querySelector('input[name="cardLevel"]:checked')?.value;
    const cardType = card.type || document.querySelector('input[name="cardType"]:checked')?.value || 'component';
    
    if (!level || !card.id) {
        alert('請先選擇等級');
        return;
    }
    
    showCardLoader();
    try {
        const collectionPath = cardType === 'component' 
            ? `timeline/${level}/components`
            : `timeline/${level}/target-characters`;
        
        const updateData = {
            is_published: isPublished
        };
        
        if (isPublished && !card.published_at) {
            updateData.published_at = new Date().toISOString();
        }
        
        await db.collection(collectionPath).doc(card.id).update(updateData);
        
        characterCards[index].is_published = isPublished;
        if (isPublished && !characterCards[index].published_at) {
            characterCards[index].published_at = updateData.published_at;
        }
        
        renderCharacterCardList();
    } catch (error) {
        console.error('更新失敗:', error);
        alert('更新失敗：' + error.message);
    }
    hideCardLoader();
}

async function batchPublishCards(publish) {
    const level = document.querySelector('input[name="cardLevel"]:checked')?.value;
    const lessonId = document.getElementById('cardLessonInput')?.value;
    const cardType = document.querySelector('input[name="cardType"]:checked')?.value || 'component';
    
    if (!level || !lessonId) {
        alert('請先選擇等級和課次');
        return;
    }
    
    if (characterCards.length === 0) {
        const typeLabel = cardType === 'component' ? '部件' : '目標字';
        alert(`沒有${typeLabel}可操作`);
        return;
    }
    
    const typeLabel = cardType === 'component' ? '部件' : '目標字';
    const action = publish ? '發布' : '取消發布';
    if (!confirm(`確定要${action}本課所有${typeLabel}嗎？`)) return;
    
    showCardLoader();
    try {
        const collectionPath = cardType === 'component' 
            ? `timeline/${level}/components`
            : `timeline/${level}/target-characters`;
        
        const now = new Date().toISOString();
        const batch = db.batch();
        
        characterCards.forEach(card => {
            if (!card.id) return;
            
            const updateData = {
                is_published: publish
            };
            
            if (publish && !card.published_at) {
                updateData.published_at = now;
            }
            
            const docRef = db.collection(collectionPath).doc(card.id);
            batch.update(docRef, updateData);
            
            card.is_published = publish;
            if (publish && !card.published_at) {
                card.published_at = now;
            }
        });
        
        await batch.commit();
        renderCharacterCardList();
        alert(publish ? `✅ 本課所有${typeLabel}已發布！` : `⛔ 本課所有${typeLabel}已取消發布`);
    } catch (error) {
        console.error('批量操作失敗:', error);
        alert('批量操作失敗：' + error.message);
    }
    hideCardLoader();
}

// 已移除：saveCharacterCardsToFirebase 函數，現在直接在 addCharacterCard 中儲存


function showCardLoader() {
    const loader = document.getElementById('cardLoader');
    if (loader) loader.style.display = 'block';
}

function hideCardLoader() {
    const loader = document.getElementById('cardLoader');
    if (loader) loader.style.display = 'none';
}

// ==================== Cloudinary 上傳整合 ====================
function initCloudinaryUpload() {
    if (typeof cloudinary === 'undefined') {
        console.warn('Cloudinary widget not loaded');
        return;
    }
    
    // 字形補丁圖片上傳
    const displayImageWidget = cloudinary.createUploadWidget({
        cloudName: 'dxc8rcjuh',
        uploadPreset: 'Elisa-BCT',
        folder: 'bct-lego/display-images',
        cropping: false,
        multiple: false,
        clientAllowedFormats: ['png', 'jpg', 'jpeg', 'webp'],
        maxFileSize: 10000000
    }, (error, result) => {
        if (!error && result && result.event === "success") {
            document.getElementById('cardDisplayImage').value = result.info.secure_url;
            document.getElementById('cardDisplayImageUploadProgress').style.display = 'none';
            alert('🖼️ 字形補丁圖片上傳成功！');
        }
    });
    
    document.getElementById('uploadCardDisplayImageBtn')?.addEventListener('click', () => {
        displayImageWidget.open();
    });
    
    // 輔助插圖上傳
    const imageWidget = cloudinary.createUploadWidget({
        cloudName: 'dxc8rcjuh',
        uploadPreset: 'Elisa-BCT',
        folder: 'bct-lego/images',
        cropping: false,
        multiple: false,
        clientAllowedFormats: ['png', 'jpg', 'jpeg', 'webp'],
        maxFileSize: 10000000
    }, (error, result) => {
        if (!error && result && result.event === "success") {
            document.getElementById('cardImage').value = result.info.secure_url;
            document.getElementById('cardImageUploadProgress').style.display = 'none';
            alert('🖼️ 輔助插圖上傳成功！');
        }
    });
    
    document.getElementById('uploadCardImageBtn')?.addEventListener('click', () => {
        imageWidget.open();
    });
}

// ==================== Studio 管理系統 ====================
let studioComponents = [];
let studioDebounceTimers = new Map();
let studioSortableFormList = null;
let studioSortablePreviewList = null;

function setupStudioSystem() {
    const levelSelect = document.getElementById('studio-level-select');
    const addBtn = document.getElementById('studio-add-btn');
    const sidebarToggle = document.getElementById('studio-sidebar-toggle');
    const collapseAllBtn = document.getElementById('studio-collapse-all-btn');
    const expandAllBtn = document.getElementById('studio-expand-all-btn');
    
    if (levelSelect) {
        levelSelect.addEventListener('change', (e) => {
            loadStudioComponents(e.target.value);
        });
    }
    
    if (addBtn) {
        addBtn.addEventListener('click', addStudioComponent);
    }
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const layout = document.getElementById('studio-layout');
            if (layout) {
                const isHidden = layout.classList.contains('sidebar-hidden');
                layout.classList.toggle('sidebar-hidden');
                // 更新按鈕文字和標題
                if (isHidden) {
                    sidebarToggle.textContent = '◀';
                    sidebarToggle.title = '隱藏編輯面板';
                } else {
                    sidebarToggle.textContent = '▶';
                    sidebarToggle.title = '顯示編輯面板';
                }
            }
        });
    }
    
    // 添加可調整寬度的拉條功能
    const resizer = document.getElementById('studio-resizer');
    if (resizer) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            const layout = document.getElementById('studio-layout');
            if (layout) {
                const computedStyle = window.getComputedStyle(layout);
                const currentWidth = parseFloat(computedStyle.getPropertyValue('--studio-sidebar-width')) || 40;
                startWidth = currentWidth;
                resizer.classList.add('dragging');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const layout = document.getElementById('studio-layout');
            if (layout) {
                const layoutRect = layout.getBoundingClientRect();
                const deltaX = e.clientX - startX;
                const percentage = (deltaX / layoutRect.width) * 100;
                let newWidth = startWidth + percentage;
                
                // 限制寬度範圍：5% - 60%（可以拉到極小）
                newWidth = Math.max(5, Math.min(60, newWidth));
                
                layout.style.setProperty('--studio-sidebar-width', `${newWidth}%`);
                
                // 如果寬度小於 10%，自動切換到最小化模式
                if (newWidth < 10 && !layout.classList.contains('sidebar-hidden')) {
                    layout.classList.add('sidebar-hidden');
                    const sidebarToggle = document.getElementById('studio-sidebar-toggle');
                    if (sidebarToggle) {
                        sidebarToggle.textContent = '▶';
                        sidebarToggle.title = '顯示編輯面板';
                    }
                } else if (newWidth >= 10 && layout.classList.contains('sidebar-hidden')) {
                    layout.classList.remove('sidebar-hidden');
                    const sidebarToggle = document.getElementById('studio-sidebar-toggle');
                    if (sidebarToggle) {
                        sidebarToggle.textContent = '◀';
                        sidebarToggle.title = '隱藏編輯面板';
                    }
                }
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
    
    // 全部折疊按鈕
    if (collapseAllBtn) {
        collapseAllBtn.addEventListener('click', () => {
            collapseAllStudioItems();
        });
    }

    // 全部展開按鈕
    if (expandAllBtn) {
        expandAllBtn.addEventListener('click', () => {
            expandAllStudioItems();
        });
    }
    
    // 初始化 Cloudinary 上傳功能（Studio 區塊）
    initStudioCloudinaryUpload();
    
    // 初始化時載入數據（等待 Firebase 初始化完成）
    setTimeout(() => {
        if (levelSelect && db) {
            loadStudioComponents(levelSelect.value);
        }
    }, 500);
}

async function loadStudioComponents(level) {
    if (!db) {
        console.warn('Firebase 尚未初始化');
        return;
    }
    
    try {
        const snapshot = await db.collection(`timeline/${level}/components`).get();
        studioComponents = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            studioComponents.push({
                id: doc.id,
                order: data.order !== undefined ? data.order : 999999,
                ...data
            });
        });
        
        // 按 order 排序
        studioComponents.sort((a, b) => {
            if (a.order !== b.order) return a.order - b.order;
            return a.id.localeCompare(b.id);
        });
        
        // 確保所有項目都有 order 字段
        studioComponents.forEach((comp, index) => {
            if (comp.order === undefined || comp.order === 999999) {
                comp.order = index;
            }
        });
        
        renderStudioFormList();
        renderStudioPreviewList();
        initStudioSortable();
    } catch (error) {
        console.error('載入 Studio components 失敗:', error);
        const formList = document.getElementById('studio-form-list');
        const previewList = document.getElementById('studio-preview-list');
        if (formList) {
            formList.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--danger);">載入失敗：${error.message}</div>`;
        }
        if (previewList) {
            previewList.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--danger);">載入失敗</div>`;
        }
    }
}

function renderStudioFormList() {
    const formList = document.getElementById('studio-form-list');
    if (!formList) return;
    
    formList.innerHTML = '';
    
    if (studioComponents.length === 0) {
        formList.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--muted);">尚無數據</div>';
        return;
    }
    
    studioComponents.forEach((comp, index) => {
        const formItem = createStudioFormItem(comp, index);
        formList.appendChild(formItem);
    });
}

function createStudioFormItem(comp, index) {
    const item = document.createElement('div');
    item.className = 'form-item';
    item.dataset.id = comp.id;
    item.dataset.index = index;
    // 添加折疊狀態數據屬性，預設為展開
    item.dataset.collapsed = 'false';
    
    item.innerHTML = `
        <div class="form-item-header">
            <span class="drag-handle">☰</span>
            <span>項目 #${index + 1}</span>
            <div style="display: flex; gap: 8px;">
                <button class="collapse-toggle" onclick="toggleStudioCollapse(${index})" title="折疊/展開">
                    ▼
                </button>
                <button class="btn-icon" onclick="openStudioTeachingModal(${index})" title="教學視圖">👁️</button>
            </div>
        </div>
        <div class="form-group character-group">
            <label>Character</label>
            <input type="text" data-field="character" value="${escapeHtml(comp.character || '')}" 
                   oninput="debounceStudioUpdate('${comp.id}', 'character', this.value)">
        </div>
        <div class="form-item-body">
            <div class="form-group">
                <label>Display Image (字形補丁圖片)</label>
                <input type="text" 
                       data-field="display_image" 
                       id="studio-display-image-${comp.id}"
                       value="${escapeHtml(comp.display_image || '')}" 
                       oninput="debounceStudioUpdate('${comp.id}', 'display_image', this.value)"
                       placeholder="https://res.cloudinary.com/... （上傳後自動填入）">
                <div style="margin-top: 12px;">
                    <button type="button" class="btn btn-secondary" id="studio-upload-display-image-${comp.id}" 
                            style="padding: 8px 12px; font-size: 13px;">
                        🖼️ 上傳字形補丁圖片到 Cloudinary
                    </button>
                    <div id="studio-display-image-progress-${comp.id}" style="margin-top: 10px; display: none;">
                        <div style="background: #eee; height: 8px; border-radius: 4px; overflow: hidden;">
                            <div id="studio-display-image-progress-bar-${comp.id}" style="height: 100%; background: var(--primary); width: 0%; transition: width 0.3s;"></div>
                        </div>
                        <small id="studio-display-image-progress-text-${comp.id}" style="color: var(--primary); font-weight: bold;">上傳中 0%</small>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>Pinyin</label>
                <input type="text" data-field="pinyin" value="${escapeHtml(comp.pinyin || '')}" 
                       oninput="debounceStudioUpdate('${comp.id}', 'pinyin', this.value)">
            </div>
            <div class="form-group">
                <label>Markdown Content</label>
                <textarea data-field="notes" oninput="debounceStudioUpdate('${comp.id}', 'notes', this.value)" 
                          style="min-height: 100px; font-family: monospace;">${escapeHtml(comp.notes || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Image URL (輔助插圖)</label>
                <input type="text" 
                       data-field="image" 
                       id="studio-image-${comp.id}"
                       value="${escapeHtml(comp.image || '')}" 
                       oninput="debounceStudioUpdate('${comp.id}', 'image', this.value)"
                       placeholder="https://res.cloudinary.com/... （上傳後自動填入）">
                <div style="margin-top: 12px;">
                    <button type="button" class="btn btn-secondary" id="studio-upload-image-${comp.id}" 
                            style="padding: 8px 12px; font-size: 13px;">
                        🖼️ 上傳輔助插圖到 Cloudinary
                    </button>
                    <div id="studio-image-progress-${comp.id}" style="margin-top: 10px; display: none;">
                        <div style="background: #eee; height: 8px; border-radius: 4px; overflow: hidden;">
                            <div id="studio-image-progress-bar-${comp.id}" style="height: 100%; background: var(--primary); width: 0%; transition: width 0.3s;"></div>
                        </div>
                        <small id="studio-image-progress-text-${comp.id}" style="color: var(--primary); font-weight: bold;">上傳中 0%</small>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" ${comp.published !== false ? 'checked' : ''} 
                           onchange="updateStudioField('${comp.id}', 'published', this.checked)">
                    Published (發布給 Review 系統)
                    <button class="btn-icon delete" onclick="deleteStudioComponent(${index})" title="刪除" style="margin-left: auto;">🗑️</button>
                </label>
            </div>
        </div>
    `;
    
    return item;
}

function renderStudioPreviewList() {
    const previewList = document.getElementById('studio-preview-list');
    if (!previewList) return;
    
    previewList.innerHTML = '';
    
    if (studioComponents.length === 0) {
        previewList.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--muted);">尚無預覽內容</div>';
        return;
    }
    
    studioComponents.forEach((comp, index) => {
        const card = createStudioPreviewCard(comp, index);
        previewList.appendChild(card);
    });
}

function createStudioPreviewCard(comp, index) {
    const card = document.createElement('div');
    card.className = 'timeline-card';
    if (comp.isCharacterCard) card.classList.add('character-card');
    card.style.cursor = 'pointer';
    card.dataset.id = comp.id;
    card.dataset.index = index;
    
    // 單擊：打開教學模態框
    card.onclick = () => openStudioTeachingModal(index);
    
    // 雙擊：跳轉到對應的編輯表單項目
    card.ondblclick = () => scrollToStudioFormItem(comp.id, index);
    
    // 字
    const charDiv = document.createElement('div');
    charDiv.className = 'line-character';
    if (comp.character && comp.character.trim()) {
        charDiv.innerHTML = comp.character;
    } else if (comp.display_image && comp.display_image.trim()) {
        charDiv.innerHTML = `<img src="${comp.display_image}" class="img-comp" alt="comp" style="height: 1.8em; width: auto; vertical-align: middle;">`;
    }
    card.appendChild(charDiv);
    
    // 拼音
    if (comp.pinyin) {
        const pinyinDiv = document.createElement('div');
        pinyinDiv.className = 'line-pinyin';
        pinyinDiv.textContent = comp.pinyin;
        card.appendChild(pinyinDiv);
    }
    
    // 意思
    if (comp.meaning) {
        const meaningDiv = document.createElement('div');
        meaningDiv.className = 'line-en';
        meaningDiv.textContent = comp.meaning;
        card.appendChild(meaningDiv);
    }
    
    // 圖片
    if (comp.image && comp.image.trim()) {
        const imageDiv = document.createElement('div');
        imageDiv.style.marginTop = '10px';
        imageDiv.innerHTML = `<img src="${comp.image}" style="max-width:100%;border-radius:6px;" onerror="this.style.display='none';">`;
        card.appendChild(imageDiv);
    }
    
    // Markdown 內容
    if (comp.notes) {
        const notesDiv = document.createElement('div');
        notesDiv.className = 'timeline-notes markdown-body';
        if (typeof renderMarkdown === 'function') {
            notesDiv.innerHTML = renderMarkdown(comp.notes);
        } else {
            notesDiv.textContent = comp.notes;
        }
        card.appendChild(notesDiv);
    }
    
    return card;
}

function initStudioSortable() {
    const formList = document.getElementById('studio-form-list');
    const previewList = document.getElementById('studio-preview-list');
    
    if (studioSortableFormList) studioSortableFormList.destroy();
    if (studioSortablePreviewList) studioSortablePreviewList.destroy();
    
    if (formList && typeof Sortable !== 'undefined') {
        studioSortableFormList = new Sortable(formList, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: (evt) => handleStudioSort(evt)
        });
    }
    
    if (previewList && typeof Sortable !== 'undefined') {
        studioSortablePreviewList = new Sortable(previewList, {
            handle: '.timeline-card',
            animation: 150,
            onEnd: (evt) => handleStudioSort(evt)
        });
    }
}

function handleStudioSort(evt) {
    const { oldIndex, newIndex } = evt;
    if (oldIndex === newIndex) return;
    
    const [moved] = studioComponents.splice(oldIndex, 1);
    studioComponents.splice(newIndex, 0, moved);
    
    studioComponents.forEach((comp, index) => {
        comp.order = index;
        updateStudioField(comp.id, 'order', index, false);
    });
    
    renderStudioFormList();
    renderStudioPreviewList();
    initStudioSortable();
}

function debounceStudioUpdate(componentId, field, value) {
    const timerKey = `${componentId}-${field}`;
    if (studioDebounceTimers.has(timerKey)) {
        clearTimeout(studioDebounceTimers.get(timerKey));
    }
    
    const timer = setTimeout(() => {
        updateStudioField(componentId, field, value);
        studioDebounceTimers.delete(timerKey);
    }, 1000);
    
    studioDebounceTimers.set(timerKey, timer);
}

async function updateStudioField(componentId, field, value, shouldRerender = true) {
    if (!db) return;
    
    try {
        const component = studioComponents.find(c => c.id === componentId);
        if (!component) return;
        
        component[field] = value;
        
        const level = document.getElementById('studio-level-select')?.value || 'btc1';
        await db.collection(`timeline/${level}/components`).doc(componentId).update({
            [field]: value
        });
        
        if (shouldRerender && ['character', 'pinyin', 'notes', 'image', 'meaning'].includes(field)) {
            renderStudioPreviewList();
        }
    } catch (error) {
        console.error('更新失敗:', error);
        alert('更新失敗：' + error.message);
    }
}

async function addStudioComponent() {
    if (!db) {
        alert('Firebase 尚未初始化');
        return;
    }
    
    try {
        const level = document.getElementById('studio-level-select')?.value || 'btc1';
        const newComponent = {
            character: '',
            pinyin: '',
            notes: '',
            image: '',
            published: true,
            order: studioComponents.length
        };
        
        const docRef = await db.collection(`timeline/${level}/components`).add(newComponent);
        await loadStudioComponents(level);
        
        setTimeout(() => {
            const newItem = document.querySelector(`[data-id="${docRef.id}"]`);
            if (newItem) {
                newItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                newItem.classList.add('active');
                const firstInput = newItem.querySelector('input[data-field="character"]');
                if (firstInput) firstInput.focus();
            }
        }, 100);
    } catch (error) {
        console.error('添加失敗:', error);
        alert('添加失敗：' + error.message);
    }
}

async function deleteStudioComponent(index) {
    if (!confirm('確定要刪除這個項目嗎？')) return;
    
    if (!db) {
        alert('Firebase 尚未初始化');
        return;
    }
    
    try {
        const component = studioComponents[index];
        const level = document.getElementById('studio-level-select')?.value || 'btc1';
        
        await db.collection(`timeline/${level}/components`).doc(component.id).delete();
        studioComponents.splice(index, 1);
        
        studioComponents.forEach((comp, idx) => {
            comp.order = idx;
            updateStudioField(comp.id, 'order', idx, false);
        });
        
        renderStudioFormList();
        renderStudioPreviewList();
        initStudioSortable();
    } catch (error) {
        console.error('刪除失敗:', error);
        alert('刪除失敗：' + error.message);
    }
}

function scrollToStudioFormItem(componentId, index) {
    // 檢查編輯面板是否被最小化，如果是則展開
    const layout = document.getElementById('studio-layout');
    const sidebarToggle = document.getElementById('studio-sidebar-toggle');
    
    if (layout && layout.classList.contains('sidebar-hidden')) {
        layout.classList.remove('sidebar-hidden');
        if (sidebarToggle) {
            sidebarToggle.textContent = '◀';
            sidebarToggle.title = '隱藏編輯面板';
        }
    }
    
    // 找到對應的編輯表單項目
    const formList = document.getElementById('studio-form-list');
    if (!formList) return;
    
    const formItem = formList.querySelector(`[data-id="${componentId}"]`);
    if (formItem) {
        // 滾動到該項目
        formItem.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }
}

function openStudioTeachingModal(index) {
    const component = studioComponents[index];
    if (!component) return;
    
    // 創建模態框（如果不存在）
    let modal = document.getElementById('studio-teaching-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'studio-teaching-modal';
        modal.className = 'teaching-modal';
        modal.innerHTML = `
            <div class="teaching-modal-content">
                <div class="teaching-modal-header">
                    <h3>教學視圖</h3>
                    <button onclick="closeStudioTeachingModal()" style="border: none; background: transparent; font-size: 1.5rem; cursor: pointer; color: var(--muted);">×</button>
                </div>
                <div class="teaching-modal-body" id="studio-modal-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // 點擊背景關閉
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeStudioTeachingModal();
            }
        });
    }
    
    const modalBody = document.getElementById('studio-modal-body');
    const card = createStudioPreviewCard(component, index);
    modalBody.innerHTML = '';
    modalBody.appendChild(card);
    
    modal.classList.add('active');
}

function closeStudioTeachingModal() {
    const modal = document.getElementById('studio-teaching-modal');
    if (modal) modal.classList.remove('active');
}

function toggleStudioCollapse(index) {
    const formList = document.getElementById('studio-form-list');
    if (!formList) return;
    
    const items = formList.querySelectorAll('.form-item');
    const item = items[index];
    
    if (!item) return;
    
    const isCollapsed = item.dataset.collapsed === 'true';
    item.dataset.collapsed = isCollapsed ? 'false' : 'true';
    item.classList.toggle('collapsed', !isCollapsed);
    
    // 更新按鈕圖標
    const toggleBtn = item.querySelector('.collapse-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = isCollapsed ? '▼' : '▶';
    }
}

function collapseAllStudioItems() {
    const formList = document.getElementById('studio-form-list');
    if (!formList) return;
    
    const items = formList.querySelectorAll('.form-item');
    items.forEach((item) => {
        item.dataset.collapsed = 'true';
        item.classList.add('collapsed');
        const toggleBtn = item.querySelector('.collapse-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = '▶';
        }
    });
}

function expandAllStudioItems() {
    const formList = document.getElementById('studio-form-list');
    if (!formList) return;
    
    const items = formList.querySelectorAll('.form-item');
    items.forEach((item) => {
        item.dataset.collapsed = 'false';
        item.classList.remove('collapsed');
        const toggleBtn = item.querySelector('.collapse-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = '▼';
        }
    });
}

function initStudioCloudinaryUpload() {
    if (typeof cloudinary === 'undefined') {
        console.warn('Cloudinary widget not loaded');
        return;
    }
    
    // Studio 區塊的字形補丁圖片上傳 widget
    const studioDisplayImageWidget = cloudinary.createUploadWidget({
        cloudName: 'dxc8rcjuh',
        uploadPreset: 'Elisa-BCT',
        folder: 'bct-lego/display-images',
        cropping: false,
        multiple: false,
        clientAllowedFormats: ['png', 'jpg', 'jpeg', 'webp'],
        maxFileSize: 10000000
    }, (error, result) => {
        if (error) {
            console.error('Cloudinary 上傳錯誤:', error);
            return;
        }
        
        if (result && result.event === "success") {
            const componentId = window.currentStudioUploadComponentId;
            if (componentId) {
                const input = document.getElementById(`studio-display-image-${componentId}`);
                if (input) {
                    input.value = result.info.secure_url;
                    // 自動更新 Firestore
                    updateStudioField(componentId, 'display_image', result.info.secure_url);
                    // 隱藏進度條
                    const progressDiv = document.getElementById(`studio-display-image-progress-${componentId}`);
                    if (progressDiv) {
                        progressDiv.style.display = 'none';
                    }
                }
            }
        }
        
        // 上傳進度
        if (result && result.event === "progress") {
            const componentId = window.currentStudioUploadComponentId;
            if (componentId) {
                const progressBar = document.getElementById(`studio-display-image-progress-bar-${componentId}`);
                const progressText = document.getElementById(`studio-display-image-progress-text-${componentId}`);
                const progressDiv = document.getElementById(`studio-display-image-progress-${componentId}`);
                
                if (progressBar && progressText && progressDiv) {
                    const percent = Math.round(result.info.progress);
                    progressBar.style.width = `${percent}%`;
                    progressText.textContent = `上傳中 ${percent}%`;
                    progressDiv.style.display = 'block';
                }
            }
        }
    });
    
    // Studio 區塊的輔助插圖上傳 widget
    const studioImageWidget = cloudinary.createUploadWidget({
        cloudName: 'dxc8rcjuh',
        uploadPreset: 'Elisa-BCT',
        folder: 'bct-lego/images',
        cropping: false,
        multiple: false,
        clientAllowedFormats: ['png', 'jpg', 'jpeg', 'webp'],
        maxFileSize: 10000000
    }, (error, result) => {
        if (error) {
            console.error('Cloudinary 上傳錯誤:', error);
            return;
        }
        
        if (result && result.event === "success") {
            const componentId = window.currentStudioUploadComponentId;
            if (componentId) {
                const input = document.getElementById(`studio-image-${componentId}`);
                if (input) {
                    input.value = result.info.secure_url;
                    // 自動更新 Firestore
                    updateStudioField(componentId, 'image', result.info.secure_url);
                    // 隱藏進度條
                    const progressDiv = document.getElementById(`studio-image-progress-${componentId}`);
                    if (progressDiv) {
                        progressDiv.style.display = 'none';
                    }
                }
            }
        }
        
        // 上傳進度
        if (result && result.event === "progress") {
            const componentId = window.currentStudioUploadComponentId;
            if (componentId) {
                const progressBar = document.getElementById(`studio-image-progress-bar-${componentId}`);
                const progressText = document.getElementById(`studio-image-progress-text-${componentId}`);
                const progressDiv = document.getElementById(`studio-image-progress-${componentId}`);
                
                if (progressBar && progressText && progressDiv) {
                    const percent = Math.round(result.info.progress);
                    progressBar.style.width = `${percent}%`;
                    progressText.textContent = `上傳中 ${percent}%`;
                    progressDiv.style.display = 'block';
                }
            }
        }
    });
    
    // 使用事件委派處理動態生成的按鈕
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id) {
            // 字形補丁圖片上傳
            if (e.target.id.startsWith('studio-upload-display-image-')) {
                const componentId = e.target.id.replace('studio-upload-display-image-', '');
                window.currentStudioUploadComponentId = componentId;
                if (studioDisplayImageWidget) {
                    studioDisplayImageWidget.open();
                }
            }
            // 輔助插圖上傳
            else if (e.target.id.startsWith('studio-upload-image-')) {
                const componentId = e.target.id.replace('studio-upload-image-', '');
                window.currentStudioUploadComponentId = componentId;
                if (studioImageWidget) {
                    studioImageWidget.open();
                }
            }
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== Live Note 系統 ====================
let currentLiveNoteId = null;
let currentLiveNoteLevel = 'btc1';
let currentLiveNoteLesson = '';
let liveNoteSaveTimeout = null;
let liveNoteCohort = 'taigen-a'; // 預設班級

function setupLiveNoteSystem() {
    // 綁定事件
    const levelSelect = document.getElementById('live-note-level-select');
    const lessonSelect = document.getElementById('live-note-lesson-select');
    const noteSelect = document.getElementById('live-note-select');
    const titleInput = document.getElementById('live-note-title');
    const contentInput = document.getElementById('live-note-content');
    const newBtn = document.getElementById('live-note-new-btn');
    const saveBtn = document.getElementById('live-note-save-btn');
    const deleteBtn = document.getElementById('live-note-delete-btn');
    const sidebarToggle = document.getElementById('live-note-sidebar-toggle');
    const resizer = document.getElementById('live-note-resizer');

    if (!levelSelect || !lessonSelect || !noteSelect || !titleInput || !contentInput) {
        console.warn('Live Note 元素未找到，跳過初始化');
        return;
    }

    // 初始化課次選項
    renderLiveNoteLessonOptions();

    // Level 變更
    levelSelect.addEventListener('change', async (e) => {
        currentLiveNoteLevel = e.target.value;
        renderLiveNoteLessonOptions();
        await loadLiveNoteList();
    });

    // Lesson 變更
    lessonSelect.addEventListener('change', async (e) => {
        currentLiveNoteLesson = e.target.value;
        await loadLiveNoteList();
    });

    // Note 選擇變更
    noteSelect.addEventListener('change', async (e) => {
        const noteId = e.target.value;
        if (noteId) {
            await loadLiveNote(noteId);
        } else {
            clearLiveNoteForm();
        }
    });

    // 新增筆記
    newBtn.addEventListener('click', () => {
        clearLiveNoteForm();
        currentLiveNoteId = null;
        noteSelect.value = '';
        deleteBtn.style.display = 'none';
        updateLiveNoteStatus('已清空表單，可以開始輸入新筆記');
    });

    // 手動保存
    saveBtn.addEventListener('click', async () => {
        await saveLiveNote();
    });

    // 刪除筆記
    deleteBtn.addEventListener('click', async () => {
        if (confirm('確定要刪除這則筆記嗎？此操作無法復原。')) {
            await deleteLiveNote();
        }
    });

    // 標題輸入 - 自動保存
    titleInput.addEventListener('input', () => {
        debounceLiveNoteUpdate();
    });

    // 內容輸入 - 自動保存 + 即時預覽
    contentInput.addEventListener('input', () => {
        debounceLiveNoteUpdate();
        updateLiveNotePreview();
    });

    // 側邊欄切換
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const editor = document.getElementById('live-note-editor');
            if (editor) {
                editor.classList.toggle('minimized');
                sidebarToggle.textContent = editor.classList.contains('minimized') ? '▶' : '◀';
            }
        });
    }

    // 可調整寬度的拉條
    if (resizer) {
        let isResizing = false;
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', () => {
                isResizing = false;
                document.removeEventListener('mousemove', handleResize);
            });
        });

        function handleResize(e) {
            if (!isResizing) return;
            const layout = document.getElementById('live-note-layout');
            if (!layout) return;
            
            const rect = layout.getBoundingClientRect();
            const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;
            
            if (newLeftWidth >= 5 && newLeftWidth <= 60) {
                document.documentElement.style.setProperty('--live-note-editor-width', `${newLeftWidth}%`);
            }
        }
    }

    // 初始化預覽
    updateLiveNotePreview();
}

function renderLiveNoteLessonOptions() {
    const lessonSelect = document.getElementById('live-note-lesson-select');
    if (!lessonSelect) return;

    lessonSelect.innerHTML = '<option value="">選擇課次...</option>';
    lessons.forEach(lesson => {
        const option = document.createElement('option');
        option.value = lesson;
        option.textContent = `Lesson ${lesson.replace('lesson', '')}`;
        lessonSelect.appendChild(option);
    });
}

async function loadLiveNoteList() {
    const noteSelect = document.getElementById('live-note-select');
    if (!noteSelect || !currentLiveNoteLevel || !currentLiveNoteLesson) {
        if (noteSelect) {
            noteSelect.innerHTML = '<option value="">請先選擇等級和課次</option>';
        }
        return;
    }

    try {
        noteSelect.innerHTML = '<option value="">載入中...</option>';
        
        // 讀取兩個班級的筆記
        const notes = [];
        for (const cohort of ['taigen-a', 'taigen-b']) {
            try {
                const snapshot = await db
                    .collection('timeline')
                    .doc(currentLiveNoteLevel)
                    .collection('notes')
                    .doc(cohort)
                    .collection('items')
                    .where('lesson', '==', currentLiveNoteLesson)
                    .get();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    notes.push({
                        id: doc.id,
                        cohort: cohort,
                        title: data.title || '（無標題）',
                        ...data
                    });
                });
            } catch (error) {
                console.warn(`載入 ${cohort} 筆記時出錯:`, error);
            }
        }

        // 按標題排序
        notes.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

        noteSelect.innerHTML = '<option value="">選擇或新增筆記...</option>';
        notes.forEach(note => {
            const option = document.createElement('option');
            option.value = note.id;
            option.textContent = `${note.title} (${note.cohort})`;
            option.dataset.cohort = note.cohort;
            noteSelect.appendChild(option);
        });

        if (notes.length === 0) {
            noteSelect.innerHTML = '<option value="">尚無筆記，請新增</option>';
        }
    } catch (error) {
        console.error('載入筆記列表失敗:', error);
        const noteSelect = document.getElementById('live-note-select');
        if (noteSelect) {
            noteSelect.innerHTML = '<option value="">載入失敗</option>';
        }
    }
}

async function loadLiveNote(noteId) {
    const noteSelect = document.getElementById('live-note-select');
    const titleInput = document.getElementById('live-note-title');
    const contentInput = document.getElementById('live-note-content');
    const deleteBtn = document.getElementById('live-note-delete-btn');
    
    if (!noteSelect || !titleInput || !contentInput) return;

    const selectedOption = noteSelect.options[noteSelect.selectedIndex];
    const cohort = selectedOption?.dataset.cohort || 'taigen-a';
    liveNoteCohort = cohort;

    try {
        const doc = await db
            .collection('timeline')
            .doc(currentLiveNoteLevel)
            .collection('notes')
            .doc(cohort)
            .collection('items')
            .doc(noteId)
            .get();

        if (doc.exists) {
            const data = doc.data();
            currentLiveNoteId = noteId;
            titleInput.value = data.title || '';
            contentInput.value = data.content || '';
            if (deleteBtn) deleteBtn.style.display = 'inline-block';
            updateLiveNotePreview();
            updateLiveNoteStatus('筆記已載入');
        } else {
            updateLiveNoteStatus('筆記不存在');
        }
    } catch (error) {
        console.error('載入筆記失敗:', error);
        updateLiveNoteStatus('載入失敗');
    }
}

async function saveLiveNote() {
    const titleInput = document.getElementById('live-note-title');
    const contentInput = document.getElementById('live-note-content');
    
    if (!titleInput || !contentInput) return;

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!title && !content) {
        updateLiveNoteStatus('標題和內容不能同時為空');
        return;
    }

    if (!currentLiveNoteLevel || !currentLiveNoteLesson) {
        updateLiveNoteStatus('請先選擇等級和課次');
        return;
    }

    try {
        const noteData = {
            title: title || '（無標題）',
            content: content,
            lesson: currentLiveNoteLesson,
            type: 'note',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!currentLiveNoteId) {
            noteData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        if (currentLiveNoteId) {
            // 更新現有筆記
            await db
                .collection('timeline')
                .doc(currentLiveNoteLevel)
                .collection('notes')
                .doc(liveNoteCohort)
                .collection('items')
                .doc(currentLiveNoteId)
                .update(noteData);
            
            updateLiveNoteStatus('✅ 筆記已更新');
        } else {
            // 新增筆記
            const docRef = await db
                .collection('timeline')
                .doc(currentLiveNoteLevel)
                .collection('notes')
                .doc(liveNoteCohort)
                .collection('items')
                .add(noteData);
            
            currentLiveNoteId = docRef.id;
            const deleteBtn = document.getElementById('live-note-delete-btn');
            if (deleteBtn) deleteBtn.style.display = 'inline-block';
            
            // 更新選擇器
            await loadLiveNoteList();
            const noteSelect = document.getElementById('live-note-select');
            if (noteSelect) {
                noteSelect.value = currentLiveNoteId;
            }
            
            updateLiveNoteStatus('✅ 筆記已新增');
        }
    } catch (error) {
        console.error('保存筆記失敗:', error);
        updateLiveNoteStatus('❌ 保存失敗');
    }
}

async function deleteLiveNote() {
    if (!currentLiveNoteId || !currentLiveNoteLevel) return;

    try {
        await db
            .collection('timeline')
            .doc(currentLiveNoteLevel)
            .collection('notes')
            .doc(liveNoteCohort)
            .collection('items')
            .doc(currentLiveNoteId)
            .delete();

        clearLiveNoteForm();
        await loadLiveNoteList();
        updateLiveNoteStatus('✅ 筆記已刪除');
    } catch (error) {
        console.error('刪除筆記失敗:', error);
        updateLiveNoteStatus('❌ 刪除失敗');
    }
}

function clearLiveNoteForm() {
    const titleInput = document.getElementById('live-note-title');
    const contentInput = document.getElementById('live-note-content');
    const deleteBtn = document.getElementById('live-note-delete-btn');
    
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    if (deleteBtn) deleteBtn.style.display = 'none';
    
    currentLiveNoteId = null;
    updateLiveNotePreview();
}

function debounceLiveNoteUpdate() {
    clearTimeout(liveNoteSaveTimeout);
    liveNoteSaveTimeout = setTimeout(() => {
        saveLiveNote();
    }, 2000); // 2 秒後自動保存
}

function updateLiveNotePreview() {
    const contentInput = document.getElementById('live-note-content');
    const previewContent = document.getElementById('live-note-preview-content');
    
    if (!contentInput || !previewContent) return;

    const content = contentInput.value.trim();
    
    if (!content) {
        previewContent.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--muted);">請在左側輸入內容以查看預覽</div>';
        return;
    }

    // 使用 renderMarkdown 函數（如果存在）
    if (typeof renderMarkdown === 'function') {
        previewContent.innerHTML = renderMarkdown(content);
    } else if (typeof marked !== 'undefined') {
        // 備用方案：直接使用 marked
        previewContent.innerHTML = marked.parse(content);
    } else {
        previewContent.innerHTML = '<div style="padding: 20px; color: #666;">Markdown 渲染器未載入</div>';
    }
}

function updateLiveNoteStatus(message) {
    const statusEl = document.getElementById('live-note-status');
    if (statusEl) {
        statusEl.textContent = message;
        setTimeout(() => {
            if (statusEl.textContent === message) {
                statusEl.textContent = '';
            }
        }, 3000);
    }
}

