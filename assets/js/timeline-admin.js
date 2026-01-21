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

