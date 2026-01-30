// BCT Lesson Loader
// 負責從 Markdown 載入課程內容並動態渲染到頁面

// 靜默日誌函數（開發用，失敗時不顯示錯誤）
function silentLog(sessionId, runId, hypothesisId, location, message, data) {
    // 使用 try-catch 和 setTimeout 來完全靜默錯誤
    try {
        setTimeout(() => {
            fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId || 'debug-session',
                    runId: runId || 'baseline',
                    hypothesisId,
                    location,
                    message,
                    data,
                    timestamp: Date.now()
                }),
                // 使用 no-cors 模式可以減少一些錯誤，但會限制響應
                // 由於這是日誌功能，我們不需要響應
                mode: 'no-cors'
            }).catch(() => {
                // 完全靜默，不顯示任何錯誤
            });
        }, 0);
    } catch (e) {
        // 完全靜默，不顯示任何錯誤
    }
}

class LessonLoader {
    constructor() {
        this.currentLesson = null;
        this.currentLevel = null; // BCT Level (btc1, btc2, btc3)
        this.lessonData = {
            dialogue: [], // 改為存 5 組對話，每組包含多個句子
            vocabulary: [],
            reading: [],
            practice: [],
            grammar: [], // Grammar 內容
            timeline: [], // Timeline 補充內容
            timelineComponents: [],
            timelineVocab: [],
            timelineTargetCharacters: [], // 目標字
            timelineNotes: []
        };
        this.currentGroup = null;
    }

    // 初始化：從 URL 取得課次並載入
    async init() {
        // ⏱️ 性能测试：记录开始时间
        const startTime = performance.now();
        console.log('⏱️ 开始加载课程...', new Date().toLocaleTimeString());
        
        const urlParams = new URLSearchParams(window.location.search);
        const STORAGE_KEY = 'bct-active-class';
        const rememberedClass = localStorage.getItem(STORAGE_KEY);
        const classId = urlParams.get('class') || rememberedClass || window?.BCT_COURSE_CONFIG?.defaultClassId || null;
        let lessonId = urlParams.get('lesson') || 'L1';
        this.currentClassId = classId;
        
        // 读取 BCT Level（優先 URL 參數，其次 localStorage，最後默認 btc1）
        this.currentLevel = urlParams.get('level') || 
                            localStorage.getItem('bct-active-class') || 
                            localStorage.getItem('bct-current-level') || 
                            'btc1';
        
        // 读取学生班级（cohort）- enforced by cohort-guard if present
        this.currentCohort =
            window.BCT_ACTIVE_COHORT ||
            urlParams.get('cohort') ||
            localStorage.getItem('bct-cohort') ||
            'taigen-a';
        
        // #region agent log
        const firestoreSrc = Array.from(document.querySelectorAll('script[src]'))
            .map((s) => s.getAttribute('src'))
            .find((src) => src && src.includes('assets/js/firestore.js'));
        silentLog('debug-session', 'baseline', 'H14', 'assets/js/loader.js:init', 'Firestore version seen', {
            firestoreSrc,
            firestoreVersion: window.__firestoreVersion || null,
            cohort: this.currentCohort
        });
        // #endregion

        // 自動轉換 L1 → lesson1（相容舊版 URL）
        if (lessonId.match(/^L\d+$/)) {
            lessonId = 'lesson' + lessonId.substring(1);
        }
        // #region agent log
        silentLog('debug-session', 'baseline', 'H8', 'assets/js/loader.js:init', 'Init lesson params', {
            qsClass: urlParams.get('class'),
            rememberedClass,
            resolvedClassId: classId,
            qsLesson: urlParams.get('lesson'),
            computedLessonId: lessonId
        });
        // #endregion

        await this.loadLesson(lessonId);
        this.setupTabSystem();
        
        // 更新 Vocab tab 标签（在 DOM 和数据都加载完成后）
        this.updateVocabTabLabel();
        
        // ⏱️ 性能测试：计算总耗时
        const endTime = performance.now();
        const totalTime = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`⏱️ 课程加载完成！总耗时：${totalTime} 秒`, new Date().toLocaleTimeString());
        
        // 显示在页面上（可选）
        const perfInfo = document.createElement('div');
        perfInfo.style.cssText = 'position:fixed;bottom:10px;right:10px;background:#4CAF50;color:white;padding:8px 12px;border-radius:8px;font-size:12px;z-index:9999;';
        perfInfo.textContent = `⏱️ 加载耗时：${totalTime} 秒`;
        document.body.appendChild(perfInfo);
        setTimeout(() => perfInfo.remove(), 5000); // 5秒后自动消失
    }

    // 從 Firestore 載入課程資料
    async loadLesson(lessonId) {
        try {
            // 確保 Firestore 已初始化
            if (!firestoreService.isConnected()) {
                console.log('⏳ 等待 Firestore 初始化...');
                await firestoreService.init();
            }

            // 從 Firestore 讀取完整課程資料
            const classId = this.currentClassId ||
                new URLSearchParams(window.location.search).get('class') ||
                localStorage.getItem('bct-active-class') ||
                window?.BCT_COURSE_CONFIG?.defaultClassId || null;
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    sessionId:'debug-session',
                    runId:'baseline',
                    hypothesisId:'H8',
                    location:'assets/js/loader.js:loadLesson',
                    message:'Calling getFullLesson',
                    data:{lessonId, classId},
                    timestamp:Date.now()
                })
            }).catch(()=>{});
            // #endregion
            const fullLesson = await firestoreService.getFullLesson(lessonId, classId);

            // 儲存當前課次（無論 fullLesson 是否存在，都需要載入 Grammar/Practice）
            this.currentLesson = lessonId;

            if (!fullLesson) {
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({
                        sessionId:'debug-session',
                        runId:'baseline',
                        hypothesisId:'H7',
                        location:'assets/js/loader.js:loadLesson',
                        message:'No lesson data for class',
                        data:{lessonId, classId},
                        timestamp:Date.now()
                    })
                }).catch(()=>{});
                // #endregion
                this.lessonData.dialogue = [];
                this.lessonData.vocabulary = [];
                this.lessonData.reading = [];
                this.lessonData.practice = [];
                this.lessonData.grammar = [];
                this.lessonData.timeline = [];
                this.lessonData.timelineComponents = [];
                this.lessonData.timelineVocab = [];
                this.lessonData.timelineTargetCharacters = [];
                this.lessonData.timelineNotes = [];
                document.getElementById('lesson-title').textContent = '暂无课程';
                
                // 即使沒有 fullLesson，也嘗試載入 Grammar/Practice（可能只有 Grammar/Practice 而沒有其他內容）
                console.log('⚠️ 沒有找到完整課程資料，但仍嘗試載入 Grammar/Practice...');
                await this.loadGrammarAndPractice(lessonId);
                
                this.render();
                return;
            }

            // 填充 lessonData（直接使用 Firestore 的資料結構）
            this.lessonData.dialogue = fullLesson.dialogue || [];
            this.lessonData.vocabulary = fullLesson.vocabulary || [];
            this.lessonData.reading = fullLesson.reading || [];
            this.lessonData.practice = []; // Practice 暫時保持空的
            
            // 載入 Grammar 和 Practice（從 Firestore）
            console.log('🔍 準備載入 Grammar/Practice，檢查連接狀態...');
            console.log('🔍 Firestore 連接狀態:', firestoreService.isConnected());
            console.log('🔍 Firestore db:', firestoreService.db);
            console.log('🔍 當前課次:', lessonId);
            console.log('🔍 當前等級:', this.currentLevel);
            await this.loadGrammarAndPractice(lessonId);

            // 載入 Timeline 補充內容
            // 转换 lessonId：L1 → lesson1, L2 → lesson2
            let timelineLessonId = lessonId;
            if (/^L\d+$/i.test(lessonId)) {
                // 如果是 L1, L2, L3... 格式
                const num = lessonId.match(/\d+/)[0];
                timelineLessonId = 'lesson' + num;
            } else if (/^lesson\d+$/i.test(lessonId)) {
                // 如果已经是 lesson1, lesson2 格式
                timelineLessonId = lessonId.toLowerCase();
            }
            console.log('🔄 转换 lessonId：', lessonId, '→', timelineLessonId);
            console.log('🔄 当前 Level：', this.currentLevel);
            const timeline = await firestoreService.getTimelineForLesson(timelineLessonId, this.currentCohort, this.currentLevel);
            this.lessonData.timeline = timeline;
            
            console.log('🟢 測試：loader.js 新版本已載入！');
            console.log('🟢 timeline 總數:', timeline.length);
            
            // 調試：檢查 timeline 中的類型分布
            const typeCounts = {};
            timeline.forEach(t => {
                typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
            });
            console.log('📊 Timeline 類型分布:', typeCounts);
            console.log('📊 Timeline 完整內容（前5個）:', timeline.slice(0, 5).map(t => ({ id: t.id, type: t.type, lesson: t.lesson, is_published: t.is_published })));
            
            // Components：只包含 component 類型，且只包含已發布的（雙重檢查確保安全）
            this.lessonData.timelineComponents = timeline.filter(t => 
                t.type === 'component' && t.is_published === true
            );
            console.log(`📦 過濾後的 timelineComponents 數量（已發布）: ${this.lessonData.timelineComponents.length}`);
            if (this.lessonData.timelineComponents.length > 0) {
                console.log('📦 前3個 timelineComponents:', this.lessonData.timelineComponents.slice(0, 3).map(c => ({ id: c.id, character: c.character, is_published: c.is_published })));
            } else {
                console.warn('⚠️ 沒有已發布的部件！請檢查 is_published 狀態');
            }
            
            // Vocab：只包含 vocab 類型（生詞補充，不包括目標字）
            this.lessonData.timelineVocab = timeline.filter(t => t.type === 'vocab');
            // Target Characters：目標字
            this.lessonData.timelineTargetCharacters = timeline.filter(t => t.type === 'target-character');
            this.lessonData.timelineNotes = timeline.filter(t => t.type === 'note');

            // 設置課程標題
            const title = fullLesson.title || `Lesson ${lessonId}`;
            document.getElementById('lesson-title').textContent = title;

            console.log('✅ 課程資料載入成功:', {
                dialogue: this.lessonData.dialogue.length,
                vocabulary: this.lessonData.vocabulary.length,
                reading: this.lessonData.reading.length,
                timeline: this.lessonData.timeline.length
            });
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                    sessionId:'debug-session',
                    runId:'baseline',
                    hypothesisId:'H4',
                    location:'assets/js/loader.js:loadLesson',
                    message:'Lesson loaded',
                    data:{lessonId, dialogueCount:this.lessonData.dialogue.length, vocabularyCount:this.lessonData.vocabulary.length, readingCount:this.lessonData.reading.length, timelineCount:this.lessonData.timeline.length, isConnected:firestoreService.isConnected()},
                    timestamp:Date.now()
                })
            }).catch(()=>{});
            // #endregion

            this.render();
        } catch (error) {
            console.error('❌ 載入課程失敗:', error);
            document.getElementById('lesson-title').textContent = '載入失敗';
        }
    }


    // 解析 Dialogue Markdown（簡化版）
    parseDialogueMarkdown(markdown) {
        const groups = [];
        let currentGroup = null;
        let currentItem = {};

        markdown.split('\n').forEach(line => {
            const trimmed = line.trim();

            if (trimmed.startsWith('## ')) {
                // 保存上一個 group
                if (currentItem.pinyin && currentGroup) {
                    currentGroup.sentences.push({...currentItem});
                }
                if (currentGroup?.sentences.length > 0) {
                    groups.push(currentGroup);
                }
                currentGroup = { id: trimmed.slice(3), sentences: [] };
                currentItem = {};
            } else if (trimmed.startsWith('### ')) {
                // 保存上一句
                if (currentItem.pinyin && currentGroup) {
                    currentGroup.sentences.push({...currentItem});
                }
                currentItem = {};
            } else if (trimmed.includes(':')) {
                const [key, ...rest] = trimmed.split(':');
                const value = rest.join(':').trim();
                if (key && value) currentItem[key.trim()] = value;
            }
        });

        // 保存最後一項
        if (currentItem.pinyin && currentGroup) {
            currentGroup.sentences.push({...currentItem});
        }
        if (currentGroup?.sentences.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }

    // 解析 Vocabulary Markdown（簡化版）
    parseVocabularyMarkdown(markdown) {
        const vocabulary = [];
        let currentItem = {};

        markdown.split('\n').forEach(line => {
            const trimmed = line.trim();

            if (trimmed.startsWith('## ')) {
                if (currentItem.pinyin) vocabulary.push({...currentItem});
                currentItem = { id: trimmed.slice(3) };
            } else if (trimmed.includes(':')) {
                const [key, ...rest] = trimmed.split(':');
                const value = rest.join(':').trim();
                if (key && value) {
                    // HSK 轉為數字
                    currentItem[key.trim()] =
                        key.trim() === 'hsk' ? parseInt(value) : value;
                }
            }
        });

        if (currentItem.pinyin) vocabulary.push({...currentItem});
        return vocabulary;
    }

    // 解析 Reading Markdown（簡化版）
    parseReadingMarkdown(markdown) {
        const reading = [];
        let currentItem = {};

        markdown.split('\n').forEach(line => {
            const trimmed = line.trim();

            if (trimmed.startsWith('## ')) {
                if (currentItem.pinyin) reading.push({...currentItem});
                currentItem = { id: trimmed.slice(3) };
            } else if (trimmed.includes(':')) {
                const [key, ...rest] = trimmed.split(':');
                const value = rest.join(':').trim();
                if (key && value) currentItem[key.trim()] = value;
            }
        });

        if (currentItem.pinyin) reading.push({...currentItem});
        return reading;
    }

    // 解析 Practice Markdown（簡化版）
    parsePracticeMarkdown(markdown) {
        const practice = [];
        let currentItem = {};

        markdown.split('\n').forEach(line => {
            const trimmed = line.trim();

            if (trimmed.startsWith('## ')) {
                if (currentItem.title) practice.push({...currentItem});
                currentItem = { id: trimmed.slice(3) };
            } else if (trimmed.includes(':')) {
                const [key, ...rest] = trimmed.split(':');
                const value = rest.join(':').trim();
                if (key && value) currentItem[key.trim()] = value;
            }
        });

        if (currentItem.title) practice.push({...currentItem});
        return practice;
    }

    // 渲染內容到頁面
    render() {
        console.log('Lesson Data:', this.lessonData);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'H9',
                location:'assets/js/loader.js:render',
                message:'Render entry',
                data:{
                    dialogueCount:this.lessonData.dialogue.length,
                    vocabularyCount:this.lessonData.vocabulary.length,
                    readingCount:this.lessonData.reading.length
                },
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion
        this.renderDialogue();
        this.renderVocabulary();
        this.renderReading();
        this.renderPractice();
        this.renderGrammar();
        this.renderTimelineComponents();
        this.renderTimelineVocab();
        this.renderTimelineTargetCharacters();
        this.renderTimelineNotes();
    }

    // 渲染 Dialogue（按 group 分組顯示）
    renderDialogue() {
        const container = document.getElementById('dialogue-content');
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'H10',
                location:'assets/js/loader.js:renderDialogue',
                message:'Dialogue render',
                data:{hasContainer:!!container, count:this.lessonData.dialogue.length},
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion
        container.innerHTML = '';

        // 如果沒有對話內容，顯示提示
        if (this.lessonData.dialogue.length === 0) {
            container.innerHTML = '<p class="placeholder">尚無對話內容</p>';
            return;
        }

        // 按 group 分組
        const groupedDialogue = {};
        this.lessonData.dialogue.forEach(sentence => {
            const groupName = sentence.group || 'default';
            if (!groupedDialogue[groupName]) {
                groupedDialogue[groupName] = [];
            }
            groupedDialogue[groupName].push(sentence);
        });

        // 渲染每個 group
        Object.keys(groupedDialogue).sort().forEach(groupName => {
            const sentences = groupedDialogue[groupName];

            // 創建 group 容器卡片
            const groupCard = document.createElement('div');
            groupCard.className = 'dialogue-group-card';

            // Group 標題
            const groupHeader = document.createElement('div');
            groupHeader.className = 'group-header';
            // 將 group-1 轉換為 对话1 Dialogue 1
            const groupNumber = groupName.replace('group-', '');
            groupHeader.textContent = `对话${groupNumber} Dialogue ${groupNumber}`;
            groupCard.appendChild(groupHeader);

            // 渲染 group 內的所有句子
            sentences.forEach((sentence, index) => {
                const sentenceDiv = document.createElement('div');
                sentenceDiv.className = 'sentence-item';
                sentenceDiv.style.marginBottom = '16px';

                // 創建拼音行
                const pinyinDiv = document.createElement('div');
                pinyinDiv.className = 'line-pinyin';
                pinyinDiv.textContent = sentence.pinyin || '';
                sentenceDiv.appendChild(pinyinDiv);

                // 創建漢字行（帶發音按鈕）
                const charLine = document.createElement('div');
                charLine.className = 'line-character';
                charLine.innerHTML = sentence.character || '';

                // 加入發音按鈕
                const audioBtn = document.createElement('button');
                audioBtn.className = 'audio-btn';
                audioBtn.textContent = '🔊';
                audioBtn.onclick = () => audioController.speak(sentence.character || '');
                charLine.appendChild(audioBtn);
                sentenceDiv.appendChild(charLine);

                // 創建翻譯行
                const enDiv = document.createElement('div');
                enDiv.className = 'line-en translation';
                enDiv.textContent = sentence.english || '';
                sentenceDiv.appendChild(enDiv);

                const esDiv = document.createElement('div');
                esDiv.className = 'line-es translation';
                esDiv.textContent = sentence.spanish || '';
                sentenceDiv.appendChild(esDiv);

                groupCard.appendChild(sentenceDiv);
            });

            container.appendChild(groupCard);
        });
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'H11',
                location:'assets/js/loader.js:renderDialogue',
                message:'Dialogue DOM after render',
                data:{
                    childCount:container.children.length,
                    groups:Object.keys(groupedDialogue).length
                },
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion
    }

    // 渲染 Vocabulary
    renderVocabulary() {
        const container = document.getElementById('vocabulary-content');
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'H10',
                location:'assets/js/loader.js:renderVocabulary',
                message:'Vocabulary render',
                data:{hasContainer:!!container, count:this.lessonData.vocabulary.length},
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion
        container.innerHTML = '';

        this.lessonData.vocabulary.forEach((item, index) => {
            const card = this.createVocabCard(item, index);
            container.appendChild(card);
        });
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'H11',
                location:'assets/js/loader.js:renderVocabulary',
                message:'Vocabulary DOM after render',
                data:{childCount:container.children.length},
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion
    }

    // 渲染 Reading
    renderReading() {
        const container = document.getElementById('reading-content');
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'H10',
                location:'assets/js/loader.js:renderReading',
                message:'Reading render',
                data:{hasContainer:!!container, count:this.lessonData.reading.length},
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion
        container.innerHTML = '';

        this.lessonData.reading.forEach((item, index) => {
            const card = this.createSentenceCard(item, index);
            container.appendChild(card);
        });
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'H11',
                location:'assets/js/loader.js:renderReading',
                message:'Reading DOM after render',
                data:{childCount:container.children.length},
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion
    }

    // 載入 Grammar 和 Practice 資料
    async loadGrammarAndPractice(lessonId) {
        console.log('🚀 loadGrammarAndPractice 被調用，lessonId:', lessonId);
        try {
            // 確保 Firestore 已連接
            if (!firestoreService.isConnected()) {
                console.warn('⚠️ Firestore 未連接，嘗試重新初始化...');
                await firestoreService.init();
                if (!firestoreService.isConnected()) {
                    console.error('❌ Firestore 初始化失敗，無法載入 Grammar/Practice');
                    return;
                }
            }

            const db = firestoreService.db;
            if (!db) {
                console.error('❌ Firestore db 為 null');
                return;
            }

            const level = this.currentLevel || 'btc1';
            const lessonDocId = lessonId; // lesson1, lesson2, etc.

            console.log('📚 開始載入 Grammar/Practice:', { 
                level, 
                lessonDocId, 
                db: !!db,
                currentLevel: this.currentLevel,
                urlLevel: new URLSearchParams(window.location.search).get('level')
            });
            
            // 構建 Firestore 路徑
            const grammarPath = `courses/${level}/lessons/${lessonDocId}/grammar`;
            console.log('🔍 Grammar Firestore 路徑:', grammarPath);

            // 載入 Grammar
            try {
                console.log(`🔍 查詢 Grammar: courses/${level}/lessons/${lessonDocId}/grammar`);
                
                // 先檢查 lesson 文件是否存在
                const lessonDocRef = db.collection('courses').doc(level).collection('lessons').doc(lessonDocId);
                const lessonDoc = await lessonDocRef.get();
                console.log(`🔍 Lesson 文件存在:`, lessonDoc.exists);
                
                if (!lessonDoc.exists) {
                    console.warn(`⚠️ Lesson 文件不存在: courses/${level}/lessons/${lessonDocId}`);
                    console.warn(`💡 提示：請確認 Firestore 中是否有此路徑的文件`);
                }
                
                // 先嘗試使用 orderBy，如果失敗則不使用排序
                let grammarSnapshot;
                try {
                    console.log('🔍 嘗試使用 orderBy 查詢 Grammar...');
                    grammarSnapshot = await db
                        .collection('courses')
                        .doc(level)
                        .collection('lessons')
                        .doc(lessonDocId)
                        .collection('grammar')
                        .orderBy('order', 'asc')
                        .get();
                    console.log('✅ orderBy 查詢成功，找到', grammarSnapshot.size, '個文件');
                } catch (orderError) {
                    // 如果 orderBy 失敗（可能是缺少索引），嘗試不使用排序
                    console.warn('⚠️ Grammar orderBy 失敗，改用無排序查詢:', orderError.message);
                    console.warn('⚠️ 錯誤詳情:', orderError);
                    grammarSnapshot = await db
                        .collection('courses')
                        .doc(level)
                        .collection('lessons')
                        .doc(lessonDocId)
                        .collection('grammar')
                        .get();
                    console.log('✅ 無排序查詢成功，找到', grammarSnapshot.size, '個文件');
                }

                this.lessonData.grammar = [];
                grammarSnapshot.forEach(doc => {
                    const data = doc.data();
                    console.log('📄 讀取 Grammar 文件:', doc.id, { title: data.title, hasContent: !!data.content });
                    this.lessonData.grammar.push({
                        id: doc.id,
                        ...data
                    });
                });

                console.log(`✅ 載入 ${this.lessonData.grammar.length} 個 Grammar 項目`);
                if (this.lessonData.grammar.length > 0) {
                    console.log('Grammar 項目列表:', this.lessonData.grammar.map(g => ({ id: g.id, title: g.title, contentLength: (g.content || '').length })));
                } else {
                    console.warn('⚠️ 沒有找到任何 Grammar 項目');
                    console.warn('💡 請確認：');
                    console.warn(`   1. Firestore 路徑是否正確：courses/${level}/lessons/${lessonDocId}/grammar`);
                    console.warn(`   2. 是否在 timeline-admin.html 的 Grammar 管理 Tab 中新增了內容`);
                    console.warn(`   3. 等級和課次是否匹配（當前：level=${level}, lesson=${lessonDocId}）`);
                }
            } catch (error) {
                console.error('❌ 載入 Grammar 失敗:', error);
                console.error('❌ 錯誤堆疊:', error.stack);
                this.lessonData.grammar = [];
            }

            // 載入 Practice
            try {
                let practiceSnapshot;
                try {
                    practiceSnapshot = await db
                        .collection('courses')
                        .doc(level)
                        .collection('lessons')
                        .doc(lessonDocId)
                        .collection('practice')
                        .orderBy('order', 'asc')
                        .get();
                } catch (orderError) {
                    console.warn('⚠️ Practice orderBy 失敗，改用無排序查詢:', orderError.message);
                    practiceSnapshot = await db
                        .collection('courses')
                        .doc(level)
                        .collection('lessons')
                        .doc(lessonDocId)
                        .collection('practice')
                        .get();
                }

                this.lessonData.practice = [];
                practiceSnapshot.forEach(doc => {
                    const data = doc.data();
                    this.lessonData.practice.push({
                        id: doc.id,
                        ...data
                    });
                });

                console.log(`✅ 載入 ${this.lessonData.practice.length} 個 Practice 項目`);
            } catch (error) {
                console.error('❌ 載入 Practice 失敗:', error);
                this.lessonData.practice = [];
            }
        } catch (error) {
            console.error('❌ 載入 Grammar/Practice 失敗:', error);
            this.lessonData.grammar = [];
            this.lessonData.practice = [];
        }
    }

    // 渲染 Grammar
    async renderGrammar() {
        const container = document.getElementById('grammar-content');
        if (!container) {
            console.warn('⚠️ Grammar container 未找到');
            return;
        }

        container.innerHTML = '';

        // 第一區塊：獨立 HTML 檔案按鈕（移到最上方）
        const level = this.currentLevel || 'btc1';
        const lessonId = this.currentLesson || 'lesson1';
        await this.renderStandaloneButtons(container, 'grammar', level, lessonId);

        // 第二區塊：Firestore 的 Markdown 內容（移到下方）
        const grammarItems = this.lessonData.grammar || [];
        console.log('🎨 渲染 Grammar，項目數量:', grammarItems.length);
        console.log('Grammar 資料:', grammarItems);
        
        if (grammarItems.length > 0) {
            const grammarSection = document.createElement('div');
            grammarSection.className = 'grammar-section';
            grammarSection.style.cssText = 'margin-top: 30px; padding-top: 30px; border-top: 2px solid #e0e0e0;';

            grammarItems.forEach((item, index) => {
                const grammarCard = document.createElement('div');
                grammarCard.className = 'grammar-card';
                grammarCard.style.cssText = 'background: white; border-radius: 8px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;';

                // 標題行（可點擊）
                const header = document.createElement('div');
                header.className = 'grammar-card-header';
                header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #f8f9fa; cursor: pointer; transition: background-color 0.2s ease; user-select: none;';
                header.dataset.collapsed = 'true';
                
                header.onmouseenter = () => {
                    if (header.dataset.collapsed === 'true') {
                        header.style.background = '#e9ecef';
                    }
                };
                header.onmouseleave = () => {
                    if (header.dataset.collapsed === 'true') {
                        header.style.background = '#f8f9fa';
                    }
                };

                const title = document.createElement('h3');
                title.textContent = item.title || '（无标题）';
                title.style.cssText = 'margin: 0; color: #333; font-size: 1.2rem; font-weight: 600; flex: 1;';
                header.appendChild(title);

                // 展開/摺疊圖示
                const icon = document.createElement('span');
                icon.className = 'grammar-card-icon';
                icon.textContent = '▶';
                icon.style.cssText = 'color: #666; font-size: 14px; transition: transform 0.3s ease; margin-left: 12px;';
                header.appendChild(icon);

                // 內容區域（預設摺疊）
                const content = document.createElement('div');
                content.className = 'grammar-card-content';
                content.style.cssText = 'max-height: 0; overflow: hidden; transition: max-height 0.3s ease;';
                
                const contentInner = document.createElement('div');
                contentInner.className = 'grammar-content';
                const contentText = item.content || '';
                console.log(`渲染 Grammar 項目 ${index + 1}:`, { title: item.title, contentLength: contentText.length });
                
                if (typeof renderMarkdown === 'function') {
                    contentInner.innerHTML = renderMarkdown(contentText);
                } else if (typeof marked !== 'undefined') {
                    contentInner.innerHTML = marked.parse(contentText);
                } else {
                    contentInner.textContent = contentText;
                }
                contentInner.style.cssText = 'padding: 20px; line-height: 1.6; color: #555;';
                content.appendChild(contentInner);

                // 點擊標題行切換展開/摺疊
                header.onclick = () => {
                    const isCollapsed = header.dataset.collapsed === 'true';
                    if (isCollapsed) {
                        // 展開
                        header.dataset.collapsed = 'false';
                        // 先設置為 auto 獲取實際高度，然後設置為具體值以觸發動畫
                        content.style.maxHeight = 'none';
                        const height = content.scrollHeight;
                        content.style.maxHeight = '0';
                        // 使用 requestAnimationFrame 確保動畫觸發
                        requestAnimationFrame(() => {
                            content.style.maxHeight = height + 'px';
                        });
                        icon.textContent = '▼';
                        icon.style.transform = 'rotate(0deg)';
                        header.style.background = '#e9ecef';
                    } else {
                        // 摺疊
                        header.dataset.collapsed = 'true';
                        content.style.maxHeight = content.scrollHeight + 'px';
                        requestAnimationFrame(() => {
                            content.style.maxHeight = '0';
                        });
                        icon.textContent = '▶';
                        icon.style.transform = 'rotate(0deg)';
                        header.style.background = '#f8f9fa';
                    }
                };

                grammarCard.appendChild(header);
                grammarCard.appendChild(content);
                grammarSection.appendChild(grammarCard);
            });

            container.appendChild(grammarSection);
        } else {
            // 如果沒有 Grammar 內容，顯示明確的提示
            const levelDisplay = level.toUpperCase().replace('BTC', 'BCT');
            const lessonDisplay = lessonId.replace('lesson', 'Lesson ').toUpperCase();
            
            const placeholderCard = document.createElement('div');
            placeholderCard.className = 'grammar-empty-state';
            placeholderCard.style.cssText = 'background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; padding: 40px 20px; text-align: center; margin-top: 30px; padding-top: 30px; border-top: 2px solid #e0e0e0;';
            
            const icon = document.createElement('div');
            icon.textContent = '📝';
            icon.style.cssText = 'font-size: 48px; margin-bottom: 16px;';
            placeholderCard.appendChild(icon);
            
            const title = document.createElement('h3');
            title.textContent = '暂无文法内容';
            title.style.cssText = 'color: #495057; font-size: 1.3rem; margin-bottom: 12px; font-weight: 600;';
            placeholderCard.appendChild(title);
            
            const info = document.createElement('p');
            info.style.cssText = 'color: #6c757d; font-size: 0.95rem; margin-bottom: 8px; line-height: 1.6;';
            info.innerHTML = `目前查詢：<strong style="color: #495057;">${levelDisplay} - ${lessonDisplay}</strong>`;
            placeholderCard.appendChild(info);
            
            const path = document.createElement('p');
            path.style.cssText = 'color: #868e96; font-size: 0.85rem; margin-bottom: 16px; font-family: monospace; background: #e9ecef; padding: 8px 12px; border-radius: 4px; display: inline-block;';
            path.textContent = `courses/${level}/lessons/${lessonId}/grammar/`;
            placeholderCard.appendChild(path);
            
            const instruction = document.createElement('p');
            instruction.style.cssText = 'color: #6c757d; font-size: 0.9rem; margin-top: 16px;';
            instruction.textContent = "🚧 Still working on this. I'll update here as we go.";
            placeholderCard.appendChild(instruction);
            
            container.appendChild(placeholderCard);
        }
    }

    // 渲染 Practice
    async renderPractice() {
        const container = document.getElementById('practice-content');
        if (!container) return;

        container.innerHTML = '';

        // 第一區塊：獨立 HTML 檔案按鈕（移到最上方）
        const level = this.currentLevel || 'btc1';
        const lessonId = this.currentLesson || 'lesson1';
        await this.renderStandaloneButtons(container, 'practice', level, lessonId);

        // 第二區塊：Firestore 的 Markdown 內容（移到下方）
        const practiceItems = this.lessonData.practice || [];
        if (practiceItems.length > 0) {
            const practiceSection = document.createElement('div');
            practiceSection.className = 'practice-section';
            practiceSection.style.cssText = 'margin-top: 30px; padding-top: 30px; border-top: 2px solid #e0e0e0;';

            practiceItems.forEach((item, index) => {
                const practiceCard = document.createElement('div');
                practiceCard.className = 'practice-card';
                practiceCard.style.cssText = 'background: white; border-radius: 8px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;';

                // 標題行（可點擊）
                const header = document.createElement('div');
                header.className = 'practice-card-header';
                header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #f8f9fa; cursor: pointer; transition: background-color 0.2s ease; user-select: none;';
                header.dataset.collapsed = 'true';
                
                header.onmouseenter = () => {
                    if (header.dataset.collapsed === 'true') {
                        header.style.background = '#e9ecef';
                    }
                };
                header.onmouseleave = () => {
                    if (header.dataset.collapsed === 'true') {
                        header.style.background = '#f8f9fa';
                    }
                };

                const title = document.createElement('h3');
                title.textContent = item.title || '（无标题）';
                title.style.cssText = 'margin: 0; color: #333; font-size: 1.2rem; font-weight: 600; flex: 1;';
                header.appendChild(title);

                // 展開/摺疊圖示
                const icon = document.createElement('span');
                icon.className = 'practice-card-icon';
                icon.textContent = '▶';
                icon.style.cssText = 'color: #666; font-size: 14px; transition: transform 0.3s ease; margin-left: 12px;';
                header.appendChild(icon);

                // 內容區域（預設摺疊）
                const content = document.createElement('div');
                content.className = 'practice-card-content';
                content.style.cssText = 'max-height: 0; overflow: hidden; transition: max-height 0.3s ease;';
                
                const contentInner = document.createElement('div');
                contentInner.className = 'practice-content';
                if (typeof renderMarkdown === 'function') {
                    contentInner.innerHTML = renderMarkdown(item.content || '');
                } else if (typeof marked !== 'undefined') {
                    contentInner.innerHTML = marked.parse(item.content || '');
                } else {
                    contentInner.textContent = item.content || '';
                }
                contentInner.style.cssText = 'padding: 20px; line-height: 1.6; color: #555;';
                content.appendChild(contentInner);

                // 點擊標題行切換展開/摺疊
                header.onclick = () => {
                    const isCollapsed = header.dataset.collapsed === 'true';
                    if (isCollapsed) {
                        // 展開
                        header.dataset.collapsed = 'false';
                        // 先設置為 auto 獲取實際高度，然後設置為具體值以觸發動畫
                        content.style.maxHeight = 'none';
                        const height = content.scrollHeight;
                        content.style.maxHeight = '0';
                        // 使用 requestAnimationFrame 確保動畫觸發
                        requestAnimationFrame(() => {
                            content.style.maxHeight = height + 'px';
                        });
                        icon.textContent = '▼';
                        icon.style.transform = 'rotate(0deg)';
                        header.style.background = '#e9ecef';
                    } else {
                        // 摺疊
                        header.dataset.collapsed = 'true';
                        content.style.maxHeight = content.scrollHeight + 'px';
                        requestAnimationFrame(() => {
                            content.style.maxHeight = '0';
                        });
                        icon.textContent = '▶';
                        icon.style.transform = 'rotate(0deg)';
                        header.style.background = '#f8f9fa';
                    }
                };

                practiceCard.appendChild(header);
                practiceCard.appendChild(content);
                practiceSection.appendChild(practiceCard);
            });

            container.appendChild(practiceSection);
        } else {
            // 如果沒有 Practice 內容，顯示明確的提示
            const levelDisplay = level.toUpperCase().replace('BTC', 'BCT');
            const lessonDisplay = lessonId.replace('lesson', 'Lesson ').toUpperCase();
            
            const placeholderCard = document.createElement('div');
            placeholderCard.className = 'practice-empty-state';
            placeholderCard.style.cssText = 'background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; padding: 40px 20px; text-align: center; margin-top: 30px; padding-top: 30px; border-top: 2px solid #e0e0e0;';
            
            const icon = document.createElement('div');
            icon.textContent = '✏️';
            icon.style.cssText = 'font-size: 48px; margin-bottom: 16px;';
            placeholderCard.appendChild(icon);
            
            const title = document.createElement('h3');
            title.textContent = '暂无练习内容';
            title.style.cssText = 'color: #495057; font-size: 1.3rem; margin-bottom: 12px; font-weight: 600;';
            placeholderCard.appendChild(title);
            
            const info = document.createElement('p');
            info.style.cssText = 'color: #6c757d; font-size: 0.95rem; margin-bottom: 8px; line-height: 1.6;';
            info.innerHTML = `目前查詢：<strong style="color: #495057;">${levelDisplay} - ${lessonDisplay}</strong>`;
            placeholderCard.appendChild(info);
            
            const path = document.createElement('p');
            path.style.cssText = 'color: #868e96; font-size: 0.85rem; margin-bottom: 16px; font-family: monospace; background: #e9ecef; padding: 8px 12px; border-radius: 4px; display: inline-block;';
            path.textContent = `courses/${level}/lessons/${lessonId}/practice/`;
            placeholderCard.appendChild(path);
            
            const instruction = document.createElement('p');
            instruction.style.cssText = 'color: #6c757d; font-size: 0.9rem; margin-top: 16px;';
            instruction.textContent = "🚧 Still working on this. I'll update here as we go.";
            placeholderCard.appendChild(instruction);
            
            container.appendChild(placeholderCard);
        }
    }

    // 渲染獨立 HTML 檔案按鈕（改進版：只顯示存在的文件）
    async renderStandaloneButtons(container, type, level, lessonId) {
        // 將 lesson1 轉換為 L1 格式（用於資料夾路徑）
        let folderLessonId = lessonId;
        if (lessonId.match(/^lesson\d+$/i)) {
            const num = lessonId.match(/\d+/)[0];
            folderLessonId = 'L' + num;
        }

        // 將 btc1 轉換為 BCT1 格式
        const folderLevel = level.toUpperCase().replace('BTC', 'BCT');

        // 構建資料夾路徑
        const folderPath = `${folderLevel}/${folderLessonId}`;

        // 建立按鈕區塊（移到最上方，不需要頂部邊距和邊框）
        const buttonSection = document.createElement('div');
        buttonSection.className = `${type}-standalone-buttons`;
        buttonSection.style.cssText = 'margin-bottom: 20px;';

        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = type === 'grammar' ? '📄 Extra Resources' : '📄 Extra Practice';
        sectionTitle.style.cssText = 'margin-bottom: 15px; color: #333; font-size: 1.2rem;';
        buttonSection.appendChild(sectionTitle);

        // 顯示載入狀態
        const loadingIndicator = document.createElement('div');
        loadingIndicator.style.cssText = 'padding: 20px; text-align: center; color: #666; font-size: 0.9rem;';
        loadingIndicator.textContent = '⏳ 正在检查可用文件...';
        buttonSection.appendChild(loadingIndicator);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px;';
        buttonSection.appendChild(buttonContainer);
        container.appendChild(buttonSection);

        // 檢查文件是否存在（最多檢查 5 個）
        const maxFiles = 5;
        const checkPromises = [];

        for (let i = 1; i <= maxFiles; i++) {
            const fileName = `${type}-${i}.html`;
            const filePath = `${folderPath}/${fileName}`;
            
            // 使用 HEAD 請求檢查文件是否存在
            const checkPromise = fetch(filePath, { method: 'HEAD' })
                .then(response => {
                    if (response.ok) {
                        return { index: i, exists: true, path: filePath };
                    }
                    return { index: i, exists: false, path: filePath };
                })
                .catch(() => {
                    return { index: i, exists: false, path: filePath };
                });
            
            checkPromises.push(checkPromise);
        }

        // 等待所有檢查完成
        try {
            const results = await Promise.all(checkPromises);
            const existingFiles = results.filter(r => r.exists);

            // 移除載入指示器
            loadingIndicator.remove();

            // 如果有文件存在，創建按鈕
            if (existingFiles.length > 0) {
                existingFiles.forEach(({ index, path }) => {
                    const button = document.createElement('button');
                    button.className = 'standalone-btn';
                    button.textContent = type === 'grammar' ? `文法 ${index}` : `练习 ${index}`;
                    button.style.cssText = 'padding: 12px 24px; background: #FF8C42; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.3s;';
                    button.onmouseover = () => button.style.background = '#E67A31';
                    button.onmouseout = () => button.style.background = '#FF8C42';

                    const urlParams = new URLSearchParams(window.location.search);
                    const cohort = urlParams.get('cohort') || 'taigen-a';
                    const standaloneUrl = `${path}?level=${level}&lesson=${lessonId}&cohort=${cohort}`;

                    button.onclick = () => {
                        window.open(standaloneUrl, '_blank');
                    };

                    buttonContainer.appendChild(button);
                });
            } else {
                // 如果沒有文件存在，隱藏整個區塊
                buttonSection.style.display = 'none';
            }
        } catch (error) {
            console.error('檢查文件時發生錯誤:', error);
            // 發生錯誤時也隱藏整個區塊
            buttonSection.style.display = 'none';
        }
    }

    // 創建句子卡片（用於 Reading）
    createSentenceCard(data, index) {
        const card = document.createElement('div');
        card.className = 'sentence-card';
        card.dataset.index = index;

        // 創建拼音行
        const pinyinDiv = document.createElement('div');
        pinyinDiv.className = 'line-pinyin';
        pinyinDiv.textContent = data.pinyin || '';
        card.appendChild(pinyinDiv);

        // 創建漢字行（帶發音按鈕）
        const charLine = document.createElement('div');
        charLine.className = 'line-character';
        charLine.innerHTML = data.character || '';

        // 加入發音按鈕
        const audioBtn = document.createElement('button');
        audioBtn.className = 'audio-btn';
        audioBtn.textContent = '🔊';
        audioBtn.onclick = () => audioController.speak(data.character || '');
        charLine.appendChild(audioBtn);
        card.appendChild(charLine);

        // 創建翻譯行
        const enDiv = document.createElement('div');
        enDiv.className = 'line-en translation';
        enDiv.textContent = data.english || '';
        card.appendChild(enDiv);

        const esDiv = document.createElement('div');
        esDiv.className = 'line-es translation';
        esDiv.textContent = data.spanish || '';
        card.appendChild(esDiv);

        return card;
    }

    // 創建單字卡片（用於 Vocabulary）
    createVocabCard(data, index) {
        const card = document.createElement('div');
        card.className = 'vocab-card';
        card.dataset.index = index;

        // 創建 header（漢字 + 發音按鈕 + HSK badge）
        const header = document.createElement('div');
        header.className = 'vocab-header';

        const charDiv = document.createElement('div');
        charDiv.className = 'line-character';
        charDiv.innerHTML = data.character || '';

        // 加入發音按鈕
        const audioBtn = document.createElement('button');
        audioBtn.className = 'audio-btn';
        audioBtn.textContent = '🔊';
        audioBtn.onclick = () => audioController.speak(data.character || '');
        charDiv.appendChild(audioBtn);

        header.appendChild(charDiv);

        // 加入 HSK badge
        if (data.hsk) {
            const hskBadge = document.createElement('span');
            hskBadge.className = 'hsk-badge';
            hskBadge.textContent = `HSK ${data.hsk}`;
            header.appendChild(hskBadge);
        }

        card.appendChild(header);

        // 創建拼音行
        const pinyinDiv = document.createElement('div');
        pinyinDiv.className = 'line-pinyin';
        pinyinDiv.textContent = data.pinyin || '';
        card.appendChild(pinyinDiv);

        // 創建翻譯行
        const enDiv = document.createElement('div');
        enDiv.className = 'line-en translation';
        enDiv.textContent = data.english || '';
        card.appendChild(enDiv);

        const esDiv = document.createElement('div');
        esDiv.className = 'line-es translation';
        esDiv.textContent = data.spanish || '';
        card.appendChild(esDiv);

        return card;
    }

    // 創建練習卡片
    createPracticeCard(data, index) {
        const card = document.createElement('div');
        card.className = 'practice-card';
        card.dataset.index = index;

        const instruction = data.instruction ? `<p class="practice-instruction">${data.instruction}</p>` : '';

        card.innerHTML = `
            <h3 class="practice-title">${index + 1}/ ${data.title || ''}</h3>
            ${instruction}
            <p class="practice-content">${data.content || ''}</p>
        `;

        return card;
    }

    // 渲染 Timeline 部件
    renderTimelineComponents() {
        console.log('🎨 開始渲染 Timeline Components');
        console.log('🎨 timelineComponents 數量:', this.lessonData.timelineComponents.length);
        console.log('🎨 timelineComponents 內容（前3個）:', this.lessonData.timelineComponents.slice(0, 3));
        
        const container = document.getElementById('timeline-components-content');
        if (!container) {
            console.error('❌ 找不到 timeline-components-content 容器');
            return;
        }
        container.innerHTML = '';

        if (!this.lessonData.timelineComponents.length) {
            console.log('⚠️ 沒有部件數據，顯示佔位符');
            container.innerHTML = '<p class="placeholder">尚無部件補充</p>';
            return;
        }

        console.log(`✅ 開始渲染 ${this.lessonData.timelineComponents.length} 個部件`);
        this.lessonData.timelineComponents.forEach((item, index) => {
            const card = this.createTimelineCard(item, true); // Components: isComponent = true
            console.log(`🎴 創建卡片 ${index + 1}:`, { id: item.id, character: item.character, cardElement: card });
            if (!card) {
                console.error(`❌ 卡片 ${index + 1} 創建失敗！`);
                return;
            }
            container.appendChild(card);
            console.log(`✅ 卡片 ${index + 1} 已添加到 DOM，容器子元素數量: ${container.children.length}`);
        });
        console.log('✅ Timeline Components 渲染完成');
        console.log('🔍 最終容器狀態:', {
            containerId: container.id,
            childrenCount: container.children.length,
            innerHTML: container.innerHTML.substring(0, 200) + '...'
        });
    }

    // 渲染 Timeline 字詞（生詞補充）
    renderTimelineVocab() {
        const container = document.getElementById('timeline-vocab-content');
        container.innerHTML = '';

        if (!this.lessonData.timelineVocab.length) {
            container.innerHTML = '<p class="placeholder">尚無字詞補充</p>';
            return;
        }

        this.lessonData.timelineVocab.forEach((item, index) => {
            const card = this.createTimelineCard(item, false); // Vocab: isComponent = false
            container.appendChild(card);
        });
    }

    // 渲染 Timeline 目標字
    renderTimelineTargetCharacters() {
        const container = document.getElementById('timeline-target-characters-content');
        if (!container) return;
        
        container.innerHTML = '';

        if (!this.lessonData.timelineTargetCharacters.length) {
            container.innerHTML = '<p class="placeholder">暫無內容 Nothing here yet.</p>';
            return;
        }

        this.lessonData.timelineTargetCharacters.forEach((item, index) => {
            const card = this.createTimelineCard(item, false); // 汉字: isComponent = false
            container.appendChild(card);
        });
    }

    // 渲染 Timeline 筆記
    renderTimelineNotes() {
        const container = document.getElementById('teacher-notes');
        if (!container) {
            console.warn('⚠️ 找不到笔记容器 #teacher-notes');
            return;
        }

        const card = container.closest('.b-notes-card');
        const placeholder = card ? card.querySelector('.placeholder') : null;
        container.innerHTML = '';

        console.log('📝 Timeline Notes 数据：', this.lessonData.timelineNotes);
        console.log('📝 笔记数量：', this.lessonData.timelineNotes.length);

        if (!this.lessonData.timelineNotes.length) {
            console.log('📝 没有笔记，显示占位符');
            if (placeholder) placeholder.style.display = '';
            return;
        }

        console.log('📝 开始渲染笔记');
        if (placeholder) placeholder.style.display = 'none';

        this.lessonData.timelineNotes.forEach((item, index) => {
            console.log('📝 渲染笔记项：', item);
            
            // 創建筆記容器
            const note = document.createElement('div');
            note.className = 'timeline-note timeline-notes markdown-body';
            note.dataset.noteIndex = index;
            
            // 創建標題行（可點擊）
            const header = document.createElement('div');
            header.className = 'note-header';
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8f9fa; cursor: pointer; border-radius: 8px; margin-bottom: 8px; transition: background-color 0.2s; user-select: none;';
            header.dataset.collapsed = 'true';
            
            // 標題文字
            const titleText = document.createElement('div');
            titleText.className = 'note-title-text';
            titleText.textContent = item.title || `筆記 ${index + 1}`;
            titleText.style.cssText = 'font-weight: 600; font-size: 1.1em; color: #333; flex: 1;';
            header.appendChild(titleText);
            
            // 展開/折疊按鈕
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'note-toggle-btn';
            toggleBtn.textContent = '+';
            toggleBtn.style.cssText = 'width: 28px; height: 28px; border: none; background: #e9ecef; color: #495057; border-radius: 6px; font-size: 18px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; margin-left: 12px;';
            toggleBtn.onmouseover = () => {
                if (header.dataset.collapsed === 'true') {
                    toggleBtn.style.background = '#dee2e6';
                }
            };
            toggleBtn.onmouseout = () => {
                if (header.dataset.collapsed === 'true') {
                    toggleBtn.style.background = '#e9ecef';
                }
            };
            header.appendChild(toggleBtn);
            
            // 內容區域（預設折疊）
            const content = document.createElement('div');
            content.className = 'note-content';
            content.style.cssText = 'max-height: 0; overflow: hidden; transition: max-height 0.3s ease;';
            
            const contentInner = document.createElement('div');
            contentInner.className = 'note-content-inner';
            contentInner.style.cssText = 'padding: 16px; line-height: 1.6; color: #555;';
            if (item.content) {
                contentInner.innerHTML = this.renderMarkdown(item.content);
            }
            content.appendChild(contentInner);
            
            // 點擊標題行或按鈕切換展開/折疊
            const toggleCollapse = () => {
                const isCollapsed = header.dataset.collapsed === 'true';
                if (isCollapsed) {
                    // 展開
                    header.dataset.collapsed = 'false';
                    content.style.maxHeight = 'none';
                    const height = content.scrollHeight;
                    content.style.maxHeight = '0';
                    requestAnimationFrame(() => {
                        content.style.maxHeight = height + 'px';
                    });
                    toggleBtn.textContent = '−';
                    toggleBtn.style.background = '#dee2e6';
                    header.style.background = '#e9ecef';
                } else {
                    // 折疊
                    header.dataset.collapsed = 'true';
                    content.style.maxHeight = content.scrollHeight + 'px';
                    requestAnimationFrame(() => {
                        content.style.maxHeight = '0';
                    });
                    toggleBtn.textContent = '+';
                    toggleBtn.style.background = '#e9ecef';
                    header.style.background = '#f8f9fa';
                }
            };
            
            header.onclick = toggleCollapse;
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                toggleCollapse();
            };
            
            note.appendChild(header);
            note.appendChild(content);
            container.appendChild(note);
        });
        
        console.log('✅ 笔记渲染完成');
    }

    // 創建 Timeline 卡片（用於 components 和 vocabulary）
    createTimelineCard(data, isComponent = false) {
        const card = document.createElement('div');
        // 為字卡添加特殊標記
        if (data.isCharacterCard) {
            card.className = 'timeline-card character-card';
            card.setAttribute('data-card-type', 'character-card');
        } else {
            card.className = 'timeline-card';
        }

        // 儲存完整數據到卡片，供彈窗使用
        card.dataset.cardData = JSON.stringify(data);
        card.dataset.isComponent = isComponent ? 'true' : 'false';

        // 字（優先顯示文字，否則顯示字形補丁圖片）
        const charDiv = document.createElement('div');
        charDiv.className = 'line-character';
        
        let charDisplay = '';
        if (data.character && data.character.trim()) {
            charDisplay = data.character;
        } else if (data.display_image && data.display_image.trim()) {
            charDisplay = `<img src="${data.display_image}" class="img-comp" alt="comp" style="height: 1.8em; width: auto; vertical-align: middle;">`;
        }
        charDiv.innerHTML = charDisplay;

        // 加入發音按鈕（只有文字時才顯示，類似 Vocabulary 卡片）
        if (data.character && data.character.trim()) {
            const audioBtn = document.createElement('button');
            audioBtn.className = 'audio-btn';
            audioBtn.textContent = '🔊';
            audioBtn.onclick = (e) => {
                e.stopPropagation(); // 防止觸發卡片點擊事件
                if (audioController && typeof audioController.speak === 'function') {
                    audioController.speak(data.character || '');
                }
            };
            charDiv.appendChild(audioBtn);
        }

        card.appendChild(charDiv);

        // 拼音（Components 預覽層不顯示，汉字顯示）
        if (data.pinyin && !isComponent) {
            const pinyinDiv = document.createElement('div');
            pinyinDiv.className = 'line-pinyin';
            pinyinDiv.textContent = data.pinyin;
            card.appendChild(pinyinDiv);
        }

        // 意思
        if (data.meaning) {
            const meaningDiv = document.createElement('div');
            meaningDiv.className = 'line-en';
            meaningDiv.textContent = data.meaning;
            card.appendChild(meaningDiv);
        }

        // 輔助插圖（預覽層隱藏，彈窗中顯示）
        if (data.image && data.image.trim()) {
            const imageDiv = document.createElement('div');
            imageDiv.className = 'timeline-image';
            imageDiv.style.marginTop = '10px';
            imageDiv.innerHTML = `<img src="${data.image}" style="max-width:100%;border-radius:6px;" onerror="this.style.display='none';">`;
            card.appendChild(imageDiv);
        }

        // 補充說明（預覽層隱藏，彈窗中顯示）
        if (data.notes) {
            const notesDiv = document.createElement('div');
            notesDiv.className = 'timeline-notes markdown-body';
            notesDiv.innerHTML = this.renderMarkdown(data.notes);
            card.appendChild(notesDiv);
        }

        // 添加提示文字
        const hintDiv = document.createElement('div');
        hintDiv.className = 'card-hint';
        hintDiv.innerHTML = '<span>Tap for details</span> <span>→</span>';
        card.appendChild(hintDiv);

        // 添加點擊事件打開彈窗
        card.addEventListener('click', (e) => {
            // 防止發音按鈕觸發卡片點擊
            if (e.target.closest('.audio-btn')) {
                return;
            }
            this.openTimelineModal(data, isComponent);
        });

        return card;
    }

    // Markdown 渲染函數（支援圖片分類）
    renderMarkdown(text) {
        if (!text || typeof marked === 'undefined') {
            return text || '';
        }
        
        let html = marked.parse(text);
        
        // 處理圖片分類：根據 Alt 文字自動分配 CSS Class
        html = html.replace(
            /<img src="([^"]+)" alt="([^"]+)"/g,
            (match, src, alt) => {
                if (alt === 'comp') {
                    return `<img src="${src}" class="img-comp" alt="comp" loading="lazy" style="height: 1.6em; width: auto; vertical-align: middle; margin: 0 2px;">`;
                } else if (alt === 'origin') {
                    return `<img src="${src}" class="img-origin" alt="origin" loading="lazy" style="width: 55%; min-width: 180px; margin: 15px auto; display: block; border: 1px solid #eee; padding: 8px; background: #fff; border-radius: 6px;">`;
                } else if (alt === 'story') {
                    return `<img src="${src}" class="img-story" alt="story" loading="lazy" style="width: 90%; margin: 20px auto; display: block; border-radius: 10px;">`;
                }
                // 其他圖片：自適應
                return `<img src="${src}" alt="${alt}" loading="lazy" style="max-width: 100%; height: auto; display: block;">`;
            }
        );
        
        return html;
    }

    // 設置 Tab 切換系統
    setupTabSystem() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;

                // 移除所有 active 狀態
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));

                // 添加 active 到當前選擇
                btn.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
            });
        });
    }

    // 更新 Vocab tab 标签（根据班级）
    updateVocabTabLabel() {
        const vocabTab = document.getElementById('vocabTab');
        if (!vocabTab) return;

        // 转换 cohort ID 为显示标签
        const cohortLabel = this.currentCohort === 'taigen-a' ? 'A' : 'B';
        vocabTab.textContent = `Vocab ${cohortLabel}`;
    }

    // 打開 Timeline 卡片彈窗
    openTimelineModal(data, isComponent = false) {
        const modal = document.getElementById('timelineCardModal');
        const modalBody = document.getElementById('timelineModalBody');
        if (!modal || !modalBody) return;

        // 清空內容
        modalBody.innerHTML = '';

        // 創建汉字/字形區域
        const charDiv = document.createElement('div');
        charDiv.className = 'line-character';
        
        let charDisplay = '';
        if (data.character && data.character.trim()) {
            charDisplay = data.character;
        } else if (data.display_image && data.display_image.trim()) {
            charDisplay = `<img src="${data.display_image}" class="img-comp" alt="comp" style="height: 2em; width: auto; vertical-align: middle;">`;
        }
        charDiv.innerHTML = charDisplay;

        // 添加發音按鈕（只有文字時才顯示）
        if (data.character && data.character.trim()) {
            const audioBtn = document.createElement('button');
            audioBtn.className = 'audio-btn';
            audioBtn.textContent = '🔊';
            audioBtn.onclick = (e) => {
                e.stopPropagation();
                if (audioController && typeof audioController.speak === 'function') {
                    audioController.speak(data.character || '');
                }
            };
            charDiv.appendChild(audioBtn);
        }
        modalBody.appendChild(charDiv);

        // 拼音（彈窗中 Components 也顯示）
        if (data.pinyin) {
            const pinyinDiv = document.createElement('div');
            pinyinDiv.className = 'line-pinyin';
            pinyinDiv.textContent = data.pinyin;
            modalBody.appendChild(pinyinDiv);
        }

        // 意思
        if (data.meaning) {
            const meaningDiv = document.createElement('div');
            meaningDiv.className = 'line-en';
            meaningDiv.textContent = data.meaning;
            modalBody.appendChild(meaningDiv);
        }

        // 輔助插圖
        if (data.image && data.image.trim()) {
            const imageDiv = document.createElement('div');
            imageDiv.className = 'timeline-image';
            imageDiv.innerHTML = `<img src="${data.image}" style="max-width:100%;border-radius:8px;" onerror="this.style.display='none';">`;
            modalBody.appendChild(imageDiv);
        }

        // 補充說明（支援 Markdown）
        if (data.notes) {
            const notesContainer = document.createElement('div');
            notesContainer.className = 'timeline-notes';
            
            const notesTitle = document.createElement('h3');
            notesTitle.textContent = 'Notes';
            notesContainer.appendChild(notesTitle);
            
            const notesContent = document.createElement('div');
            notesContent.className = 'markdown-body';
            notesContent.innerHTML = this.renderMarkdown(data.notes);
            notesContainer.appendChild(notesContent);
            
            modalBody.appendChild(notesContainer);
        }

        // 來源標籤
        const sourceDiv = document.createElement('div');
        sourceDiv.className = 'timeline-modal-source';
        let sourceText = '';
        if (data.isCharacterCard) {
            sourceText = 'Character Card';
        } else if (data.source === 'timeline') {
            sourceText = `Timeline ${data.sourceDate?.replace('timeline-', '') || ''}`;
        } else {
            sourceText = `Lesson ${data.lesson?.replace('lesson', '') || ''}`;
        }
        sourceDiv.textContent = `Source: ${sourceText}`;
        modalBody.appendChild(sourceDiv);

        // 顯示彈窗
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // 防止背景滾動

        // 關閉按鈕事件
        const closeBtn = modal.querySelector('.timeline-modal-close');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeTimelineModal();
        }

        // 點擊背景關閉
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeTimelineModal();
            }
        };

        // ESC 鍵關閉
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeTimelineModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    // 關閉 Timeline 卡片彈窗
    closeTimelineModal() {
        const modal = document.getElementById('timelineCardModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = ''; // 恢復滾動
        }
    }

}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    const loader = new LessonLoader();
    loader.init();
});
