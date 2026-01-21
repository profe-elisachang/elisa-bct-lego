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
    initDateDefaults();
    renderLessonOptions();
    setupTypeToggle();
    setupFilters();
    await ensureAuth();
    await initFirebase();
    bindActions();
    await refreshList();
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
    lessons.forEach(id => {
        const opt1 = document.createElement('option');
        opt1.value = id;
        opt1.textContent = id.replace('lesson','Lesson ');
        lessonSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = id;
        opt2.textContent = id.replace('lesson','Lesson ');
        filterSelect.appendChild(opt2);
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
    if (!auth.currentUser || !auth.currentUser.isAnonymous) {
        try {
            await auth.signInAnonymously();
            // Wait for auth state to settle
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Auth timeout')), 5000);
                const unsub = auth.onAuthStateChanged((user) => {
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
            console.warn('Anonymous sign-in failed:', authError);
            // Don't throw - allow page to continue (may fail later on Firestore access)
        }
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

