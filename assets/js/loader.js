// BCT Lesson Loader
// 負責從 Markdown 載入課程內容並動態渲染到頁面

class LessonLoader {
    constructor() {
        this.currentLesson = null;
        this.lessonData = {
            dialogue: [], // 改為存 5 組對話，每組包含多個句子
            vocabulary: [],
            reading: [],
            practice: [],
            timeline: [], // Timeline 補充內容
            timelineComponents: [],
            timelineVocab: [],
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
        
        // 读取学生班级（cohort）
        this.currentCohort = urlParams.get('cohort') || localStorage.getItem('bct-cohort') || 'taigen-a';
        
        // #region agent log
        const firestoreSrc = Array.from(document.querySelectorAll('script[src]'))
            .map((s) => s.getAttribute('src'))
            .find((src) => src && src.includes('assets/js/firestore.js'));
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'H14',
                location:'assets/js/loader.js:init',
                message:'Firestore version seen',
                data:{
                    firestoreSrc,
                    firestoreVersion:window.__firestoreVersion || null,
                    cohort: this.currentCohort
                },
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion

        // 自動轉換 L1 → lesson1（相容舊版 URL）
        if (lessonId.match(/^L\d+$/)) {
            lessonId = 'lesson' + lessonId.substring(1);
        }
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/fe98b67c-7883-463c-8159-8386c334ac76',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                sessionId:'debug-session',
                runId:'baseline',
                hypothesisId:'H8',
                location:'assets/js/loader.js:init',
                message:'Init lesson params',
                data:{
                    qsClass:urlParams.get('class'),
                    rememberedClass,
                    resolvedClassId:classId,
                    qsLesson:urlParams.get('lesson'),
                    computedLessonId:lessonId
                },
                timestamp:Date.now()
            })
        }).catch(()=>{});
        // #endregion

        await this.loadLesson(lessonId);
        this.setupTabSystem();
        
        // 更新 Vocab tab 标签和复习按钮（在 DOM 和数据都加载完成后）
        this.updateVocabTabLabel();
        this.updateReviewLink();
        
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
                this.lessonData.timeline = [];
                this.lessonData.timelineComponents = [];
                this.lessonData.timelineVocab = [];
                this.lessonData.timelineNotes = [];
                document.getElementById('lesson-title').textContent = '暂无课程';
                this.render();
                return;
            }

            // 填充 lessonData（直接使用 Firestore 的資料結構）
            this.lessonData.dialogue = fullLesson.dialogue || [];
            this.lessonData.vocabulary = fullLesson.vocabulary || [];
            this.lessonData.reading = fullLesson.reading || [];
            this.lessonData.practice = []; // Practice 暫時保持空的

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
            const timeline = await firestoreService.getTimelineForLesson(timelineLessonId, this.currentCohort, 'btc1');
            this.lessonData.timeline = timeline;
            this.lessonData.timelineComponents = timeline.filter(t => t.type === 'component');
            this.lessonData.timelineVocab = timeline.filter(t => t.type === 'vocab');
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
        this.renderTimelineComponents();
        this.renderTimelineVocab();
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

    // 渲染 Practice
    renderPractice() {
        const container = document.getElementById('practice-content');

        if (this.lessonData.practice.length === 0) {
            container.innerHTML = '<p class="placeholder">練習功能開發中...</p>';
            return;
        }

        container.innerHTML = '';
        this.lessonData.practice.forEach((item, index) => {
            const practiceCard = this.createPracticeCard(item, index);
            container.appendChild(practiceCard);
        });
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
        const container = document.getElementById('timeline-components-content');
        container.innerHTML = '';

        if (!this.lessonData.timelineComponents.length) {
            container.innerHTML = '<p class="placeholder">尚無部件補充</p>';
            return;
        }

        this.lessonData.timelineComponents.forEach((item, index) => {
            const card = this.createTimelineCard(item, index);
            container.appendChild(card);
        });
    }

    // 渲染 Timeline 字詞
    renderTimelineVocab() {
        const container = document.getElementById('timeline-vocab-content');
        container.innerHTML = '';

        if (!this.lessonData.timelineVocab.length) {
            container.innerHTML = '<p class="placeholder">尚無字詞補充</p>';
            return;
        }

        this.lessonData.timelineVocab.forEach((item, index) => {
            const card = this.createTimelineCard(item, index);
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

        this.lessonData.timelineNotes.forEach((item) => {
            console.log('📝 渲染笔记项：', item);
            const note = document.createElement('div');
            note.className = 'timeline-note';
            const title = item.title ? `<div class="note-title">${item.title}</div>` : '';
            const content = item.content ? `<div class="note-content">${item.content}</div>` : '';
            note.innerHTML = title + content;
            container.appendChild(note);
        });
        
        console.log('✅ 笔记渲染完成');
    }

    // 創建 Timeline 卡片（用於 components 和 vocabulary）
    createTimelineCard(data) {
        const card = document.createElement('div');
        card.className = 'timeline-card';

        // 漢字
        const charDiv = document.createElement('div');
        charDiv.className = 'line-character';
        charDiv.innerHTML = data.character || '';

        // 加入發音按鈕
        const audioBtn = document.createElement('button');
        audioBtn.className = 'audio-btn';
        audioBtn.textContent = '🔊';
        audioBtn.onclick = () => audioController.speak(data.character || '');
        charDiv.appendChild(audioBtn);

        card.appendChild(charDiv);

        // 拼音
        if (data.pinyin) {
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

        // 補充說明
        if (data.notes) {
            const notesDiv = document.createElement('div');
            notesDiv.className = 'timeline-notes';
            notesDiv.textContent = data.notes;
            card.appendChild(notesDiv);
        }

        return card;
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

    // 更新复习按钮链接
    updateReviewLink() {
        const reviewLink = document.getElementById('sidebar-review-link');
        if (!reviewLink) return;

        // 添加 level 和 cohort 参数
        const level = new URLSearchParams(window.location.search).get('level') || 'btc1';
        reviewLink.href = `bct-review.html?level=${level}&cohort=${this.currentCohort}`;
        
        console.log(`✅ 复习链接已更新：level=${level}, cohort=${this.currentCohort}`);
    }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    const loader = new LessonLoader();
    loader.init();
});
