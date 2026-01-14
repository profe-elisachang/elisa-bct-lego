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
    radios.forEach(r => {
        r.addEventListener('change', () => {
            const isNote = r.value === 'note';
            document.querySelectorAll('.type-note').forEach(el => el.classList.toggle('hidden', !isNote));
            document.querySelectorAll('.type-vocab').forEach(el => el.classList.toggle('hidden', isNote));
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
        document.getElementById('adminStatus').textContent = '已驗證';
        return;
    }
    const input = prompt('請輸入老師密碼：');
    if (input !== teacherPassword) {
        alert('密碼錯誤');
        window.location.href = 'index.html';
        return;
    }
    localStorage.setItem('teacher_auth', input);
    document.getElementById('adminStatus').textContent = '已驗證';
}

async function initFirebase() {
    if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
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

    if (!date || !lesson) {
        alert('請填日期與課次');
        return;
    }

    if (type !== 'note') {
        const ch = document.getElementById('characterInput').value.trim();
        const py = document.getElementById('pinyinInput').value.trim();
        const me = document.getElementById('meaningInput').value.trim();
        if (!ch || !py || !me) {
            alert('請填寫漢字、拼音、意思');
            return;
        }
    }

    let data = {
        type,
        source: 'timeline',
        lesson,
        date,
        review: type !== 'note',
        timestamp: new Date().toISOString()
    };

    if (type === 'note') {
        data.title = document.getElementById('noteTitleInput').value;
        data.content = document.getElementById('noteContentInput').value;
    } else {
        data.character = document.getElementById('characterInput').value;
        data.pinyin = document.getElementById('pinyinInput').value;
        data.meaning = document.getElementById('meaningInput').value;
        data.notes = document.getElementById('notesInput').value;
    }

    const todayDoc = `timeline-${date}`;
    const coll = type === 'component' ? 'components' : type === 'vocab' ? 'vocabulary' : 'notes';

    try {
        await db.collection('timeline').doc(todayDoc).set({
            scope: 'timeline',
            date,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await db.collection('timeline').doc(todayDoc).collection(coll).add(data);

        dlog('TA2','timeline-admin:addEntry','write success',{coll, lesson, type});
        alert('儲存成功！');
        clearForm(type);
        await refreshList();
    } catch (error) {
        console.error(error);
        dlog('TA2','timeline-admin:addEntry','write failed',{message:error.message});
        alert('儲存失敗：' + error.message);
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
    const lesson = document.getElementById('filterLesson').value;
    const keyword = document.getElementById('keywordInput').value.trim().toLowerCase();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const types = Array.from(document.querySelectorAll('input[name="filterType"]:checked')).map(i=>i.value);

    dlog('TA3','timeline-admin:refreshList','query start',{lesson, keyword, types, startDate, endDate});

    const [compSnap, vocabSnap, noteSnap] = await Promise.all([
        db.collectionGroup('components').get(),
        db.collectionGroup('vocabulary').get(),
        db.collectionGroup('notes').get()
    ]);

    const items = [];
    const pushItem = (doc, type) => {
        const data = doc.data();
        items.push({
            id: doc.id,
            path: doc.ref.path,
            type,
            lesson: data.lesson,
            date: data.date,
            character: data.character,
            pinyin: data.pinyin,
            meaning: data.meaning,
            notes: data.notes,
            title: data.title,
            content: data.content,
            timestamp: data.timestamp
        });
    };

    compSnap.forEach(doc => pushItem(doc,'component'));
    vocabSnap.forEach(doc => pushItem(doc,'vocab'));
    noteSnap.forEach(doc => pushItem(doc,'note'));

    let filtered = items.filter(item => types.includes(item.type));
    if (lesson) filtered = filtered.filter(i => i.lesson === lesson);
    if (startDate) filtered = filtered.filter(i => (i.date || '') >= startDate);
    if (endDate) filtered = filtered.filter(i => (i.date || '') <= endDate);
    if (keyword) {
        filtered = filtered.filter(i => {
            const hay = [
                i.character, i.pinyin, i.meaning, i.notes,
                i.title, i.content
            ].join(' ').toLowerCase();
            return hay.includes(keyword);
        });
    }

    filtered.sort((a,b) => {
        const ta = (a.date || '') + (a.timestamp || '');
        const tb = (b.date || '') + (b.timestamp || '');
        return tb.localeCompare(ta);
    });

    allItems = filtered;
    currentPage = 1;
    renderList();
    dlog('TA3','timeline-admin:refreshList','query done',{count: filtered.length});
}

function renderList() {
    const list = document.getElementById('entryList');
    const stats = document.getElementById('listStats');
    if (!allItems.length) {
        list.innerHTML = `<div class="no-data">尚無資料</div>`;
        stats.textContent = '共 0 筆';
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
        const main = item.type === 'note'
            ? (item.title || '(無標題)')
            : [item.character, item.pinyin].filter(Boolean).join(' · ');
        const sub = item.type === 'note'
            ? (item.content || '')
            : (item.meaning || '');
        return `
            <div class="entry-row">
                <div class="text-muted">${item.date || '-'}</div>
                <div>${item.lesson || '-'}</div>
                <div>${typeTag}</div>
                <div class="line-tight">
                    <div>${main}</div>
                    <div class="text-muted">${sub}</div>
                </div>
                <div>
                    <button class="btn btn-danger btn-sm" onclick="deleteItem('${item.type}','${item.path}')">刪除</button>
                </div>
            </div>
        `;
    }).join('');

    stats.textContent = `共 ${allItems.length} 筆`;
    document.getElementById('pageInfo').textContent = `${currentPage} / ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

function changePage(delta) {
    currentPage += delta;
    renderList();
}

async function deleteItem(type, path) {
    if (!confirm('確定刪除這筆資料？')) return;
    try {
        await db.doc(path).delete();
        dlog('TA4','timeline-admin:delete','delete success',{type, path});
        await refreshList();
    } catch (error) {
        console.error(error);
        dlog('TA4','timeline-admin:delete','delete failed',{message:error.message});
        alert('刪除失敗：' + error.message);
    }
}

