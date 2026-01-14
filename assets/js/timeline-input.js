// Timeline Input Interface with Password Protection
// Teacher-only interface for adding supplementary content

const TEACHER_PASSWORD = 'yainu8up';
let db = null;
let todayDate = '';
let entryCountToday = 0;

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
try {
    // Avoid "Firebase App named '[DEFAULT]' already exists" in case of repeated loads
    if (firebase.apps && firebase.apps.length > 0) {
        db = firebase.firestore();
    } else {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    }
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            sessionId:'debug-session',
            runId:'baseline',
            hypothesisId:'T1',
            location:'assets/js/timeline-input.js:firebaseInit',
            message:'Firebase init ok',
            data:{apps:(firebase.apps?firebase.apps.length:null), projectId:firebaseConfig.projectId},
            timestamp:Date.now()
        })
    }).catch(()=>{});
    // #endregion
} catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            sessionId:'debug-session',
            runId:'baseline',
            hypothesisId:'T1',
            location:'assets/js/timeline-input.js:firebaseInit',
            message:'Firebase init failed',
            data:{message:error?.message||'unknown', stack:(error?.stack||'').slice(0,200)},
            timestamp:Date.now()
        })
    }).catch(()=>{});
    // #endregion
}

// Password Protection
window.addEventListener('DOMContentLoaded', async () => {
    const savedAuth = localStorage.getItem('teacher_auth');
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            sessionId:'debug-session',
            runId:'baseline',
            hypothesisId:'T2',
            location:'assets/js/timeline-input.js:DOMContentLoaded',
            message:'Teacher auth check',
            data:{hasSavedAuth:!!savedAuth},
            timestamp:Date.now()
        })
    }).catch(()=>{});
    // #endregion

    if (savedAuth === TEACHER_PASSWORD) {
        // Already authenticated
        await initTimelineInterface();
        return;
    }

    // Show password prompt
    const password = prompt('請輸入老師密碼：');

    if (password !== TEACHER_PASSWORD) {
        alert('密碼錯誤！');
        window.location.href = 'index.html';
        return;
    }

    // Save authentication
    localStorage.setItem('teacher_auth', password);
    await initTimelineInterface();
});

// Initialize Timeline Interface
async function initTimelineInterface() {
    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'block';

    // Set current date
    todayDate = new Date().toISOString().split('T')[0];
    document.getElementById('currentDate').textContent = todayDate;

    // Setup type radio button listeners
    setupTypeRadios();
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            sessionId:'debug-session',
            runId:'baseline',
            hypothesisId:'T3',
            location:'assets/js/timeline-input.js:initTimelineInterface',
            message:'Timeline UI ready',
            data:{todayDate, hasDb:!!db},
            timestamp:Date.now()
        })
    }).catch(()=>{});
    // #endregion

    // Load today's entries count
    await loadTodayEntries();
}

// Setup Type Radio Button Listeners
function setupTypeRadios() {
    const radios = document.querySelectorAll('input[name="type"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const vocabFields = document.getElementById('vocabFields');
            const noteFields = document.getElementById('noteFields');

            if (e.target.value === 'note') {
                vocabFields.classList.add('hidden');
                noteFields.classList.remove('hidden');

                // Clear vocab field requirements
                document.getElementById('character').required = false;
                document.getElementById('pinyin').required = false;
                document.getElementById('meaning').required = false;

                // Set note field requirements
                document.getElementById('noteTitle').required = true;
                document.getElementById('noteContent').required = true;
            } else {
                vocabFields.classList.remove('hidden');
                noteFields.classList.add('hidden');

                // Set vocab field requirements
                document.getElementById('character').required = true;
                document.getElementById('pinyin').required = true;
                document.getElementById('meaning').required = true;

                // Clear note field requirements
                document.getElementById('noteTitle').required = false;
                document.getElementById('noteContent').required = false;
            }
        });
    });
}

// Generate Timeline ID
function generateTimelineId(date, type, sequence) {
    return `timeline-${date}-${type}-${String(sequence).padStart(3, '0')}`;
}

// Get Next Sequence Number
async function getNextSequenceNumber(docId, type) {
    const collectionName = type === 'component' ? 'components' :
                          type === 'vocab' ? 'vocabulary' : 'notes';

    try {
        const snapshot = await db.collection('timeline')
            .doc(docId)
            .collection(collectionName)
            .get();

        return snapshot.size + 1;
    } catch (error) {
        console.error('Error getting sequence number:', error);
        return 1;
    }
}

// Save to Firestore
async function saveToFirestore(docId, type, data) {
    const collectionName = type === 'component' ? 'components' :
                          type === 'vocab' ? 'vocabulary' : 'notes';

    try {
        // 確保父文件存在，便於後續查詢
        await db.collection('timeline')
            .doc(docId)
            .set({
                scope: 'timeline',
                date: docId.replace('timeline-', ''),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

        await db.collection('timeline')
            .doc(docId)
            .collection(collectionName)
            .add(data);

        console.log(`Saved ${type}:`, data.character || data.title);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'T4',
                location:'assets/js/timeline-input.js:saveToFirestore',
                message:'Write success',
                data:{docId, type, collectionName, lesson:data.lesson, hasCharacter:!!data.character, hasTitle:!!data.title},
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion
        return true;
    } catch (error) {
        console.error('Error saving to Firestore:', error);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'T4',
                location:'assets/js/timeline-input.js:saveToFirestore',
                message:'Write failed',
                data:{docId, type, message:error?.message||'unknown', code:error?.code||null},
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion
        alert('儲存失敗：' + error.message);
        return false;
    }
}

// Handle Form Submission
async function handleTimelineSubmit(event) {
    event.preventDefault();

    const type = document.querySelector('input[name="type"]:checked').value;
    const lesson = document.getElementById('lessonSelect').value;
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            sessionId:'debug-session',
            runId:'baseline',
            hypothesisId:'T5',
            location:'assets/js/timeline-input.js:handleTimelineSubmit',
            message:'Submit',
            data:{type, lessonSelected:!!lesson, hasDb:!!db},
            timestamp:Date.now()
        })
    }).catch(()=>{});
    // #endregion

    if (!lesson) {
        alert('請選擇課次！');
        return;
    }

    let data = {
        type: type,
        source: 'timeline',
        lesson: lesson,
        date: todayDate,
        review: (type !== 'note'), // Notes don't go into review
        timestamp: new Date().toISOString()
    };

    if (type === 'note') {
        data.title = document.getElementById('noteTitle').value;
        data.content = document.getElementById('noteContent').value;
    } else {
        data.character = document.getElementById('character').value;
        data.pinyin = document.getElementById('pinyin').value;
        data.meaning = document.getElementById('meaning').value;
        data.notes = document.getElementById('notes').value || '';
    }

    // Get sequence number
    const todayDoc = `timeline-${todayDate}`;
    const sequence = await getNextSequenceNumber(todayDoc, type);
    data.id = generateTimelineId(todayDate, type, sequence);

    // Save to Firestore
    const success = await saveToFirestore(todayDoc, type, data);

    if (success) {
        // Update UI
        addToRecentEntries(data);
        clearForm();

        // Show success message
        showMessage('✓ 儲存成功！', 'success');
    }
}

// Save and Exit
async function saveAndExit() {
    // Submit the form first
    const form = document.getElementById('timelineForm');

    // Check if form is valid
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // Submit and then exit
    await handleTimelineSubmit({ preventDefault: () => {} });

    setTimeout(() => {
        alert('儲存完成！');
        window.location.href = 'index.html';
    }, 500);
}

// Clear Form
function clearForm() {
    const type = document.querySelector('input[name="type"]:checked').value;

    if (type === 'note') {
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteContent').value = '';
    } else {
        document.getElementById('character').value = '';
        document.getElementById('pinyin').value = '';
        document.getElementById('meaning').value = '';
        document.getElementById('notes').value = '';
    }

    // Keep lesson selection
    // document.getElementById('lessonSelect').value = '';
}

// Add to Recent Entries
function addToRecentEntries(data) {
    entryCountToday++;
    document.getElementById('entryCount').textContent = entryCountToday;

    const list = document.getElementById('entryList');
    const item = document.createElement('li');

    if (data.type === 'note') {
        item.textContent = `📝 筆記：${data.title}`;
    } else {
        const typeLabel = data.type === 'component' ? '部件' : '生詞';
        item.textContent = `${typeLabel}：${data.character} (${data.pinyin})`;
    }

    item.className = 'entry-item';
    list.insertBefore(item, list.firstChild);
}

// Load Today's Entries
async function loadTodayEntries() {
    const todayDoc = `timeline-${todayDate}`;

    try {
        // Load all three collections
        const collections = ['components', 'vocabulary', 'notes'];
        let totalCount = 0;
        const entries = [];

        for (const collName of collections) {
            // Remove orderBy to avoid needing index
            const snapshot = await db.collection('timeline')
                .doc(todayDoc)
                .collection(collName)
                .get();

            totalCount += snapshot.size;

            snapshot.forEach(doc => {
                entries.push(doc.data());
            });
        }

        // Sort entries by timestamp locally
        entries.sort((a, b) => {
            const timeA = a.timestamp || '';
            const timeB = b.timestamp || '';
            return timeB.localeCompare(timeA);
        });

        entryCountToday = totalCount;
        document.getElementById('entryCount').textContent = totalCount;

        // Display entries
        entries.forEach(data => {
            const list = document.getElementById('entryList');
            const item = document.createElement('li');

            if (data.type === 'note') {
                item.textContent = `📝 筆記：${data.title}`;
            } else {
                const typeLabel = data.type === 'component' ? '部件' : '生詞';
                item.textContent = `${typeLabel}：${data.character} (${data.pinyin})`;
            }

            item.className = 'entry-item';
            list.appendChild(item);
        });

    } catch (error) {
        console.error('Error loading today\'s entries:', error);
    }
}

// Teacher Logout
function teacherLogout() {
    if (confirm('確定要登出嗎？')) {
        localStorage.removeItem('teacher_auth');
        alert('已登出');
        window.location.href = 'index.html';
    }
}

// Show Message
function showMessage(text, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = text;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}
