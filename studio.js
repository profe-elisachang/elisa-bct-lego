// Studio - Component Management Dashboard
// 管理 timeline/${level}/components 集合

// 課次列表
const lessons = Array.from({length: 25}, (_, i) => `lesson${i + 1}`);

class StudioManager {
    constructor() {
        this.db = null;
        this.currentLevel = 'btc1';
        this.currentType = 'component'; // 'component' 或 'target-character'
        this.currentLesson = ''; // 空字串表示全部課次
        this.components = [];
        this.debounceTimers = new Map();
        this.sortableFormList = null;
        this.sortablePreviewList = null;
        this.displayImageWidget = null;
        this.imageWidget = null;
        this.currentUploadComponentId = null;
        this.currentUploadType = null;
        this.selectedIndex = null; // 當前選中的卡片索引
        
        // 快速補充生詞相關
        this.currentMode = 'component'; // 'component', 'vocab', 'note', 'grammar', 'practice'
        this.vocabList = [];
        this.selectedVocabIndex = null;
        this.vocabSaveTimeout = null;
        this.vocabCohort = 'taigen-a'; // 固定班級
        this.sortableVocabList = null;
        
        // Live Note 相關
        this.notes = [];
        this.selectedNoteIndex = null;
        this.noteSaveTimeout = null;
        this.noteCohort = 'taigen-a';
        this.sortableNoteList = null;
        
        // Grammar 相關
        this.grammarList = [];
        this.selectedGrammarIndex = null;
        this.grammarSaveTimeout = null;
        this.sortableGrammarList = null;
        
        // Practice 相關
        this.practiceList = [];
        this.selectedPracticeIndex = null;
        this.practiceSaveTimeout = null;
        this.sortablePracticeList = null;
        
        this.previewZoom = 1.0; // 預覽區縮放比例，預設 100%
        this.init();
    }

    async init() {
        try {
            console.log('🔧 開始初始化 Studio Manager...');
            
            // 初始化 Firebase（使用與 timeline-admin.js 相同的方式）
            console.log('🔧 初始化 Firebase...');
            const initResult = await firestoreService.init();
            if (!initResult) {
                throw new Error('Firebase 初始化失敗');
            }
            
            // 使用 firestoreService.db（與 timeline-admin.js 使用相同的 db 對象）
            this.db = firestoreService.db;
            if (!this.db) {
                throw new Error('Firestore 數據庫未初始化');
            }
            console.log('✅ Firebase 初始化成功');

            // 設置事件監聽器
            console.log('🔧 設置事件監聽器...');
            this.setupEventListeners();
            console.log('✅ 事件監聽器設置完成');

            // 載入數據（根據當前模式）
            console.log('🔧 載入數據...');
            this.loadCurrentModeData();

            // 初始化拖拽
            console.log('🔧 初始化拖拽功能...');
            this.initSortable();
            
            // 初始化 Cloudinary 上傳功能
            console.log('🔧 初始化 Cloudinary 上傳功能...');
            this.initCloudinaryUpload();
            
            console.log('✅ Studio Manager 初始化完成');
        } catch (error) {
            console.error('❌ Studio Manager 初始化失敗:', error);
            const formList = document.getElementById('form-list');
            const previewList = document.getElementById('preview-list');
            if (formList) {
                formList.innerHTML = `<div style="padding: var(--space-4); color: var(--danger);">
                    <p><strong>❌ 初始化失敗</strong></p>
                    <p>${error.message}</p>
                    <p style="font-size: var(--text-sm); margin-top: var(--space-2);">
                        請檢查瀏覽器控制台以獲取更多信息。
                    </p>
                </div>`;
            }
            if (previewList) {
                previewList.innerHTML = `<div style="padding: var(--space-4); color: var(--danger);">
                    <p>❌ 初始化失敗</p>
                </div>`;
            }
        }
    }

    setupEventListeners() {
        // Level 選擇器
        const levelSelect = document.getElementById('level-select');
        if (levelSelect) {
            // 初始化時讀取當前值
            this.currentLevel = levelSelect.value || 'btc1';
            levelSelect.addEventListener('change', (e) => {
                this.currentLevel = e.target.value;
                this.loadCurrentModeData();
            });
        }

        // 類型選擇器
        const typeSelect = document.getElementById('type-select');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                this.currentType = e.target.value;
                console.log('🔄 類型切換:', this.currentType);
                this.loadComponents();
            });
            // 初始化時也記錄當前值
            console.log('🔄 初始類型:', this.currentType, '選擇器值:', typeSelect.value);
        }

        // 課次選擇器
        const lessonSelect = document.getElementById('lesson-select');
        if (lessonSelect) {
            // 初始化時讀取當前值
            this.currentLesson = lessonSelect.value || '';
            lessonSelect.addEventListener('change', (e) => {
                this.currentLesson = e.target.value;
                this.loadCurrentModeData();
            });
        }

        // 側邊欄切換功能已移除（導航欄可滾動，不需要隱藏按鈕）
        
        // 添加可調整寬度的拉條功能
        const resizer = document.getElementById('studio-resizer');
        if (resizer) {
            // 從 localStorage 讀取上次保存的寬度
            const savedWidth = localStorage.getItem('studio-sidebar-width');
            const layout = document.getElementById('studio-layout');
            if (layout && savedWidth) {
                const width = parseFloat(savedWidth);
                layout.style.setProperty('--studio-sidebar-width', `${width}%`);
                
                // 如果保存的寬度小於 10%，恢復最小化模式
                if (width < 10) {
                    layout.classList.add('sidebar-hidden');
                }
            }
            
            let isResizing = false;
            let startX = 0;
            let startWidth = 0;
            
            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
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
                    } else if (newWidth >= 10 && layout.classList.contains('sidebar-hidden')) {
                        layout.classList.remove('sidebar-hidden');
                    }
                    
                    // 實時保存寬度（拖動過程中持續保存）
                    localStorage.setItem('studio-sidebar-width', newWidth.toString());
                }
            });
            
            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    resizer.classList.remove('dragging');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    
                    // 保存當前寬度到 localStorage
                    if (layout) {
                        const computedStyle = window.getComputedStyle(layout);
                        const currentWidth = parseFloat(computedStyle.getPropertyValue('--studio-sidebar-width')) || 40;
                        localStorage.setItem('studio-sidebar-width', currentWidth.toString());
                        console.log('💾 已保存側邊欄寬度:', currentWidth + '%');
                    }
                }
            });
        }


        // 添加新項目按鈕
        const addBtn = document.getElementById('add-component-btn');
        addBtn.addEventListener('click', () => {
            this.addNewComponent();
        });

        // 全部折疊按鈕
        const collapseAllBtn = document.getElementById('collapse-all-btn');
        if (collapseAllBtn) {
            collapseAllBtn.addEventListener('click', () => {
                this.collapseAll();
            });
        }

        // 全部展開按鈕
        const expandAllBtn = document.getElementById('expand-all-btn');
        if (expandAllBtn) {
            expandAllBtn.addEventListener('click', () => {
                this.expandAll();
            });
        }

        // 批量發布按鈕
        const batchPublishBtn = document.getElementById('batch-publish-btn');
        if (batchPublishBtn) {
            batchPublishBtn.addEventListener('click', () => {
                this.batchPublishComponents(true);
            });
        }

        // 批量取消發布按鈕
        const batchUnpublishBtn = document.getElementById('batch-unpublish-btn');
        if (batchUnpublishBtn) {
            batchUnpublishBtn.addEventListener('click', () => {
                this.batchPublishComponents(false);
            });
        }

        // 模式切換按鈕
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.switchMode(mode);
            });
        });

        // 快速補充生詞相關事件
        this.setupVocabEventListeners();
        
        // Live Note、Grammar、Practice 相關事件
        this.setupNoteEventListeners();
        this.setupGrammarEventListeners();
        this.setupPracticeEventListeners();
        
        // 預覽區縮放功能
        this.setupPreviewZoom();
    }

    setupPreviewZoom() {
        const previewContent = document.getElementById('preview-content');
        if (!previewContent) return;

        // 阻止 Ctrl + 滾輪事件冒泡到整個頁面
        previewContent.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                
                // 計算縮放比例（每次滾動調整 10%）
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.previewZoom = Math.max(0.5, Math.min(2.0, this.previewZoom + delta));
                
                // 應用縮放（使用 zoom 屬性，只影響預覽區）
                previewContent.style.zoom = this.previewZoom;
                
                // 保存到 localStorage
                localStorage.setItem('studio-preview-zoom', this.previewZoom.toString());
            }
        }, { passive: false });

        // 從 localStorage 讀取上次的縮放比例
        const savedZoom = localStorage.getItem('studio-preview-zoom');
        if (savedZoom) {
            this.previewZoom = parseFloat(savedZoom);
            previewContent.style.zoom = this.previewZoom;
        }
    }

    setupVocabEventListeners() {
        // 新增生詞按鈕
        const vocabNewBtn = document.getElementById('vocab-new-btn');
        if (vocabNewBtn) {
            vocabNewBtn.addEventListener('click', () => {
                this.addNewVocab();
            });
        }

        // 全部折疊按鈕
        const vocabCollapseAllBtn = document.getElementById('vocab-collapse-all-btn');
        if (vocabCollapseAllBtn) {
            vocabCollapseAllBtn.addEventListener('click', () => {
                this.collapseAllVocab();
            });
        }

        // 全部展開按鈕
        const vocabExpandAllBtn = document.getElementById('vocab-expand-all-btn');
        if (vocabExpandAllBtn) {
            vocabExpandAllBtn.addEventListener('click', () => {
                this.expandAllVocab();
            });
        }

        // 輸入欄位自動保存
        const vocabInputs = ['vocab-character', 'vocab-pinyin', 'vocab-meaning', 'vocab-spanish', 'vocab-notes'];
        vocabInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', () => {
                    this.debounceVocabUpdate();
                    if (inputId === 'vocab-character' || inputId === 'vocab-pinyin' || inputId === 'vocab-meaning') {
                        this.updateVocabPreview();
                    }
                });
            }
        });

        // Tab 鍵切換欄位（在最後一個欄位按 Tab 時回到第一個）
        const vocabNotes = document.getElementById('vocab-notes');
        if (vocabNotes) {
            vocabNotes.addEventListener('keydown', (e) => {
                if (e.key === 'Tab' && !e.shiftKey) {
                    // 如果是最後一個欄位，按 Tab 時回到第一個
                    e.preventDefault();
                    const firstInput = document.getElementById('vocab-character');
                    if (firstInput) firstInput.focus();
                }
            });
        }
    }

    async loadComponents() {
        try {
            // 如果沒有選擇課次，不載入數據
            if (!this.currentLesson || this.currentLesson.trim() === '') {
                this.components = [];
                this.selectedIndex = null;
                this.render();
                return;
            }
            
            const collectionName = this.currentType === 'component' ? 'components' : 'target-characters';
            const typeLabel = this.currentType === 'component' ? '部件' : '目標字';
            console.log(`📦 開始載入 ${typeLabel}，Level: ${this.currentLevel}, Lesson: ${this.currentLesson || '全部'}`);
            console.log(`📦 currentType: ${this.currentType}, collectionName: ${collectionName}`);
            console.log(`📦 查詢路徑: timeline/${this.currentLevel}/${collectionName}`);
            
            // 使用與 timeline-admin.js 完全相同的查詢方式
            // timeline-admin.js 使用: db.collection(`timeline/${level}/target-characters`).get()
            // 注意：timeline-admin.js 不使用 orderBy，直接使用 .get() 載入所有數據
            let snapshot;
            
            // 對於目標字，直接使用 .get() 不排序（與 timeline-admin.js 保持一致）
            // 因為目標字可能沒有 order 字段，使用 orderBy 會導致查詢失敗或遺漏數據
            if (this.currentType === 'target-character') {
                snapshot = await this.db
                    .collection(`timeline/${this.currentLevel}/${collectionName}`)
                    .get();
                console.log(`📦 目標字查詢（無排序），找到 ${snapshot.size} 個項目`);
            } else {
                // 部件可以使用 orderBy（通常有 order 字段）
                try {
                    let query = this.db
                        .collection(`timeline/${this.currentLevel}/${collectionName}`)
                        .orderBy('order', 'asc');
                    
                    snapshot = await query.get();
                    console.log(`📦 orderBy 查詢成功，找到 ${snapshot.size} 個項目`);
                } catch (orderError) {
                    console.warn('⚠️ orderBy 查詢失敗，改用無排序查詢:', orderError);
                    snapshot = await this.db
                        .collection(`timeline/${this.currentLevel}/${collectionName}`)
                        .get();
                    console.log(`📦 無排序查詢成功，找到 ${snapshot.size} 個項目`);
                }
            }
            
            console.log(`📦 查詢路徑確認: timeline/${this.currentLevel}/${collectionName}`);

            this.components = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                
                // 如果選擇了特定課次，過濾掉不符合的項目
                if (this.currentLesson && (data.lesson || '').trim() !== this.currentLesson.trim()) {
                    console.log(`⏭️ 跳過項目 ${doc.id}，課次不匹配: ${data.lesson} !== ${this.currentLesson}`);
                    return;
                }
                
                // 確保類型匹配（防止載入錯誤類型的數據）
                const expectedType = this.currentType === 'component' ? 'component' : 'target-character';
                if (data.type && data.type !== expectedType) {
                    console.log(`⏭️ 跳過項目 ${doc.id}，類型不匹配: ${data.type} !== ${expectedType}`);
                    return;
                }
                
                console.log('📦 讀取到項目:', doc.id);
                
                // 處理 base64 圖片數據：截斷以便查看其他字段
                const dataForLog = { ...data };
                if (dataForLog.image && typeof dataForLog.image === 'string' && dataForLog.image.startsWith('data:image')) {
                    dataForLog.image = `[Base64 Image: ${dataForLog.image.length} chars] ${dataForLog.image.substring(0, 50)}...`;
                }
                if (dataForLog.display_image && typeof dataForLog.display_image === 'string' && dataForLog.display_image.startsWith('data:image')) {
                    dataForLog.display_image = `[Base64 Image: ${dataForLog.display_image.length} chars] ${dataForLog.display_image.substring(0, 50)}...`;
                }
                
                console.log('📦 完整數據對象 (處理後，base64已截斷):', dataForLog);
                console.log('📦 所有字段列表:', Object.keys(data));
                
                // 檢查是否有實際內容
                const hasCharacter = data.character && data.character.trim();
                const hasDisplayImage = data.display_image && data.display_image.trim();
                const hasPinyin = data.pinyin && data.pinyin.trim();
                const hasMeaning = data.meaning && data.meaning.trim();
                const hasNotes = data.notes && data.notes.trim();
                const hasImage = data.image && data.image.trim();
                
                console.log('📦 項目詳細數據:', {
                    id: doc.id,
                    type: data.type,
                    character: hasCharacter ? data.character : '(空)',
                    display_image: hasDisplayImage ? (data.display_image.startsWith('data:') ? '[Base64 Image]' : data.display_image) : '(空)',
                    pinyin: hasPinyin ? data.pinyin : '(空)',
                    meaning: hasMeaning ? data.meaning : '(空)',
                    lesson: data.lesson || '(空)',
                    notes: hasNotes ? (data.notes.substring(0, 100) + (data.notes.length > 100 ? '...' : '')) : '(空)',
                    image: hasImage ? (data.image.startsWith('data:') ? '[Base64 Image]' : data.image) : '(空)',
                    order: data.order,
                    is_published: data.is_published,
                    published: data.published,
                    published_at: data.published_at,
                    created_at: data.created_at,
                    timestamp: data.timestamp,
                    '有內容的字段': {
                        character: !!hasCharacter,
                        display_image: !!hasDisplayImage,
                        pinyin: !!hasPinyin,
                        meaning: !!hasMeaning,
                        notes: !!hasNotes,
                        image: !!hasImage
                    }
                });
                this.components.push({
                    id: doc.id,
                    order: data.order !== undefined ? data.order : 999999, // 沒有 order 的項目排在最後
                    ...data
                });
            });
            
            console.log(`📦 原始數據數量: ${snapshot.size}`);
            console.log(`📦 處理後組件數量: ${this.components.length} (${this.currentLesson ? `已過濾課次: ${this.currentLesson}` : '全部課次'})`);

            // 按 order 排序（本地排序）
            this.components.sort((a, b) => {
                if (a.order !== b.order) {
                    return a.order - b.order;
                }
                // 如果 order 相同，按 ID 排序以保持穩定
                return a.id.localeCompare(b.id);
            });

            // 確保所有項目都有 order 字段
            this.components.forEach((comp, index) => {
                if (comp.order === undefined || comp.order === 999999) {
                    comp.order = index;
                }
            });

            console.log(`✅ 載入完成，共 ${this.components.length} 個${typeLabel}`);
            
            // 自動選擇第一個卡片
            if (this.components.length > 0) {
                this.selectedIndex = 0;
            } else {
                this.selectedIndex = null;
            }
            
            this.render();
        } catch (error) {
            console.error('❌ 載入數據失敗:', error);
            const collectionName = this.currentType === 'component' ? 'components' : 'target-characters';
            const typeLabel = this.currentType === 'component' ? '部件' : '目標字';
            // 顯示錯誤信息在頁面上
            const formList = document.getElementById('form-list');
            const previewSingle = document.getElementById('preview-single');
            if (formList) {
                formList.innerHTML = `<div style="padding: var(--space-4); color: var(--danger);">
                    <p>❌ 載入數據失敗：${error.message}</p>
                    <p style="font-size: var(--text-sm); margin-top: var(--space-2);">請檢查：</p>
                    <ul style="font-size: var(--text-sm); margin-top: var(--space-2);">
                        <li>Firebase 連接是否正常</li>
                        <li>路徑 timeline/${this.currentLevel}/${collectionName} 是否存在</li>
                        <li>瀏覽器控制台是否有更多錯誤信息</li>
                    </ul>
                </div>`;
            }
            if (previewSingle) {
                previewSingle.innerHTML = `<div style="padding: var(--space-4); color: var(--danger);">
                    <p>❌ 載入${typeLabel}失敗</p>
                </div>`;
            }
        }
    }

    render() {
        this.renderFormList();
        this.renderPreviewList();
        this.updateBatchPublishButtons();
    }

    // 更新批量發布按鈕狀態
    updateBatchPublishButtons() {
        const batchPublishBtn = document.getElementById('batch-publish-btn');
        const batchUnpublishBtn = document.getElementById('batch-unpublish-btn');
        
        const hasLesson = this.currentLesson && this.currentLesson.trim() !== '';
        const hasData = this.components.length > 0;
        const isEnabled = hasLesson && hasData;

        if (batchPublishBtn) {
            batchPublishBtn.disabled = !isEnabled;
            batchPublishBtn.style.opacity = isEnabled ? '1' : '0.5';
            batchPublishBtn.style.cursor = isEnabled ? 'pointer' : 'not-allowed';
        }

        if (batchUnpublishBtn) {
            batchUnpublishBtn.disabled = !isEnabled;
            batchUnpublishBtn.style.opacity = isEnabled ? '1' : '0.5';
            batchUnpublishBtn.style.cursor = isEnabled ? 'pointer' : 'not-allowed';
        }
    }

    renderFormList() {
        const formList = document.getElementById('form-list');
        formList.innerHTML = '';

        // 如果沒有選擇課次，顯示提示
        if (!this.currentLesson || this.currentLesson.trim() === '') {
            formList.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">👆 請先選擇課次</p>
                    <p style="font-size: var(--text-sm);">在上方選擇一個課次以載入數據</p>
                </div>
            `;
            return;
        }

        if (this.components.length === 0) {
            const collectionName = this.currentType === 'component' ? 'components' : 'target-characters';
            const typeLabel = this.currentType === 'component' ? '部件' : '目標字';
            formList.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">📭 尚無數據</p>
                    <p style="font-size: var(--text-sm);">當前 Level: <strong>${this.currentLevel}</strong></p>
                    <p style="font-size: var(--text-sm);">類型: <strong>${typeLabel}</strong>，課次: <strong>${this.currentLesson}</strong></p>
                    <p style="font-size: var(--text-sm); margin-top: var(--space-2);">
                        路徑：timeline/${this.currentLevel}/${collectionName}
                    </p>
                </div>
            `;
            return;
        }

        this.components.forEach((comp, index) => {
            const formItem = this.createFormItem(comp, index);
            formList.appendChild(formItem);
        });
        
        // 預設全部折疊
        this.collapseAll();
    }

    createFormItem(comp, index) {
        const item = document.createElement('div');
        item.className = 'form-item';
        item.dataset.id = comp.id;
        item.dataset.index = index;
        // 添加折疊狀態數據屬性，預設為折疊
        item.dataset.collapsed = 'true';
        
        // 如果這是選中的卡片，添加 selected class
        if (this.selectedIndex === index) {
            item.classList.add('selected');
        }

        item.innerHTML = `
            <div class="form-item-header" onclick="studioManager.selectCard(${index})">
                <span class="drag-handle">☰</span>
                <span class="form-item-title">項目 #${index + 1}</span>
                <div class="form-item-actions" style="display: flex; align-items: center; gap: var(--space-2);">
                    <div class="checkbox-group" style="display: flex; align-items: center; gap: var(--space-1); margin-right: var(--space-2);" onclick="event.stopPropagation();">
                        <input type="checkbox" 
                               id="published-${comp.id}" 
                               ${(comp.is_published !== false && comp.published !== false) ? 'checked' : ''} 
                               onchange="studioManager.updatePublishedStatus('${comp.id}', this.checked)"
                               style="margin: 0; cursor: pointer;">
                        <label for="published-${comp.id}" style="margin: 0; font-size: var(--text-xs); color: var(--gray-600); cursor: pointer; white-space: nowrap;">已發布</label>
                    </div>
                    <button class="collapse-toggle" onclick="event.stopPropagation(); studioManager.toggleCollapse(${index})" title="折疊/展開">
                        ▼
                    </button>
                </div>
            </div>
            <div class="form-group character-group">
                <label>Character (字)</label>
                <input type="text" 
                       data-field="character" 
                       value="${this.escapeHtml(comp.character || '')}" 
                       oninput="studioManager.debounceUpdate('${comp.id}', 'character', this.value)"
                       placeholder="例如：氵">
                <small style="color: var(--gray-500); font-size: var(--text-xs);">如果字無法正常顯示，請使用下方的字形補丁圖片</small>
            </div>
            <div class="form-item-body">
                <div class="form-group">
                    <label>Display Image (字形補丁圖片)</label>
                    <input type="text" 
                           data-field="display_image" 
                           id="display-image-${comp.id}"
                           value="${this.escapeHtml(comp.display_image || '')}" 
                           oninput="studioManager.debounceUpdate('${comp.id}', 'display_image', this.value)"
                           placeholder="https://res.cloudinary.com/... （上傳後自動填入）">
                    <div style="margin-top: 12px;">
                        <button type="button" class="btn-icon" id="upload-display-image-${comp.id}" 
                                style="background: var(--gray-200); color: var(--gray-900); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: var(--font-medium); border: 1px solid var(--gray-300);">
                            🖼️ 上傳字形補丁圖片到 Cloudinary
                        </button>
                        <div id="display-image-progress-${comp.id}" style="margin-top: 10px; display: none;">
                            <div style="background: var(--gray-200); height: 8px; border-radius: 4px; overflow: hidden;">
                                <div id="display-image-progress-bar-${comp.id}" style="height: 100%; background: var(--primary); width: 0%; transition: width 0.3s;"></div>
                            </div>
                            <small id="display-image-progress-text-${comp.id}" style="color: var(--primary); font-weight: bold;">上傳中 0%</small>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Pinyin (拼音)</label>
                    <input type="text" 
                           data-field="pinyin" 
                           value="${this.escapeHtml(comp.pinyin || '')}" 
                           oninput="studioManager.debounceUpdate('${comp.id}', 'pinyin', this.value)"
                           placeholder="例如：shuǐ">
                </div>
                <div class="form-group">
                    <label>Meaning (意思)</label>
                    <input type="text" 
                           data-field="meaning" 
                           value="${this.escapeHtml(comp.meaning || '')}" 
                           oninput="studioManager.debounceUpdate('${comp.id}', 'meaning', this.value)"
                           placeholder="例如：water radical | radical de agua">
                </div>
                <div class="form-group">
                    <label>Notes (補充說明，支援 Markdown)</label>
                    <textarea class="markdown-content" 
                              data-field="notes" 
                              oninput="studioManager.debounceUpdate('${comp.id}', 'notes', this.value)"
                              placeholder="可使用 Markdown 格式，例如：&#10;&#10;## 記憶故事&#10;這是一個關於...&#10;&#10;![story](圖片網址)">${this.escapeHtml(comp.notes || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>Image URL (輔助插圖)</label>
                    <input type="text" 
                           data-field="image" 
                           id="image-${comp.id}"
                           value="${this.escapeHtml(comp.image || '')}" 
                           oninput="studioManager.debounceUpdate('${comp.id}', 'image', this.value)"
                           placeholder="https://res.cloudinary.com/... （上傳後自動填入）">
                    <div style="margin-top: 12px;">
                        <button type="button" class="btn-icon" id="upload-image-${comp.id}" 
                                style="background: var(--gray-200); color: var(--gray-900); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: var(--font-medium); border: 1px solid var(--gray-300);">
                            🖼️ 上傳輔助插圖到 Cloudinary
                        </button>
                        <div id="image-progress-${comp.id}" style="margin-top: 10px; display: none;">
                            <div style="background: var(--gray-200); height: 8px; border-radius: 4px; overflow: hidden;">
                                <div id="image-progress-bar-${comp.id}" style="height: 100%; background: var(--primary); width: 0%; transition: width 0.3s;"></div>
                            </div>
                            <small id="image-progress-text-${comp.id}" style="color: var(--primary); font-weight: bold;">上傳中 0%</small>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <div style="display: flex; align-items: center; gap: var(--space-2);">
                        <button class="btn-icon delete" onclick="studioManager.deleteComponent(${index})" title="刪除" style="margin-left: auto;">🗑️</button>
                    </div>
                </div>
            </div>
        `;

        return item;
    }

    renderPreviewList() {
        const previewSingle = document.getElementById('preview-single');
        if (!previewSingle) return;

        // 如果沒有選擇課次，顯示提示
        if (!this.currentLesson || this.currentLesson.trim() === '') {
            previewSingle.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">👆 請先選擇課次</p>
                    <p style="font-size: var(--text-sm);">在上方選擇一個課次以載入數據</p>
                </div>
            `;
            return;
        }

        // 如果有選中的卡片，顯示該卡片的預覽
        if (this.selectedIndex !== null && this.components[this.selectedIndex]) {
            const comp = this.components[this.selectedIndex];
            previewSingle.innerHTML = '';
            const presentation = this.createPresentationPreview(comp, this.selectedIndex);
            previewSingle.appendChild(presentation);
            // 自動滾動到頂部
            previewSingle.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (this.components.length === 0) {
            previewSingle.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">📭 尚無預覽內容</p>
                    <p style="font-size: var(--text-sm);">請在左側編輯面板添加數據</p>
                </div>
            `;
        } else {
            previewSingle.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">👆 點擊左側卡片查看預覽</p>
                    <p style="font-size: var(--text-sm);">選擇一個項目以查看完整預覽</p>
                </div>
            `;
        }
    }

    // 新增：創建簡報式預覽（投影片模式：固定頂部 + 可滾動內容）
    createPresentationPreview(comp, index) {
        const card = document.createElement('div');
        card.className = 'presentation-card';
        
        // 創建固定頂部區域（形音義）
        const header = document.createElement('div');
        header.className = 'presentation-header';
        
        // 字（大字顯示）
        const charDiv = document.createElement('div');
        charDiv.className = 'presentation-char';
        let charDisplay = '';
        if (comp.character && comp.character.trim()) {
            charDisplay = comp.character;
        } else if (comp.display_image && comp.display_image.trim()) {
            charDisplay = `<img src="${comp.display_image}" alt="comp">`;
        }
        if (!charDisplay) {
            charDisplay = '<span style="color: var(--gray-400); font-style: italic; font-size: 4rem;">（無字或圖片）</span>';
        }
        charDiv.innerHTML = charDisplay;
        header.appendChild(charDiv);
        
        // 拼音（大字顯示）
        if (comp.pinyin && comp.pinyin.trim()) {
            const pinyinDiv = document.createElement('div');
            pinyinDiv.className = 'presentation-pinyin';
            pinyinDiv.textContent = comp.pinyin;
            header.appendChild(pinyinDiv);
        }
        
        // 意思（大字顯示）
        if (comp.meaning && comp.meaning.trim()) {
            const meaningDiv = document.createElement('div');
            meaningDiv.className = 'presentation-meaning';
            meaningDiv.textContent = comp.meaning;
            header.appendChild(meaningDiv);
        }
        
        card.appendChild(header);
        
        // 創建可滾動內容區域
        const scrollable = document.createElement('div');
        scrollable.className = 'presentation-scrollable';
        
        // 輔助插圖
        if (comp.image && comp.image.trim()) {
            const imageDiv = document.createElement('div');
            imageDiv.style.textAlign = 'center';
            imageDiv.style.margin = 'var(--space-6) 0';
            imageDiv.innerHTML = `<img src="${comp.image}" style="max-width:90%;border-radius:var(--radius-lg);" onerror="this.style.display='none';">`;
            scrollable.appendChild(imageDiv);
        }
        
        // 補充說明（Markdown）
        if (comp.notes && comp.notes.trim()) {
            const notesDiv = document.createElement('div');
            notesDiv.className = 'presentation-content timeline-notes';
            notesDiv.innerHTML = renderMarkdown(comp.notes);
            scrollable.appendChild(notesDiv);
        }
        
        // 如果完全空白，顯示提示
        const hasContent = (comp.character && comp.character.trim()) || 
                          (comp.display_image && comp.display_image.trim()) ||
                          (comp.pinyin && comp.pinyin.trim()) ||
                          (comp.meaning && comp.meaning.trim()) ||
                          (comp.notes && comp.notes.trim()) ||
                          (comp.image && comp.image.trim());
        
        if (!hasContent) {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.padding = 'var(--space-8)';
            emptyDiv.style.textAlign = 'center';
            emptyDiv.style.color = 'var(--gray-400)';
            emptyDiv.style.fontStyle = 'italic';
            emptyDiv.textContent = '（此項目數據不完整，請編輯補充）';
            scrollable.appendChild(emptyDiv);
        }
        
        card.appendChild(scrollable);

        return card;
    }

    // 新增：選擇卡片（點擊標題時調用）
    selectCard(index) {
        if (index < 0 || index >= this.components.length) return;
        this.selectedIndex = index;
        
        // 更新視覺提示：移除所有 selected class，添加當前選中的
        const formList = document.getElementById('form-list');
        if (formList) {
            const items = formList.querySelectorAll('.form-item');
            items.forEach((item, idx) => {
                if (idx === index) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        }
        
        this.renderPreviewList();
    }

    initSortable() {
        const formList = document.getElementById('form-list');

        // 銷毀舊的實例
        if (this.sortableFormList) {
            this.sortableFormList.destroy();
        }

        // 表單列表拖拽（右側現在是單個預覽，不需要拖拽）
        this.sortableFormList = new Sortable(formList, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: (evt) => {
                this.handleSort(evt, 'form');
            }
        });
    }

    handleSort(evt, source) {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === newIndex) return;

        // 更新數組順序
        const [moved] = this.components.splice(oldIndex, 1);
        this.components.splice(newIndex, 0, moved);

        // 更新選中索引（如果選中的卡片被移動了）
        if (this.selectedIndex === oldIndex) {
            this.selectedIndex = newIndex;
        } else if (this.selectedIndex > oldIndex && this.selectedIndex <= newIndex) {
            this.selectedIndex--;
        } else if (this.selectedIndex < oldIndex && this.selectedIndex >= newIndex) {
            this.selectedIndex++;
        }

        // 更新所有項目的 order 字段
        const updatePromises = this.components.map((comp, index) => {
            comp.order = index;
            return this.updateField(comp.id, 'order', index, false); // 不觸發重新渲染
        });

        // 等待所有更新完成後重新渲染
        Promise.all(updatePromises).then(() => {
            this.render();
            this.initSortable(); // 重新初始化拖拽
        });
    }

    debounceUpdate(componentId, field, value) {
        // 清除之前的定時器
        const timerKey = `${componentId}-${field}`;
        if (this.debounceTimers.has(timerKey)) {
            clearTimeout(this.debounceTimers.get(timerKey));
        }

        // 設置新的定時器
        const timer = setTimeout(() => {
            this.updateField(componentId, field, value);
            this.debounceTimers.delete(timerKey);
        }, 1000);

        this.debounceTimers.set(timerKey, timer);
    }

    async updateField(componentId, field, value, shouldRerender = true) {
        try {
            const component = this.components.find(c => c.id === componentId);
            if (!component) return;

            // 更新本地數據
            component[field] = value;

            // 根據類型選擇正確的 collection
            const collectionName = this.currentType === 'component' ? 'components' : 'target-characters';

            // 更新 Firestore
            await this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection(collectionName)
                .doc(componentId)
                .update({
                    [field]: value
                });

            // 重新渲染預覽（如果字段影響顯示）
            if (shouldRerender && (field === 'character' || field === 'pinyin' || field === 'notes' || field === 'image' || field === 'meaning' || field === 'display_image')) {
                this.renderPreviewList();
            }
        } catch (error) {
            console.error('Error updating field:', error);
            alert('更新失敗：' + error.message);
        }
    }

    // 新增：批量發布/取消發布
    async batchPublishComponents(publish) {
        try {
            console.log('🔄 批量發布操作開始:', {
                publish,
                currentType: this.currentType,
                currentLevel: this.currentLevel,
                currentLesson: this.currentLesson,
                componentsCount: this.components.length
            });

            // 檢查是否有選擇課次
            if (!this.currentLesson || this.currentLesson.trim() === '') {
                alert('請先選擇課次');
                return;
            }

            // 檢查是否有數據
            if (this.components.length === 0) {
                const typeLabel = this.currentType === 'component' ? '部件' : '目標字';
                alert(`沒有${typeLabel}可操作`);
                return;
            }

            const typeLabel = this.currentType === 'component' ? '部件' : '目標字';
            const action = publish ? '發布' : '取消發布';
            const count = this.components.length;
            
            console.log(`📋 準備${action} ${count} 個${typeLabel}`);
            
            if (!confirm(`確定要${action}本課所有${typeLabel}嗎？\n共 ${count} 個項目`)) {
                console.log('❌ 用戶取消操作');
                return;
            }

            // 根據類型選擇正確的 collection
            const collectionName = this.currentType === 'component' ? 'components' : 'target-characters';
            console.log(`📦 使用 collection: timeline/${this.currentLevel}/${collectionName}`);

            // 使用 Firestore batch 批量更新
            const batch = this.db.batch();
            const updateData = {
                is_published: publish,
                published: publish
            };

            let updateCount = 0;
            this.components.forEach(comp => {
                if (!comp.id) {
                    console.warn('⚠️ 跳過沒有 ID 的組件:', comp);
                    return;
                }
                const docRef = this.db
                    .collection('timeline')
                    .doc(this.currentLevel)
                    .collection(collectionName)
                    .doc(comp.id);
                batch.update(docRef, updateData);
                updateCount++;
                
                // 同時更新本地數據
                comp.is_published = publish;
                comp.published = publish;
                
                console.log(`📝 準備更新: ${comp.id} -> ${publish ? '已發布' : '未發布'}`);
            });

            console.log(`📦 準備批量更新 ${updateCount} 個文檔`);

            // 執行批量更新
            await batch.commit();

            console.log(`✅ 批量${action}完成: ${updateCount} 個${typeLabel}`);

            // 更新 UI：更新所有 checkbox 狀態
            this.updateAllCheckboxes(publish);

            // 顯示成功訊息
            alert(`✅ 已${action} ${updateCount} 個${typeLabel}`);
        } catch (error) {
            console.error(`❌ 批量${publish ? '發布' : '取消發布'}失敗:`, error);
            console.error('錯誤詳情:', {
                publish,
                currentType: this.currentType,
                currentLevel: this.currentLevel,
                currentLesson: this.currentLesson,
                componentsCount: this.components.length,
                errorMessage: error.message,
                errorStack: error.stack
            });
            alert(`批量${publish ? '發布' : '取消發布'}失敗：${error.message}\n\n請檢查瀏覽器控制台以獲取更多信息。`);
        }
    }

    // 更新所有 checkbox 狀態
    updateAllCheckboxes(isPublished) {
        let updatedCount = 0;
        let notFoundCount = 0;
        this.components.forEach(comp => {
            const checkbox = document.getElementById(`published-${comp.id}`);
            if (checkbox) {
                checkbox.checked = isPublished;
                updatedCount++;
            } else {
                console.warn(`⚠️ 找不到 checkbox: published-${comp.id}`, comp);
                notFoundCount++;
            }
        });
        console.log(`✅ 已更新 ${updatedCount} 個 checkbox 狀態${notFoundCount > 0 ? `，${notFoundCount} 個未找到` : ''}`);
    }

    // 新增：更新發布狀態（同時更新 is_published 和 published）
    async updatePublishedStatus(componentId, isPublished) {
        try {
            const component = this.components.find(c => c.id === componentId);
            if (!component) {
                console.error('❌ 找不到組件:', componentId);
                return;
            }

            // 根據類型選擇正確的 collection
            const collectionName = this.currentType === 'component' ? 'components' : 'target-characters';
            const typeLabel = this.currentType === 'component' ? '部件' : '目標字';
            
            console.log(`🔄 開始更新發布狀態:`, {
                componentId,
                isPublished,
                currentType: this.currentType,
                collectionName,
                level: this.currentLevel
            });

            // 更新本地數據
            component.is_published = isPublished;
            component.published = isPublished;

            // 同時更新兩個字段到 Firestore
            const updateData = {
                is_published: isPublished,
                published: isPublished
            };
            
            console.log(`📝 準備更新 Firestore:`, {
                path: `timeline/${this.currentLevel}/${collectionName}/${componentId}`,
                data: updateData
            });

            await this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection(collectionName)
                .doc(componentId)
                .update(updateData);

            console.log(`✅ ${typeLabel}發布狀態已更新: ${componentId} -> ${isPublished ? '已發布' : '未發布'}`);
        } catch (error) {
            console.error('❌ 更新發布狀態失敗:', error);
            console.error('錯誤詳情:', {
                componentId,
                isPublished,
                currentType: this.currentType,
                currentLevel: this.currentLevel,
                errorMessage: error.message,
                errorStack: error.stack
            });
            alert(`更新發布狀態失敗：${error.message}\n\n請檢查瀏覽器控制台以獲取更多信息。`);
            // 恢復 checkbox 狀態
            const checkbox = document.getElementById(`published-${componentId}`);
            if (checkbox) {
                checkbox.checked = !isPublished;
            }
        }
    }


    async deleteComponent(index) {
        const component = this.components[index];
        if (!component) return;

        const typeLabel = this.currentType === 'component' ? '部件' : '目標字';
        if (!confirm(`確定要刪除這個${typeLabel}嗎？\nCharacter: ${component.character || component.display_image || '(無)'}`)) {
            return;
        }

        try {
            // 根據類型選擇正確的 collection
            const collectionName = this.currentType === 'component' ? 'components' : 'target-characters';
            
            await this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection(collectionName)
                .doc(component.id)
                .delete();

            this.components.splice(index, 1);
            
            // 更新選中索引（如果刪除的是選中的卡片）
            if (this.selectedIndex === index) {
                // 如果還有卡片，選擇下一個或第一個
                if (this.components.length > 0) {
                    this.selectedIndex = Math.min(index, this.components.length - 1);
                } else {
                    this.selectedIndex = null;
                }
            } else if (this.selectedIndex > index) {
                // 如果選中的卡片在刪除的卡片之後，索引減1
                this.selectedIndex--;
            }
            
            // 更新 order
            this.components.forEach((comp, idx) => {
                comp.order = idx;
                this.updateField(comp.id, 'order', idx, false);
            });

            this.render();
            this.initSortable();
        } catch (error) {
            console.error('Error deleting component:', error);
            alert('刪除失敗：' + error.message);
        }
    }

    async addNewComponent() {
        try {
            // 根據類型選擇正確的 collection 和默認值
            const collectionName = this.currentType === 'component' ? 'components' : 'target-characters';
            
            // 創建新項目數據
            const newComponent = {
                character: '',
                display_image: '',
                pinyin: '',
                meaning: '',
                notes: '',
                image: '',
                lesson: this.currentLesson || '',
                type: this.currentType,
                is_published: true,
                published: true,
                order: this.components.length, // 設置為最後一個
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // 添加到 Firestore
            const docRef = await this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection(collectionName)
                .add(newComponent);

            console.log('✅ 新項目已添加:', docRef.id);

            // 重新載入數據
            await this.loadComponents();
            this.initSortable();

            // 自動選擇新添加的項目
            const newIndex = this.components.findIndex(c => c.id === docRef.id);
            if (newIndex !== -1) {
                this.selectedIndex = newIndex;
                this.renderPreviewList();
            }

            // 滾動到新項目
            setTimeout(() => {
                const newItem = document.querySelector(`[data-id="${docRef.id}"]`);
                if (newItem) {
                    newItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // 聚焦到第一個輸入框
                    const firstInput = newItem.querySelector('input[data-field="character"]');
                    if (firstInput) {
                        firstInput.focus();
                    }
                }
            }, 100);
        } catch (error) {
            console.error('❌ 添加新項目失敗:', error);
            alert('添加失敗：' + error.message);
        }
    }

    toggleCollapse(index) {
        const formList = document.getElementById('form-list');
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

    collapseAll() {
        const formList = document.getElementById('form-list');
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

    expandAll() {
        const formList = document.getElementById('form-list');
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

    initCloudinaryUpload() {
        if (typeof cloudinary === 'undefined') {
            console.warn('⚠️ Cloudinary widget not loaded');
            return;
        }
        
        // 字形補丁圖片上傳 widget
        this.displayImageWidget = cloudinary.createUploadWidget({
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
                const componentId = this.currentUploadComponentId;
                if (componentId) {
                    const input = document.getElementById(`display-image-${componentId}`);
                    if (input) {
                        input.value = result.info.secure_url;
                        // 自動更新 Firestore
                        this.updateField(componentId, 'display_image', result.info.secure_url);
                        // 隱藏進度條
                        const progressDiv = document.getElementById(`display-image-progress-${componentId}`);
                        if (progressDiv) {
                            progressDiv.style.display = 'none';
                        }
                    }
                }
            }
            
            // 上傳進度
            if (result && result.event === "progress") {
                const componentId = this.currentUploadComponentId;
                if (componentId) {
                    const progressBar = document.getElementById(`display-image-progress-bar-${componentId}`);
                    const progressText = document.getElementById(`display-image-progress-text-${componentId}`);
                    const progressDiv = document.getElementById(`display-image-progress-${componentId}`);
                    
                    if (progressBar && progressText && progressDiv) {
                        const percent = Math.round(result.info.progress);
                        progressBar.style.width = `${percent}%`;
                        progressText.textContent = `上傳中 ${percent}%`;
                        progressDiv.style.display = 'block';
                    }
                }
            }
        });
        
        // 輔助插圖上傳 widget
        this.imageWidget = cloudinary.createUploadWidget({
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
                const componentId = this.currentUploadComponentId;
                if (componentId) {
                    const input = document.getElementById(`image-${componentId}`);
                    if (input) {
                        input.value = result.info.secure_url;
                        // 自動更新 Firestore
                        this.updateField(componentId, 'image', result.info.secure_url);
                        // 隱藏進度條
                        const progressDiv = document.getElementById(`image-progress-${componentId}`);
                        if (progressDiv) {
                            progressDiv.style.display = 'none';
                        }
                    }
                }
            }
            
            // 上傳進度
            if (result && result.event === "progress") {
                const componentId = this.currentUploadComponentId;
                if (componentId) {
                    const progressBar = document.getElementById(`image-progress-bar-${componentId}`);
                    const progressText = document.getElementById(`image-progress-text-${componentId}`);
                    const progressDiv = document.getElementById(`image-progress-${componentId}`);
                    
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
                if (e.target.id.startsWith('upload-display-image-')) {
                    const componentId = e.target.id.replace('upload-display-image-', '');
                    this.currentUploadComponentId = componentId;
                    if (this.displayImageWidget) {
                        this.displayImageWidget.open();
                    }
                }
                // 輔助插圖上傳
                else if (e.target.id.startsWith('upload-image-')) {
                    const componentId = e.target.id.replace('upload-image-', '');
                    this.currentUploadComponentId = componentId;
                    if (this.imageWidget) {
                        this.imageWidget.open();
                    }
                }
            }
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== 模式切換 ====================
    switchMode(mode) {
        this.currentMode = mode;
        
        // 更新按鈕狀態
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
                btn.style.background = 'var(--primary)';
                btn.style.color = 'white';
            } else {
                btn.classList.remove('active');
                btn.style.background = 'var(--bg-card)';
                btn.style.color = 'var(--gray-700)';
            }
        });

        // 隱藏所有模式和預覽
        const allModes = ['component-mode', 'vocab-mode', 'note-mode', 'grammar-mode', 'practice-mode'];
        const allPreviews = ['component-preview', 'vocab-preview', 'note-preview', 'grammar-preview', 'practice-preview'];
        
        allModes.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        allPreviews.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // 顯示對應的模式和預覽
        // 使用 setTimeout 確保 DOM 更新後再調用載入函數
        if (mode === 'component') {
            const componentMode = document.getElementById('component-mode');
            const componentPreview = document.getElementById('component-preview');
            if (componentMode) componentMode.style.display = 'flex';
            if (componentPreview) componentPreview.style.display = 'block';
            setTimeout(() => this.loadComponents(), 0);
        } else if (mode === 'vocab') {
            const vocabMode = document.getElementById('vocab-mode');
            const vocabPreview = document.getElementById('vocab-preview');
            if (vocabMode) vocabMode.style.display = 'flex';
            if (vocabPreview) vocabPreview.style.display = 'block';
            // 確保讀取最新的等級和課次值
            const levelSelect = document.getElementById('level-select');
            const lessonSelect = document.getElementById('lesson-select');
            if (levelSelect) this.currentLevel = levelSelect.value;
            if (lessonSelect) this.currentLesson = lessonSelect.value;
            console.log('⚡ 切換到快速補充生詞模式，currentLevel:', this.currentLevel, 'currentLesson:', this.currentLesson);
            // 確保元素可見後再載入
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const vocabList = document.getElementById('vocab-list');
                    console.log('⚡ 檢查 vocab-list 元素:', !!vocabList);
                    if (vocabList) {
                        this.loadVocabList();
                    } else {
                        console.error('❌ vocab-list 元素未找到，重試...');
                        setTimeout(() => this.loadVocabList(), 100);
                    }
                }, 100);
            });
        } else if (mode === 'note') {
            const noteMode = document.getElementById('note-mode');
            const notePreview = document.getElementById('note-preview');
            if (noteMode) noteMode.style.display = 'flex';
            if (notePreview) notePreview.style.display = 'block';
            // 確保讀取最新的等級和課次值
            const levelSelect = document.getElementById('level-select');
            const lessonSelect = document.getElementById('lesson-select');
            if (levelSelect) this.currentLevel = levelSelect.value;
            if (lessonSelect) this.currentLesson = lessonSelect.value;
            console.log('📝 切換到 Live Note 模式，currentLevel:', this.currentLevel, 'currentLesson:', this.currentLesson);
            // 確保元素可見後再載入（使用 requestAnimationFrame 確保 DOM 更新）
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const noteList = document.getElementById('note-list');
                    console.log('📝 檢查 note-list 元素:', !!noteList);
                    if (noteList) {
                        this.loadNoteList();
                    } else {
                        console.error('❌ note-list 元素未找到，重試...');
                        setTimeout(() => this.loadNoteList(), 100);
                    }
                }, 100);
            });
        } else if (mode === 'grammar') {
            const grammarMode = document.getElementById('grammar-mode');
            const grammarPreview = document.getElementById('grammar-preview');
            if (grammarMode) grammarMode.style.display = 'flex';
            if (grammarPreview) grammarPreview.style.display = 'block';
            // 確保讀取最新的等級和課次值
            const levelSelect = document.getElementById('level-select');
            const lessonSelect = document.getElementById('lesson-select');
            if (levelSelect) this.currentLevel = levelSelect.value;
            if (lessonSelect) this.currentLesson = lessonSelect.value;
            console.log('📚 切換到 Grammar 模式，currentLevel:', this.currentLevel, 'currentLesson:', this.currentLesson);
            // 確保元素可見後再載入（使用 requestAnimationFrame 確保 DOM 更新）
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const grammarList = document.getElementById('grammar-list');
                    console.log('📚 檢查 grammar-list 元素:', !!grammarList);
                    if (grammarList) {
                        this.loadGrammarList();
                    } else {
                        console.error('❌ grammar-list 元素未找到，重試...');
                        setTimeout(() => this.loadGrammarList(), 100);
                    }
                }, 100);
            });
        } else if (mode === 'practice') {
            const practiceMode = document.getElementById('practice-mode');
            const practicePreview = document.getElementById('practice-preview');
            if (practiceMode) practiceMode.style.display = 'flex';
            if (practicePreview) practicePreview.style.display = 'block';
            // 確保讀取最新的等級和課次值
            const levelSelect = document.getElementById('level-select');
            const lessonSelect = document.getElementById('lesson-select');
            if (levelSelect) this.currentLevel = levelSelect.value;
            if (lessonSelect) this.currentLesson = lessonSelect.value;
            console.log('✏️ 切換到 Practice 模式，currentLevel:', this.currentLevel, 'currentLesson:', this.currentLesson);
            // 確保元素可見後再載入（使用 requestAnimationFrame 確保 DOM 更新）
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const practiceList = document.getElementById('practice-list');
                    console.log('✏️ 檢查 practice-list 元素:', !!practiceList);
                    if (practiceList) {
                        this.loadPracticeList();
                    } else {
                        console.error('❌ practice-list 元素未找到，重試...');
                        setTimeout(() => this.loadPracticeList(), 100);
                    }
                }, 100);
            });
        }
    }

    // ==================== 快速補充生詞功能 ====================
    async loadVocabList() {
        if (!this.currentLevel || !this.currentLesson) {
            this.vocabList = [];
            this.renderVocabList();
            return;
        }

        try {
            console.log('⚡ loadVocabList 被調用，currentLevel:', this.currentLevel, 'currentLesson:', this.currentLesson);
            
            let snapshot;
            try {
                snapshot = await this.db
                    .collection('timeline')
                    .doc(this.currentLevel)
                    .collection('vocab')
                    .doc(this.vocabCohort)
                    .collection('items')
                    .where('lesson', '==', this.currentLesson)
                    .orderBy('order', 'asc')
                    .get();
            } catch (error) {
                console.warn('⚡ orderBy 查詢失敗，改用無排序查詢:', error);
                snapshot = await this.db
                    .collection('timeline')
                    .doc(this.currentLevel)
                    .collection('vocab')
                    .doc(this.vocabCohort)
                    .collection('items')
                    .where('lesson', '==', this.currentLesson)
                    .get();
            }

            this.vocabList = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                this.vocabList.push({
                    id: doc.id,
                    character: data.character || '',
                    pinyin: data.pinyin || '',
                    meaning: data.meaning || '',
                    spanish: data.spanish || '',
                    notes: data.notes || '',
                    lesson: data.lesson || this.currentLesson,
                    order: data.order !== undefined ? data.order : 999,
                    timestamp: data.timestamp || data.createdAt || null,
                    updatedAt: data.updatedAt || null
                });
            });

            // 按 order 排序
            this.vocabList.sort((a, b) => {
                if (a.order !== b.order) {
                    return a.order - b.order;
                }
                // 如果 order 相同，按時間排序
                if (!a.timestamp && !b.timestamp) return 0;
                if (!a.timestamp) return 1;
                if (!b.timestamp) return -1;
                
                const aTime = a.timestamp.toMillis ? a.timestamp.toMillis() : 
                             (a.timestamp.toDate ? a.timestamp.toDate().getTime() : 
                             (typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : 0));
                const bTime = b.timestamp.toMillis ? b.timestamp.toMillis() : 
                             (b.timestamp.toDate ? b.timestamp.toDate().getTime() : 
                             (typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : 0));
                
                return bTime - aTime;
            });

            console.log('⚡ 找到', this.vocabList.length, '個生詞');
            this.renderVocabList();
        } catch (error) {
            console.error('⚡ 載入生詞列表失敗:', error);
            this.vocabList = [];
            this.renderVocabList();
        }
    }

    renderVocabList() {
        const vocabList = document.getElementById('vocab-list');
        console.log('⚡ renderVocabList 被調用，vocabList 元素:', !!vocabList, 'vocabList 數量:', this.vocabList.length);
        
        if (!vocabList) {
            console.error('❌ vocab-list 元素未找到！');
            return;
        }

        vocabList.innerHTML = '';

        if (!this.currentLevel || !this.currentLesson) {
            vocabList.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">👆 請先選擇課次</p>
                </div>
            `;
            return;
        }

        if (this.vocabList.length === 0) {
            vocabList.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">📭 尚無生詞</p>
                    <p style="font-size: var(--text-sm);">點擊上方「+ 新增生詞」按鈕開始添加</p>
                </div>
            `;
            return;
        }

        console.log('⚡ 開始渲染 ' + this.vocabList.length + ' 個生詞卡片');
        this.vocabList.forEach((vocab, index) => {
            const card = this.createVocabCard(vocab, index);
            vocabList.appendChild(card);
            console.log('⚡ 已添加卡片:', vocab.character || '（無生詞）', 'index:', index);
        });

        console.log('⚡ 卡片渲染完成，vocabList.children.length:', vocabList.children.length);
        
        // 預設全部折疊
        this.collapseAllVocab();
        
        // 初始化拖拽
        this.initVocabSortable();
    }

    createVocabCard(vocab, index) {
        const item = document.createElement('div');
        item.className = 'form-item collapsed';
        item.dataset.id = vocab.id;
        item.dataset.index = index;
        item.dataset.collapsed = 'true';
        
        if (this.selectedVocabIndex === index) {
            item.classList.add('selected');
        }

        const title = vocab.character || '（無生詞）';
        let timeStr = '';
        if (vocab.timestamp) {
            try {
                const date = vocab.timestamp.toDate ? vocab.timestamp.toDate() : 
                            (vocab.timestamp.toMillis ? new Date(vocab.timestamp.toMillis()) : 
                            (typeof vocab.timestamp === 'string' ? new Date(vocab.timestamp) : null));
                if (date) {
                    timeStr = ' [' + this.formatTime(date) + ']';
                }
            } catch (e) {
                console.warn('格式化時間失敗:', e);
            }
        }

        item.innerHTML = `
            <div class="form-item-header" onclick="studioManager.selectVocabCard(${index})">
                <span class="drag-handle">☰</span>
                <span class="form-item-title">${this.escapeHtml(title)}${timeStr}</span>
                <div class="form-item-actions" style="display: flex; align-items: center; gap: var(--space-2);">
                    <button class="collapse-toggle" onclick="event.stopPropagation(); studioManager.toggleVocabCollapse(${index})" title="折疊/展開">
                        ▼
                    </button>
                    <button class="btn-icon delete" onclick="event.stopPropagation(); studioManager.deleteVocab(${index})" title="刪除">🗑️</button>
                </div>
            </div>
            <div class="form-item-body">
                <div class="form-group">
                    <label>生詞 <span style="color: var(--danger);">*</span>:</label>
                    <input type="text" 
                           data-field="character" 
                           data-vocab-id="${vocab.id}"
                           value="${this.escapeHtml(vocab.character || '')}" 
                           oninput="studioManager.debounceVocabUpdate('${vocab.id}', 'character', this.value)"
                           placeholder="例如：樹木"
                           tabindex="1">
                </div>
                <div class="form-group">
                    <label>拼音 <span style="color: var(--danger);">*</span>:</label>
                    <input type="text" 
                           data-field="pinyin" 
                           data-vocab-id="${vocab.id}"
                           value="${this.escapeHtml(vocab.pinyin || '')}" 
                           oninput="studioManager.debounceVocabUpdate('${vocab.id}', 'pinyin', this.value)"
                           placeholder="例如：shùmù"
                           tabindex="2">
                </div>
                <div class="form-group">
                    <label>意思（英文）:</label>
                    <input type="text" 
                           data-field="meaning" 
                           data-vocab-id="${vocab.id}"
                           value="${this.escapeHtml(vocab.meaning || '')}" 
                           oninput="studioManager.debounceVocabUpdate('${vocab.id}', 'meaning', this.value)"
                           placeholder="例如：trees"
                           tabindex="3">
                </div>
                <div class="form-group">
                    <label>西班牙文:</label>
                    <input type="text" 
                           data-field="spanish" 
                           data-vocab-id="${vocab.id}"
                           value="${this.escapeHtml(vocab.spanish || '')}" 
                           oninput="studioManager.debounceVocabUpdate('${vocab.id}', 'spanish', this.value)"
                           placeholder="例如：árboles"
                           tabindex="4">
                </div>
                <div class="form-group">
                    <label>補充（Markdown）:</label>
                    <textarea class="markdown-content" 
                              data-field="notes" 
                              data-vocab-id="${vocab.id}"
                              oninput="studioManager.debounceVocabUpdate('${vocab.id}', 'notes', this.value); studioManager.updateVocabPreview()"
                              placeholder="例句、記憶故事等..."
                              tabindex="5">${this.escapeHtml(vocab.notes || '')}</textarea>
                </div>
            </div>
        `;

        return item;
    }

    selectVocabCard(index) {
        if (index < 0 || index >= this.vocabList.length) return;
        
        this.selectedVocabIndex = index;
        const vocab = this.vocabList[index];
        
        // 更新選中狀態
        const vocabList = document.getElementById('vocab-list');
        if (vocabList) {
            const cards = vocabList.querySelectorAll('.form-item');
            cards.forEach((card, idx) => {
                if (idx === index) {
                    card.classList.add('selected');
                } else {
                    card.classList.remove('selected');
                }
            });
        }
        
        // 更新右側預覽
        this.updateVocabPreviewFromCard(vocab);
    }

    toggleVocabCollapse(index) {
        const vocabList = document.getElementById('vocab-list');
        if (!vocabList) return;
        
        const item = vocabList.children[index];
        if (!item) return;
        
        const isCollapsed = item.dataset.collapsed === 'true';
        item.dataset.collapsed = isCollapsed ? 'false' : 'true';
        item.classList.toggle('collapsed', isCollapsed);
        
        const toggle = item.querySelector('.collapse-toggle');
        if (toggle) {
            toggle.textContent = isCollapsed ? '▲' : '▼';
        }
    }

    collapseAllVocab() {
        const vocabList = document.getElementById('vocab-list');
        if (!vocabList) return;
        
        Array.from(vocabList.children).forEach(item => {
            item.dataset.collapsed = 'true';
            item.classList.add('collapsed');
            const toggle = item.querySelector('.collapse-toggle');
            if (toggle) toggle.textContent = '▼';
        });
    }

    expandAllVocab() {
        const vocabList = document.getElementById('vocab-list');
        if (!vocabList) return;
        
        Array.from(vocabList.children).forEach(item => {
            item.dataset.collapsed = 'false';
            item.classList.remove('collapsed');
            const toggle = item.querySelector('.collapse-toggle');
            if (toggle) toggle.textContent = '▲';
        });
    }

    updateVocabPreviewFromCard(vocab) {
        const previewContent = document.getElementById('vocab-preview-content');
        if (!previewContent) return;

        const character = vocab.character || '';
        const pinyin = vocab.pinyin || '';
        const meaning = vocab.meaning || '';
        const spanish = vocab.spanish || '';
        const notes = vocab.notes || '';

        if (!character && !pinyin && !meaning) {
            previewContent.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--muted);">請在左側輸入生詞以查看預覽</div>';
            return;
        }

        let html = '<div class="presentation-card">';
        
        // 固定頂部區域（形音義）
        html += '<div class="presentation-header">';
        
        if (character) {
            html += `<div class="presentation-char">${this.escapeHtml(character)}</div>`;
        }
        
        if (pinyin) {
            html += `<div class="presentation-pinyin">${this.escapeHtml(pinyin)}</div>`;
        }
        
        if (meaning) {
            html += `<div class="presentation-meaning">${this.escapeHtml(meaning)}</div>`;
        }
        
        if (spanish) {
            html += `<div class="presentation-meaning" style="color: #6F42C1; font-style: italic;">${this.escapeHtml(spanish)}</div>`;
        }
        
        html += '</div>'; // 結束 presentation-header
        
        // 可滾動內容區域
        html += '<div class="presentation-scrollable">';
        
        if (notes) {
            html += '<div class="presentation-content">';
            if (typeof renderMarkdown === 'function') {
                html += renderMarkdown(notes);
            } else if (typeof marked !== 'undefined') {
                html += marked.parse(notes);
            } else {
                html += `<p>${this.escapeHtml(notes)}</p>`;
            }
            html += '</div>';
        }
        
        html += '</div>'; // 結束 presentation-scrollable
        html += '</div>'; // 結束 presentation-card
        
        previewContent.innerHTML = html;
    }

    initVocabSortable() {
        const vocabList = document.getElementById('vocab-list');
        if (!vocabList) return;

        if (this.sortableVocabList) {
            this.sortableVocabList.destroy();
        }

        this.sortableVocabList = new Sortable(vocabList, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: (evt) => {
                this.handleVocabSort(evt);
            }
        });
    }

    async handleVocabSort(evt) {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === newIndex) return;

        // 更新本地數組
        const [movedItem] = this.vocabList.splice(oldIndex, 1);
        this.vocabList.splice(newIndex, 0, movedItem);

        // 更新所有項目的 order
        const batch = this.db.batch();
        this.vocabList.forEach((vocab, index) => {
            vocab.order = index;
            const ref = this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection('vocab')
                .doc(this.vocabCohort)
                .collection('items')
                .doc(vocab.id);
            batch.update(ref, { order: index });
        });

        try {
            await batch.commit();
            console.log('✅ 生詞順序已更新');
            
            // 更新選中索引
            if (this.selectedVocabIndex === oldIndex) {
                this.selectedVocabIndex = newIndex;
            } else if (this.selectedVocabIndex === newIndex) {
                this.selectedVocabIndex = oldIndex;
            } else if (this.selectedVocabIndex > oldIndex && this.selectedVocabIndex <= newIndex) {
                this.selectedVocabIndex--;
            } else if (this.selectedVocabIndex < oldIndex && this.selectedVocabIndex >= newIndex) {
                this.selectedVocabIndex++;
            }
        } catch (error) {
            console.error('更新生詞順序失敗:', error);
            // 重新載入以恢復正確順序
            await this.loadVocabList();
        }
    }

    async addNewVocab() {
        if (!this.currentLevel || !this.currentLesson) {
            alert('請先選擇等級和課次');
            return;
        }

        try {
            // 計算新的 order（置頂，設為 0，其他項目 order +1）
            this.vocabList.forEach(vocab => {
                vocab.order = (vocab.order !== undefined ? vocab.order : 999) + 1;
            });

            const vocabData = {
                character: '',
                pinyin: '',
                meaning: '',
                spanish: '',
                notes: '',
                lesson: this.currentLesson,
                type: 'vocab',
                cohort: this.vocabCohort,
                order: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                timestamp: new Date().toISOString()
            };

            // 批量更新現有項目的 order
            if (this.vocabList.length > 0) {
                const batch = this.db.batch();
                this.vocabList.forEach(vocab => {
                    const ref = this.db
                        .collection('timeline')
                        .doc(this.currentLevel)
                        .collection('vocab')
                        .doc(this.vocabCohort)
                        .collection('items')
                        .doc(vocab.id);
                    batch.update(ref, { order: vocab.order });
                });
                await batch.commit();
            }

            // 新增生詞
            const docRef = await this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection('vocab')
                .doc(this.vocabCohort)
                .collection('items')
                .add(vocabData);

            await this.loadVocabList();
            
            // 自動展開並聚焦第一個輸入框
            setTimeout(() => {
                const vocabList = document.getElementById('vocab-list');
                if (vocabList && vocabList.children.length > 0) {
                    const firstCard = vocabList.children[0];
                    // 展開第一個卡片
                    firstCard.dataset.collapsed = 'false';
                    firstCard.classList.remove('collapsed');
                    const toggle = firstCard.querySelector('.collapse-toggle');
                    if (toggle) toggle.textContent = '▲';
                    
                    // 聚焦第一個輸入框
                    const firstInput = firstCard.querySelector('input[data-field="character"]');
                    if (firstInput) {
                        firstInput.focus();
                    }
                }
            }, 100);
        } catch (error) {
            console.error('新增生詞失敗:', error);
            alert('❌ 新增失敗');
        }
    }

    async loadTodayVocabList() {
        const listContent = document.getElementById('today-vocab-list-content');
        if (!listContent || !this.currentLevel || !this.currentLesson) {
            if (listContent) {
                listContent.innerHTML = '<div style="padding: var(--space-4); text-align: center; color: var(--muted);">請先選擇等級和課次</div>';
            }
            return;
        }

        try {
            listContent.innerHTML = '<div style="padding: var(--space-4); text-align: center; color: var(--muted);">載入中...</div>';
            
            const today = new Date().toISOString().split('T')[0];
            const snapshot = await this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection('vocab')
                .doc(this.vocabCohort)
                .collection('items')
                .where('lesson', '==', this.currentLesson)
                .get();

            this.todayVocabList = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const date = data.date || (data.timestamp ? data.timestamp.toDate().toISOString().split('T')[0] : '');
                if (date === today) {
                    this.todayVocabList.push({
                        id: doc.id,
                        character: data.character || '（無生詞）',
                        timestamp: data.timestamp || data.createdAt || null
                    });
                }
            });

            // 按時間排序（最新的在前）
            this.todayVocabList.sort((a, b) => {
                if (!a.timestamp && !b.timestamp) return 0;
                if (!a.timestamp) return 1;
                if (!b.timestamp) return -1;
                
                // 處理不同類型的 timestamp
                const aTime = a.timestamp.toMillis ? a.timestamp.toMillis() : 
                             (a.timestamp.toDate ? a.timestamp.toDate().getTime() : 
                             (typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : 0));
                const bTime = b.timestamp.toMillis ? b.timestamp.toMillis() : 
                             (b.timestamp.toDate ? b.timestamp.toDate().getTime() : 
                             (typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : 0));
                
                return bTime - aTime;
            });

            if (this.todayVocabList.length === 0) {
                listContent.innerHTML = '<div style="padding: var(--space-4); text-align: center; color: var(--muted);">今天尚未補充任何生詞</div>';
            } else {
                listContent.innerHTML = this.todayVocabList.map(vocab => {
                    let timeStr = '';
                    if (vocab.timestamp) {
                        try {
                            const date = vocab.timestamp.toDate ? vocab.timestamp.toDate() : 
                                        (vocab.timestamp.toMillis ? new Date(vocab.timestamp.toMillis()) : 
                                        (typeof vocab.timestamp === 'string' ? new Date(vocab.timestamp) : null));
                            if (date) {
                                timeStr = this.formatTime(date);
                            }
                        } catch (e) {
                            console.warn('格式化時間失敗:', e);
                        }
                    }
                    return `
                        <div class="vocab-list-item" style="padding: var(--space-2); margin-bottom: var(--space-2); background: var(--bg-card); border-radius: var(--radius-md); cursor: pointer; transition: all var(--duration-fast) var(--ease-out);" 
                             onclick="studioManager.loadVocab('${vocab.id}')"
                             onmouseover="this.style.background='var(--gray-100)'"
                             onmouseout="this.style.background='var(--bg-card)'">
                            • ${vocab.character} ${timeStr ? '[' + timeStr + ']' : ''}
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('載入今天生詞列表失敗:', error);
            if (listContent) {
                listContent.innerHTML = '<div style="padding: var(--space-4); text-align: center; color: var(--danger);">載入失敗</div>';
            }
        }
    }

    async loadVocab(vocabId) {
        const vocabSelect = document.getElementById('vocab-select');
        const characterInput = document.getElementById('vocab-character');
        const pinyinInput = document.getElementById('vocab-pinyin');
        const meaningInput = document.getElementById('vocab-meaning');
        const spanishInput = document.getElementById('vocab-spanish');
        const notesInput = document.getElementById('vocab-notes');
        const deleteBtn = document.getElementById('vocab-delete-btn');
        
        if (!vocabSelect || !characterInput || !pinyinInput) return;

        try {
            const doc = await this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection('vocab')
                .doc(this.vocabCohort)
                .collection('items')
                .doc(vocabId)
                .get();

            if (doc.exists) {
                const data = doc.data();
                this.currentVocabId = vocabId;
                if (characterInput) characterInput.value = data.character || '';
                if (pinyinInput) pinyinInput.value = data.pinyin || '';
                if (meaningInput) meaningInput.value = data.meaning || '';
                if (spanishInput) spanishInput.value = data.spanish || '';
                if (notesInput) notesInput.value = data.notes || '';
                if (deleteBtn) deleteBtn.style.display = 'inline-block';
                this.updateVocabPreview();
                this.updateVocabStatus('生詞已載入');
            } else {
                this.updateVocabStatus('生詞不存在');
            }
        } catch (error) {
            console.error('載入生詞失敗:', error);
            this.updateVocabStatus('載入失敗');
        }
    }

    async saveVocab(vocabId) {
        if (!vocabId || !this.currentLevel || !this.currentLesson) {
            return;
        }

        const vocab = this.vocabList.find(v => v.id === vocabId);
        if (!vocab) {
            console.error('找不到生詞:', vocabId);
            return;
        }

        const character = vocab.character ? vocab.character.trim() : '';
        const pinyin = vocab.pinyin ? vocab.pinyin.trim() : '';
        const meaning = vocab.meaning ? vocab.meaning.trim() : '';
        const spanish = vocab.spanish ? vocab.spanish.trim() : '';
        const notes = vocab.notes ? vocab.notes.trim() : '';

        // 驗證必填欄位
        if (!character || !pinyin) {
            console.warn('生詞或拼音為空，跳過保存');
            return;
        }

        try {
            const vocabData = {
                character: character,
                pinyin: pinyin,
                meaning: meaning,
                spanish: spanish,
                notes: notes,
                lesson: this.currentLesson,
                type: 'vocab',
                cohort: this.vocabCohort,
                order: vocab.order !== undefined ? vocab.order : 999,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // 如果是新生的詞（沒有 timestamp），添加創建時間
            if (!vocab.timestamp) {
                vocabData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                vocabData.timestamp = new Date().toISOString();
                const today = new Date().toISOString().split('T')[0];
                vocabData.date = today;
            }

            await this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection('vocab')
                .doc(this.vocabCohort)
                .collection('items')
                .doc(vocabId)
                .set(vocabData, { merge: true });

            console.log('✅ 生詞已保存:', vocabId, character);
        } catch (error) {
            console.error('保存生詞失敗:', error);
        }
    }

    async deleteVocab(index) {
        if (index < 0 || index >= this.vocabList.length) return;
        
        const vocab = this.vocabList[index];
        if (!vocab || !vocab.id) return;

        if (!confirm(`確定要刪除「${vocab.character || '（無生詞）'}」嗎？`)) {
            return;
        }

        try {
            await this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection('vocab')
                .doc(this.vocabCohort)
                .collection('items')
                .doc(vocab.id)
                .delete();

            // 重新載入列表
            await this.loadVocabList();
            
            // 清除選中狀態
            if (this.selectedVocabIndex === index) {
                this.selectedVocabIndex = null;
                const previewContent = document.getElementById('vocab-preview-content');
                if (previewContent) {
                    previewContent.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--muted);">請在左側選擇生詞以查看預覽</div>';
                }
            }
            
            console.log('✅ 生詞已刪除:', vocab.id);
        } catch (error) {
            console.error('刪除生詞失敗:', error);
            alert('刪除失敗');
        }
    }

    clearVocabForm() {
        // 此方法已不再使用，保留以備不時之需
    }

    debounceVocabUpdate(vocabId, field, value) {
        // 更新本地數據
        const vocab = this.vocabList.find(v => v.id === vocabId);
        if (vocab) {
            vocab[field] = value;
            
            // 如果選中的是這個卡片，更新預覽
            if (this.selectedVocabIndex !== null && this.vocabList[this.selectedVocabIndex]?.id === vocabId) {
                this.updateVocabPreviewFromCard(vocab);
            }
        }
        
        // 清除之前的定時器
        if (this.vocabSaveTimeout) {
            clearTimeout(this.vocabSaveTimeout);
        }
        
        // 設置新的定時器
        this.vocabSaveTimeout = setTimeout(() => {
            this.saveVocab(vocabId);
        }, 2000); // 2 秒後自動保存
    }

    updateVocabPreview() {
        // 此方法已不再使用，改為使用 updateVocabPreviewFromCard
    }

    updateVocabStatus(message) {
        // 此方法已不再使用，保留以備不時之需
        console.log('Vocab status:', message);
    }

    formatTime(date) {
        if (!date) return '';
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    loadCurrentModeData() {
        if (this.currentMode === 'component') {
            this.loadComponents();
        } else if (this.currentMode === 'vocab') {
            this.loadVocabList();
            this.loadTodayVocabList();
        } else if (this.currentMode === 'note') {
            this.loadNoteList();
        } else if (this.currentMode === 'grammar') {
            this.loadGrammarList();
        } else if (this.currentMode === 'practice') {
            this.loadPracticeList();
        }
    }

    // ==================== Live Note 功能 ====================
    setupNoteEventListeners() {
        const noteNewBtn = document.getElementById('note-new-btn');
        const noteCollapseAllBtn = document.getElementById('note-collapse-all-btn');
        const noteExpandAllBtn = document.getElementById('note-expand-all-btn');

        if (noteNewBtn) {
            noteNewBtn.addEventListener('click', async () => {
                await this.saveNote();
            });
        }

        if (noteCollapseAllBtn) {
            noteCollapseAllBtn.addEventListener('click', () => {
                this.collapseAllNotes();
            });
        }

        if (noteExpandAllBtn) {
            noteExpandAllBtn.addEventListener('click', () => {
                const noteList = document.getElementById('note-list');
                if (!noteList) return;
                Array.from(noteList.children).forEach((item, index) => {
                    if (item.dataset.collapsed === 'true') {
                        this.toggleNoteCollapse(index);
                    }
                });
            });
        }
    }

    async loadNoteList() {
        console.log('📝 loadNoteList 被調用，currentLevel:', this.currentLevel, 'currentLesson:', this.currentLesson);
        
        if (!this.currentLevel || !this.currentLesson) {
            console.log('⚠️ 等級或課次未選擇');
            this.notes = [];
            this.renderNoteList();
            return;
        }

        console.log('📝 開始載入筆記列表，路徑: timeline/' + this.currentLevel + '/notes/');

        try {
            console.log('📝 查詢條件: level=' + this.currentLevel + ', lesson=' + this.currentLesson);
            
            this.notes = [];
            for (const cohort of ['taigen-a', 'taigen-b']) {
                try {
                    console.log('📝 查詢 ' + cohort + ' 的筆記...');
                    let snapshot;
                    try {
                        snapshot = await this.db
                            .collection('timeline')
                            .doc(this.currentLevel)
                            .collection('notes')
                            .doc(cohort)
                            .collection('items')
                            .where('lesson', '==', this.currentLesson)
                            .orderBy('order', 'asc')
                            .get();
                    } catch (orderError) {
                        console.warn('⚠️ orderBy 查詢失敗，改用無排序查詢:', orderError);
                        snapshot = await this.db
                            .collection('timeline')
                            .doc(this.currentLevel)
                            .collection('notes')
                            .doc(cohort)
                            .collection('items')
                            .where('lesson', '==', this.currentLesson)
                            .get();
                    }

                    console.log('📝 ' + cohort + ' 找到 ' + snapshot.size + ' 個筆記');
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        this.notes.push({
                            id: doc.id,
                            cohort: cohort,
                            order: data.order !== undefined ? data.order : 999999,
                            title: data.title || '（無標題）',
                            ...data
                        });
                    });
                } catch (error) {
                    console.warn(`載入 ${cohort} 筆記時出錯:`, error);
                }
            }

            console.log('📝 總共找到 ' + this.notes.length + ' 個筆記');

            // 按 order 排序
            this.notes.sort((a, b) => {
                if (a.order !== b.order) {
                    return a.order - b.order;
                }
                return a.id.localeCompare(b.id);
            });

            // 確保所有項目都有 order 字段
            this.notes.forEach((note, index) => {
                if (note.order === undefined || note.order === 999999) {
                    note.order = index;
                }
            });

            // 自動選擇第一個卡片
            if (this.notes.length > 0) {
                this.selectedNoteIndex = 0;
            } else {
                this.selectedNoteIndex = null;
            }
            
            this.renderNoteList();
        } catch (error) {
            console.error('載入筆記列表失敗:', error);
            this.notes = [];
            this.renderNoteList();
        }
    }

    renderNoteList() {
        const noteList = document.getElementById('note-list');
        console.log('📝 renderNoteList 被調用，noteList 元素:', !!noteList, 'notes 數量:', this.notes.length);
        
        if (!noteList) {
            console.error('❌ note-list 元素未找到！');
            return;
        }

        noteList.innerHTML = '';

        if (!this.currentLevel || !this.currentLesson) {
            noteList.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">👆 請先選擇課次</p>
                </div>
            `;
            return;
        }

        if (this.notes.length === 0) {
            noteList.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">📭 尚無筆記</p>
                    <p style="font-size: var(--text-sm);">點擊上方「+ 新增筆記」按鈕開始添加</p>
                </div>
            `;
            return;
        }

        console.log('📝 開始渲染 ' + this.notes.length + ' 個筆記卡片');
        this.notes.forEach((note, index) => {
            const card = this.createNoteCard(note, index);
            noteList.appendChild(card);
            console.log('📝 已添加卡片:', note.title, 'index:', index, 'card元素:', !!card, 'card.className:', card.className);
        });

        console.log('📝 卡片渲染完成，noteList.children.length:', noteList.children.length);
        const parentEl = noteList.parentElement;
        const noteMode = document.getElementById('note-mode');
        console.log('📝 noteList 父元素:', parentEl?.id || parentEl?.className, 'display:', window.getComputedStyle(parentEl || document.body).display);
        console.log('📝 note-mode display:', window.getComputedStyle(noteMode || document.body).display);
        console.log('📝 note-mode 高度:', window.getComputedStyle(noteMode || document.body).height);
        console.log('📝 editor-content 高度:', window.getComputedStyle(parentEl || document.body).height);
        console.log('📝 noteList 高度:', window.getComputedStyle(noteList).height);
        
        // 預設全部折疊
        this.collapseAllNotes();
        
        // 初始化拖拽
        this.initNoteSortable();
        
        // 確認卡片是否可見
        setTimeout(() => {
            const firstCard = noteList.querySelector('.form-item');
            if (firstCard) {
                const rect = firstCard.getBoundingClientRect();
                const header = firstCard.querySelector('.form-item-header');
                const headerRect = header ? header.getBoundingClientRect() : null;
                console.log('📝 第一個卡片檢查:', {
                    exists: !!firstCard,
                    display: window.getComputedStyle(firstCard).display,
                    visibility: window.getComputedStyle(firstCard).visibility,
                    opacity: window.getComputedStyle(firstCard).opacity,
                    height: window.getComputedStyle(firstCard).height,
                    width: window.getComputedStyle(firstCard).width,
                    backgroundColor: window.getComputedStyle(firstCard).backgroundColor,
                    position: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right },
                    headerHeight: headerRect ? headerRect.height : 'N/A',
                    headerVisible: headerRect ? (headerRect.height > 0 && headerRect.width > 0) : false,
                    cardInViewport: rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
                });
                console.log('📝 卡片 HTML:', firstCard.outerHTML.substring(0, 200));
            } else {
                console.error('❌ 找不到第一個卡片！');
            }
            
            // 檢查所有卡片
            const allCards = noteList.querySelectorAll('.form-item');
            console.log('📝 所有卡片數量:', allCards.length);
            allCards.forEach((card, idx) => {
                const rect = card.getBoundingClientRect();
                console.log(`📝 卡片 ${idx}:`, {
                    title: card.querySelector('.form-item-title')?.textContent,
                    height: rect.height,
                    width: rect.width,
                    top: rect.top,
                    visible: rect.height > 0 && rect.width > 0
                });
            });
        }, 200);
    }

    createNoteCard(note, index) {
        const item = document.createElement('div');
        item.className = 'form-item collapsed';
        item.dataset.id = note.id;
        item.dataset.index = index;
        item.dataset.collapsed = 'true';
        
        if (this.selectedNoteIndex === index) {
            item.classList.add('selected');
        }

        item.innerHTML = `
            <div class="form-item-header" onclick="studioManager.selectNoteCard(${index})">
                <span class="drag-handle">☰</span>
                <span class="form-item-title">${this.escapeHtml(note.title || '（無標題）')} ${note.cohort === 'taigen-a' ? '(A班)' : '(B班)'}</span>
                <div class="form-item-actions" style="display: flex; align-items: center; gap: var(--space-2);">
                    <button class="collapse-toggle" onclick="event.stopPropagation(); studioManager.toggleNoteCollapse(${index})" title="折疊/展開">
                        ▼
                    </button>
                    <button class="btn-icon delete" onclick="event.stopPropagation(); studioManager.deleteNote(${index})" title="刪除">🗑️</button>
                </div>
            </div>
            <div class="form-item-body">
                <div class="form-group">
                    <label>標題:</label>
                    <input type="text" 
                           data-field="title" 
                           value="${this.escapeHtml(note.title || '')}" 
                           oninput="studioManager.debounceNoteUpdate('${note.id}', 'title', this.value)"
                           placeholder="輸入筆記標題...">
                </div>
                <div class="form-group">
                    <label>內容（支援 Markdown）:</label>
                    <textarea class="markdown-content" 
                              data-field="content" 
                              oninput="studioManager.debounceNoteUpdate('${note.id}', 'content', this.value); studioManager.updateNotePreview()"
                              placeholder="輸入筆記內容，支援 Markdown 格式...">${this.escapeHtml(note.content || '')}</textarea>
                </div>
            </div>
        `;

        return item;
    }

    async loadNote(noteId) {
        // 這個函數現在不再需要，因為我們使用卡片模式
        // 保留以備不時之需
    }

    async saveNote() {
        // 這個函數現在用於新增筆記（通過按鈕觸發）
        if (!this.currentLevel || !this.currentLesson) {
            alert('請先選擇等級和課次');
            return;
        }

        try {
            // 計算新的 order（置頂，設為 0，其他項目 order +1）
            this.notes.forEach(note => {
                note.order = (note.order || 0) + 1;
            });

            const noteData = {
                title: '（無標題）',
                content: '',
                lesson: this.currentLesson,
                type: 'note',
                order: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // 批量更新現有項目的 order
            const batch = this.db.batch();
            this.notes.forEach(note => {
                const ref = this.db
                    .collection('timeline')
                    .doc(this.currentLevel)
                    .collection('notes')
                    .doc(note.cohort)
                    .collection('items')
                    .doc(note.id);
                batch.update(ref, { order: note.order });
            });
            await batch.commit();

            // 新增筆記（預設使用 taigen-a）
            const docRef = await this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection('notes')
                .doc('taigen-a')
                .collection('items')
                .add(noteData);

            await this.loadNoteList();
            
            // 自動展開新添加的卡片
            if (this.notes.length > 0) {
                const newIndex = 0;
                this.selectedNoteIndex = newIndex;
                setTimeout(() => {
                    this.toggleNoteCollapse(newIndex);
                }, 100);
            }
        } catch (error) {
            console.error('新增筆記失敗:', error);
            alert('❌ 新增失敗');
        }
    }

    async deleteNote(index) {
        if (index === undefined || index === null || !this.notes[index]) return;

        const note = this.notes[index];
        if (!confirm(`確定要刪除筆記「${note.title}」嗎？此操作無法復原。`)) return;

        try {
            await this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection('notes')
                .doc(note.cohort)
                .collection('items')
                .doc(note.id)
                .delete();

            // 更新選中索引
            if (this.selectedNoteIndex === index) {
                this.selectedNoteIndex = null;
            } else if (this.selectedNoteIndex > index) {
                this.selectedNoteIndex--;
            }

            await this.loadNoteList();
        } catch (error) {
            console.error('刪除筆記失敗:', error);
            alert('❌ 刪除失敗');
        }
    }

    clearNoteForm() {
        const noteTitle = document.getElementById('note-title');
        const noteContent = document.getElementById('note-content');
        const noteDeleteBtn = document.getElementById('note-delete-btn');
        
        if (noteTitle) noteTitle.value = '';
        if (noteContent) noteContent.value = '';
        if (noteDeleteBtn) noteDeleteBtn.style.display = 'none';
        
        this.currentNoteId = null;
        this.updateNotePreview();
    }

    debounceNoteUpdate(noteId, field, value) {
        if (!noteId) return;
        
        clearTimeout(this.noteSaveTimeout);
        this.noteSaveTimeout = setTimeout(async () => {
            try {
                const note = this.notes.find(n => n.id === noteId);
                if (!note) return;

                const updateData = {
                    [field]: value,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await this.db
                    .collection('timeline')
                    .doc(this.currentLevel)
                    .collection('notes')
                    .doc(note.cohort)
                    .collection('items')
                    .doc(noteId)
                    .update(updateData);

                // 更新本地數據
                note[field] = value;
                console.log(`✅ 筆記 ${noteId} 的 ${field} 已更新`);
            } catch (error) {
                console.error('更新筆記失敗:', error);
            }
        }, 2000);
    }

    selectNoteCard(index) {
        this.selectedNoteIndex = index;
        this.renderNoteList();
        this.updateNotePreview();
    }

    toggleNoteCollapse(index) {
        const noteList = document.getElementById('note-list');
        if (!noteList) return;
        
        const item = noteList.children[index];
        if (!item) return;
        
        const isCollapsed = item.dataset.collapsed === 'true';
        item.dataset.collapsed = isCollapsed ? 'false' : 'true';
        item.classList.toggle('collapsed', isCollapsed);
        
        const toggle = item.querySelector('.collapse-toggle');
        if (toggle) {
            toggle.textContent = isCollapsed ? '▲' : '▼';
        }
    }

    collapseAllNotes() {
        const noteList = document.getElementById('note-list');
        if (!noteList) return;
        
        Array.from(noteList.children).forEach(item => {
            item.dataset.collapsed = 'true';
            item.classList.add('collapsed');
            const toggle = item.querySelector('.collapse-toggle');
            if (toggle) toggle.textContent = '▼';
        });
    }

    initNoteSortable() {
        const noteList = document.getElementById('note-list');
        if (!noteList) return;

        if (this.sortableNoteList) {
            this.sortableNoteList.destroy();
        }

        this.sortableNoteList = new Sortable(noteList, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: (evt) => {
                this.handleNoteSort(evt);
            }
        });
    }

    handleNoteSort(evt) {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === newIndex) return;

        const [moved] = this.notes.splice(oldIndex, 1);
        this.notes.splice(newIndex, 0, moved);

        if (this.selectedNoteIndex === oldIndex) {
            this.selectedNoteIndex = newIndex;
        } else if (this.selectedNoteIndex > oldIndex && this.selectedNoteIndex <= newIndex) {
            this.selectedNoteIndex--;
        } else if (this.selectedNoteIndex < oldIndex && this.selectedNoteIndex >= newIndex) {
            this.selectedNoteIndex++;
        }

        const updatePromises = this.notes.map((note, index) => {
            note.order = index;
            return this.db
                .collection('timeline')
                .doc(this.currentLevel)
                .collection('notes')
                .doc(note.cohort)
                .collection('items')
                .doc(note.id)
                .update({ order: index });
        });

        Promise.all(updatePromises).then(() => {
            this.renderNoteList();
        });
    }

    updateNotePreview() {
        const previewContent = document.getElementById('note-preview-content');
        if (!previewContent) return;

        if (this.selectedNoteIndex !== null && this.notes[this.selectedNoteIndex]) {
            const note = this.notes[this.selectedNoteIndex];
            const title = note.title || '（無標題）';
            const content = note.content || '';
            
            if (!content) {
                previewContent.innerHTML = `
                    <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                        <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">📝 ${this.escapeHtml(title)}</p>
                        <p style="font-size: var(--text-sm);">尚無內容</p>
                    </div>
                `;
                return;
            }

            // 使用 marked 渲染 Markdown
            if (typeof marked !== 'undefined') {
                previewContent.innerHTML = `
                    <div style="padding: var(--space-4);">
                        <h2 style="margin-bottom: var(--space-4); color: var(--gray-900);">${this.escapeHtml(title)}</h2>
                        <div class="markdown-body">${marked.parse(content)}</div>
                    </div>
                `;
            } else {
                previewContent.innerHTML = `
                    <div style="padding: var(--space-4);">
                        <h2 style="margin-bottom: var(--space-4); color: var(--gray-900);">${this.escapeHtml(title)}</h2>
                        <pre style="white-space: pre-wrap; font-family: inherit;">${this.escapeHtml(content)}</pre>
                    </div>
                `;
            }
        } else {
            previewContent.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">👆 點擊左側卡片查看預覽</p>
                </div>
            `;
        }
    }

    updateNoteStatus(message) {
        const statusEl = document.getElementById('note-status');
        if (statusEl) {
            statusEl.textContent = message;
            setTimeout(() => {
                if (statusEl.textContent === message) {
                    statusEl.textContent = '';
                }
            }, 3000);
        }
    }

    // ==================== Grammar 功能 ====================
    setupGrammarEventListeners() {
        const grammarNewBtn = document.getElementById('grammar-new-btn');
        const grammarCollapseAllBtn = document.getElementById('grammar-collapse-all-btn');
        const grammarExpandAllBtn = document.getElementById('grammar-expand-all-btn');

        if (grammarNewBtn) {
            grammarNewBtn.addEventListener('click', async () => {
                await this.saveGrammar();
            });
        }

        if (grammarCollapseAllBtn) {
            grammarCollapseAllBtn.addEventListener('click', () => {
                this.collapseAllGrammar();
            });
        }

        if (grammarExpandAllBtn) {
            grammarExpandAllBtn.addEventListener('click', () => {
                const grammarList = document.getElementById('grammar-list');
                if (!grammarList) return;
                Array.from(grammarList.children).forEach((item, index) => {
                    if (item.dataset.collapsed === 'true') {
                        this.toggleGrammarCollapse(index);
                    }
                });
            });
        }
    }

    selectGrammarCard(index) {
        this.selectedGrammarIndex = index;
        this.renderGrammarList();
        this.updateGrammarPreview();
    }

    toggleGrammarCollapse(index) {
        const grammarList = document.getElementById('grammar-list');
        if (!grammarList) return;
        const item = grammarList.children[index];
        if (!item) return;
        const isCollapsed = item.dataset.collapsed === 'true';
        item.dataset.collapsed = isCollapsed ? 'false' : 'true';
        item.classList.toggle('collapsed', isCollapsed);
        const toggle = item.querySelector('.collapse-toggle');
        if (toggle) toggle.textContent = isCollapsed ? '▲' : '▼';
    }

    collapseAllGrammar() {
        const grammarList = document.getElementById('grammar-list');
        if (!grammarList) return;
        Array.from(grammarList.children).forEach(item => {
            item.dataset.collapsed = 'true';
            item.classList.add('collapsed');
            const toggle = item.querySelector('.collapse-toggle');
            if (toggle) toggle.textContent = '▼';
        });
    }

    initGrammarSortable() {
        const grammarList = document.getElementById('grammar-list');
        if (!grammarList) return;
        if (this.sortableGrammarList) this.sortableGrammarList.destroy();
        this.sortableGrammarList = new Sortable(grammarList, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: (evt) => this.handleGrammarSort(evt)
        });
    }

    handleGrammarSort(evt) {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === newIndex) return;
        const [moved] = this.grammarList.splice(oldIndex, 1);
        this.grammarList.splice(newIndex, 0, moved);
        if (this.selectedGrammarIndex === oldIndex) {
            this.selectedGrammarIndex = newIndex;
        } else if (this.selectedGrammarIndex > oldIndex && this.selectedGrammarIndex <= newIndex) {
            this.selectedGrammarIndex--;
        } else if (this.selectedGrammarIndex < oldIndex && this.selectedGrammarIndex >= newIndex) {
            this.selectedGrammarIndex++;
        }
        const updatePromises = this.grammarList.map((grammar, index) => {
            grammar.order = index;
            return this.db.collection('courses').doc(this.currentLevel)
                .collection('lessons').doc(this.currentLesson)
                .collection('grammar').doc(grammar.id)
                .update({ order: index });
        });
        Promise.all(updatePromises).then(() => this.renderGrammarList());
    }

    debounceGrammarUpdate(grammarId, field, value) {
        if (!grammarId) return;
        clearTimeout(this.grammarSaveTimeout);
        this.grammarSaveTimeout = setTimeout(async () => {
            try {
                const grammar = this.grammarList.find(g => g.id === grammarId);
                if (!grammar) return;
                await this.db.collection('courses').doc(this.currentLevel)
                    .collection('lessons').doc(this.currentLesson)
                    .collection('grammar').doc(grammarId)
                    .update({ [field]: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                grammar[field] = value;
                console.log(`✅ 文法 ${grammarId} 的 ${field} 已更新`);
            } catch (error) {
                console.error('更新文法失敗:', error);
            }
        }, 2000);
    }

    async deleteGrammar(index) {
        if (index === undefined || index === null || !this.grammarList[index]) return;
        const grammar = this.grammarList[index];
        if (!confirm(`確定要刪除文法「${grammar.title}」嗎？此操作無法復原。`)) return;
        try {
            await this.db.collection('courses').doc(this.currentLevel)
                .collection('lessons').doc(this.currentLesson)
                .collection('grammar').doc(grammar.id).delete();
            if (this.selectedGrammarIndex === index) this.selectedGrammarIndex = null;
            else if (this.selectedGrammarIndex > index) this.selectedGrammarIndex--;
            await this.loadGrammarList();
        } catch (error) {
            console.error('刪除文法失敗:', error);
            alert('❌ 刪除失敗');
        }
    }

    async saveGrammar() {
        if (!this.currentLevel || !this.currentLesson) {
            alert('請先選擇等級和課次');
            return;
        }
        try {
            this.grammarList.forEach(g => g.order = (g.order || 0) + 1);
            const batch = this.db.batch();
            this.grammarList.forEach(grammar => {
                const ref = this.db.collection('courses').doc(this.currentLevel)
                    .collection('lessons').doc(this.currentLesson)
                    .collection('grammar').doc(grammar.id);
                batch.update(ref, { order: grammar.order });
            });
            await batch.commit();
            const docRef = await this.db.collection('courses').doc(this.currentLevel)
                .collection('lessons').doc(this.currentLesson)
                .collection('grammar').add({
                    title: '（無標題）',
                    content: '',
                    order: 0,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            await this.loadGrammarList();
            if (this.grammarList.length > 0) {
                this.selectedGrammarIndex = 0;
                setTimeout(() => this.toggleGrammarCollapse(0), 100);
            }
        } catch (error) {
            console.error('新增文法失敗:', error);
            alert('❌ 新增失敗');
        }
    }

    updateGrammarPreview() {
        const previewContent = document.getElementById('grammar-preview-content');
        if (!previewContent) return;
        if (this.selectedGrammarIndex !== null && this.grammarList[this.selectedGrammarIndex]) {
            const grammar = this.grammarList[this.selectedGrammarIndex];
            const title = grammar.title || '（無標題）';
            const content = grammar.content || '';
            if (!content) {
                previewContent.innerHTML = `<div style="padding: var(--space-8); text-align: center; color: var(--gray-500);"><p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">📚 ${this.escapeHtml(title)}</p><p style="font-size: var(--text-sm);">尚無內容</p></div>`;
                return;
            }
            if (typeof marked !== 'undefined') {
                previewContent.innerHTML = `<div style="padding: var(--space-4);"><h2 style="margin-bottom: var(--space-4); color: var(--gray-900);">${this.escapeHtml(title)}</h2><div class="markdown-body">${marked.parse(content)}</div></div>`;
            } else {
                previewContent.innerHTML = `<div style="padding: var(--space-4);"><h2 style="margin-bottom: var(--space-4); color: var(--gray-900);">${this.escapeHtml(title)}</h2><pre style="white-space: pre-wrap; font-family: inherit;">${this.escapeHtml(content)}</pre></div>`;
            }
        } else {
            previewContent.innerHTML = `<div style="padding: var(--space-8); text-align: center; color: var(--gray-500);"><p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">👆 點擊左側卡片查看預覽</p></div>`;
        }
    }

    async loadGrammarList() {
        console.log('📚 loadGrammarList 被調用，currentLevel:', this.currentLevel, 'currentLesson:', this.currentLesson);
        
        if (!this.currentLevel || !this.currentLesson) {
            console.log('⚠️ 等級或課次未選擇');
            this.grammarList = [];
            this.renderGrammarList();
            return;
        }

        try {
            console.log('📚 查詢條件: level=' + this.currentLevel + ', lesson=' + this.currentLesson);
            
            let snapshot;
            try {
                snapshot = await this.db
                    .collection('courses')
                    .doc(this.currentLevel)
                    .collection('lessons')
                    .doc(this.currentLesson)
                    .collection('grammar')
                    .orderBy('order', 'asc')
                    .get();
            } catch (orderError) {
                console.warn('⚠️ orderBy 查詢失敗，改用無排序查詢:', orderError);
                snapshot = await this.db
                    .collection('courses')
                    .doc(this.currentLevel)
                    .collection('lessons')
                    .doc(this.currentLesson)
                    .collection('grammar')
                    .get();
            }

            this.grammarList = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                this.grammarList.push({
                    id: doc.id,
                    order: data.order !== undefined ? data.order : 999999,
                    title: data.title || '（無標題）',
                    ...data
                });
            });

            // 按 order 排序
            this.grammarList.sort((a, b) => {
                if (a.order !== b.order) {
                    return a.order - b.order;
                }
                return a.id.localeCompare(b.id);
            });

            // 確保所有項目都有 order 字段
            this.grammarList.forEach((grammar, index) => {
                if (grammar.order === undefined || grammar.order === 999999) {
                    grammar.order = index;
                }
            });

            // 自動選擇第一個卡片
            if (this.grammarList.length > 0) {
                this.selectedGrammarIndex = 0;
            } else {
                this.selectedGrammarIndex = null;
            }
            
            this.renderGrammarList();
        } catch (error) {
            console.error('載入文法列表失敗:', error);
            this.grammarList = [];
            this.renderGrammarList();
        }
    }

    renderGrammarList() {
        const grammarList = document.getElementById('grammar-list');
        console.log('📚 renderGrammarList 被調用，grammarList 元素:', !!grammarList, 'grammarList 數量:', this.grammarList.length);
        
        if (!grammarList) {
            console.error('❌ grammar-list 元素未找到！');
            return;
        }

        grammarList.innerHTML = '';

        if (!this.currentLevel || !this.currentLesson) {
            grammarList.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">👆 請先選擇課次</p>
                </div>
            `;
            return;
        }

        if (this.grammarList.length === 0) {
            grammarList.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">📭 尚無文法</p>
                    <p style="font-size: var(--text-sm);">點擊上方「+ 新增文法」按鈕開始添加</p>
                </div>
            `;
            return;
        }

        console.log('📚 開始渲染 ' + this.grammarList.length + ' 個文法卡片');
        this.grammarList.forEach((grammar, index) => {
            const card = this.createGrammarCard(grammar, index);
            grammarList.appendChild(card);
            console.log('📚 已添加卡片:', grammar.title, 'index:', index);
        });

        console.log('📚 卡片渲染完成，grammarList.children.length:', grammarList.children.length);

        this.collapseAllGrammar();
        this.initGrammarSortable();
    }

    createGrammarCard(grammar, index) {
        const item = document.createElement('div');
        item.className = 'form-item collapsed';
        item.dataset.id = grammar.id;
        item.dataset.index = index;
        item.dataset.collapsed = 'true';
        
        if (this.selectedGrammarIndex === index) {
            item.classList.add('selected');
        }

        item.innerHTML = `
            <div class="form-item-header" onclick="studioManager.selectGrammarCard(${index})">
                <span class="drag-handle">☰</span>
                <span class="form-item-title">${this.escapeHtml(grammar.title || '（無標題）')}</span>
                <div class="form-item-actions" style="display: flex; align-items: center; gap: var(--space-2);">
                    <button class="collapse-toggle" onclick="event.stopPropagation(); studioManager.toggleGrammarCollapse(${index})" title="折疊/展開">
                        ▼
                    </button>
                    <button class="btn-icon delete" onclick="event.stopPropagation(); studioManager.deleteGrammar(${index})" title="刪除">🗑️</button>
                </div>
            </div>
            <div class="form-item-body">
                <div class="form-group">
                    <label>標題:</label>
                    <input type="text" 
                           data-field="title" 
                           value="${this.escapeHtml(grammar.title || '')}" 
                           oninput="studioManager.debounceGrammarUpdate('${grammar.id}', 'title', this.value)"
                           placeholder="輸入文法標題...">
                </div>
                <div class="form-group">
                    <label>內容（支援 Markdown）:</label>
                    <textarea class="markdown-content" 
                              data-field="content" 
                              oninput="studioManager.debounceGrammarUpdate('${grammar.id}', 'content', this.value); studioManager.updateGrammarPreview()"
                              placeholder="輸入文法內容，支援 Markdown 格式...">${this.escapeHtml(grammar.content || '')}</textarea>
                </div>
            </div>
        `;

        return item;
    }


    clearGrammarForm() {
        const grammarTitle = document.getElementById('grammar-title');
        const grammarContent = document.getElementById('grammar-content');
        const grammarDeleteBtn = document.getElementById('grammar-delete-btn');
        
        if (grammarTitle) grammarTitle.value = '';
        if (grammarContent) grammarContent.value = '';
        if (grammarDeleteBtn) grammarDeleteBtn.style.display = 'none';
        
        this.currentGrammarId = null;
        this.updateGrammarPreview();
    }

    debounceGrammarUpdate() {
        clearTimeout(this.grammarSaveTimeout);
        this.grammarSaveTimeout = setTimeout(() => {
            this.saveGrammar();
        }, 2000);
    }

    updateGrammarPreview() {
        const grammarContent = document.getElementById('grammar-content');
        const previewContent = document.getElementById('grammar-preview-content');
        
        if (!grammarContent || !previewContent) return;

        const content = grammarContent.value.trim();
        
        if (!content) {
            previewContent.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--muted);">請在左側輸入內容以查看預覽</div>';
            return;
        }

        if (typeof renderMarkdown === 'function') {
            previewContent.innerHTML = renderMarkdown(content);
        } else if (typeof marked !== 'undefined') {
            previewContent.innerHTML = marked.parse(content);
        } else {
            previewContent.innerHTML = '<div style="padding: 20px; color: #666;">Markdown 渲染器未載入</div>';
        }
    }

    updateGrammarStatus(message) {
        const statusEl = document.getElementById('grammar-status');
        if (statusEl) {
            statusEl.textContent = message;
            setTimeout(() => {
                if (statusEl.textContent === message) {
                    statusEl.textContent = '';
                }
            }, 3000);
        }
    }

    // ==================== Practice 功能 ====================

    async loadPracticeList() {
        console.log('✏️ loadPracticeList 被調用，currentLevel:', this.currentLevel, 'currentLesson:', this.currentLesson);
        
        if (!this.currentLevel || !this.currentLesson) {
            console.log('⚠️ 等級或課次未選擇');
            this.practiceList = [];
            this.renderPracticeList();
            return;
        }

        try {
            console.log('✏️ 查詢條件: level=' + this.currentLevel + ', lesson=' + this.currentLesson);
            
            let snapshot;
            try {
                snapshot = await this.db
                    .collection('courses')
                    .doc(this.currentLevel)
                    .collection('lessons')
                    .doc(this.currentLesson)
                    .collection('practice')
                    .orderBy('order', 'asc')
                    .get();
            } catch (orderError) {
                console.warn('⚠️ orderBy 查詢失敗，改用無排序查詢:', orderError);
                snapshot = await this.db
                    .collection('courses')
                    .doc(this.currentLevel)
                    .collection('lessons')
                    .doc(this.currentLesson)
                    .collection('practice')
                    .get();
            }

            this.practiceList = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                this.practiceList.push({
                    id: doc.id,
                    order: data.order !== undefined ? data.order : 999999,
                    title: data.title || '（無標題）',
                    ...data
                });
            });

            // 按 order 排序
            this.practiceList.sort((a, b) => {
                if (a.order !== b.order) {
                    return a.order - b.order;
                }
                return a.id.localeCompare(b.id);
            });

            // 確保所有項目都有 order 字段
            this.practiceList.forEach((practice, index) => {
                if (practice.order === undefined || practice.order === 999999) {
                    practice.order = index;
                }
            });

            // 自動選擇第一個卡片
            if (this.practiceList.length > 0) {
                this.selectedPracticeIndex = 0;
            } else {
                this.selectedPracticeIndex = null;
            }
            
            this.renderPracticeList();
        } catch (error) {
            console.error('載入練習列表失敗:', error);
            this.practiceList = [];
            this.renderPracticeList();
        }
    }

    renderPracticeList() {
        const practiceList = document.getElementById('practice-list');
        console.log('✏️ renderPracticeList 被調用，practiceList 元素:', !!practiceList, 'practiceList 數量:', this.practiceList.length);
        
        if (!practiceList) {
            console.error('❌ practice-list 元素未找到！');
            return;
        }
        
        practiceList.innerHTML = '';
        
        if (!this.currentLevel || !this.currentLesson) {
            practiceList.innerHTML = `<div style="padding: var(--space-8); text-align: center; color: var(--gray-500);"><p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">👆 請先選擇課次</p></div>`;
            return;
        }
        
        if (this.practiceList.length === 0) {
            practiceList.innerHTML = `<div style="padding: var(--space-8); text-align: center; color: var(--gray-500);"><p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">📭 尚無練習</p><p style="font-size: var(--text-sm);">點擊上方「+ 新增練習」按鈕開始添加</p></div>`;
            return;
        }
        
        console.log('✏️ 開始渲染 ' + this.practiceList.length + ' 個練習卡片');
        this.practiceList.forEach((practice, index) => {
            const card = this.createPracticeCard(practice, index);
            practiceList.appendChild(card);
            console.log('✏️ 已添加卡片:', practice.title, 'index:', index);
        });
        
        console.log('✏️ 卡片渲染完成，practiceList.children.length:', practiceList.children.length);
        
        this.collapseAllPractice();
        this.initPracticeSortable();
    }

    createPracticeCard(practice, index) {
        const item = document.createElement('div');
        item.className = 'form-item collapsed';
        item.dataset.id = practice.id;
        item.dataset.index = index;
        item.dataset.collapsed = 'true';
        if (this.selectedPracticeIndex === index) item.classList.add('selected');
        item.innerHTML = `
            <div class="form-item-header" onclick="studioManager.selectPracticeCard(${index})">
                <span class="drag-handle">☰</span>
                <span class="form-item-title">${this.escapeHtml(practice.title || '（無標題）')}</span>
                <div class="form-item-actions" style="display: flex; align-items: center; gap: var(--space-2);">
                    <button class="collapse-toggle" onclick="event.stopPropagation(); studioManager.togglePracticeCollapse(${index})" title="折疊/展開">▼</button>
                    <button class="btn-icon delete" onclick="event.stopPropagation(); studioManager.deletePractice(${index})" title="刪除">🗑️</button>
                </div>
            </div>
            <div class="form-item-body">
                <div class="form-group">
                    <label>標題:</label>
                    <input type="text" data-field="title" value="${this.escapeHtml(practice.title || '')}" oninput="studioManager.debouncePracticeUpdate('${practice.id}', 'title', this.value)" placeholder="輸入練習標題...">
                </div>
                <div class="form-group">
                    <label>內容（支援 Markdown）:</label>
                    <textarea class="markdown-content" data-field="content" oninput="studioManager.debouncePracticeUpdate('${practice.id}', 'content', this.value); studioManager.updatePracticePreview()" placeholder="輸入練習內容，支援 Markdown 格式...">${this.escapeHtml(practice.content || '')}</textarea>
                </div>
            </div>
        `;
        return item;
    }

    setupPracticeEventListeners() {
        const practiceNewBtn = document.getElementById('practice-new-btn');
        const practiceCollapseAllBtn = document.getElementById('practice-collapse-all-btn');
        const practiceExpandAllBtn = document.getElementById('practice-expand-all-btn');
        if (practiceNewBtn) practiceNewBtn.addEventListener('click', async () => await this.savePractice());
        if (practiceCollapseAllBtn) practiceCollapseAllBtn.addEventListener('click', () => this.collapseAllPractice());
        if (practiceExpandAllBtn) practiceExpandAllBtn.addEventListener('click', () => {
            const practiceList = document.getElementById('practice-list');
            if (!practiceList) return;
            Array.from(practiceList.children).forEach((item, index) => {
                if (item.dataset.collapsed === 'true') this.togglePracticeCollapse(index);
            });
        });
    }

    selectPracticeCard(index) {
        this.selectedPracticeIndex = index;
        this.renderPracticeList();
        this.updatePracticePreview();
    }

    togglePracticeCollapse(index) {
        const practiceList = document.getElementById('practice-list');
        if (!practiceList) return;
        const item = practiceList.children[index];
        if (!item) return;
        const isCollapsed = item.dataset.collapsed === 'true';
        item.dataset.collapsed = isCollapsed ? 'false' : 'true';
        item.classList.toggle('collapsed', isCollapsed);
        const toggle = item.querySelector('.collapse-toggle');
        if (toggle) toggle.textContent = isCollapsed ? '▲' : '▼';
    }

    collapseAllPractice() {
        const practiceList = document.getElementById('practice-list');
        if (!practiceList) return;
        Array.from(practiceList.children).forEach(item => {
            item.dataset.collapsed = 'true';
            item.classList.add('collapsed');
            const toggle = item.querySelector('.collapse-toggle');
            if (toggle) toggle.textContent = '▼';
        });
    }

    initPracticeSortable() {
        const practiceList = document.getElementById('practice-list');
        if (!practiceList) return;
        if (this.sortablePracticeList) this.sortablePracticeList.destroy();
        this.sortablePracticeList = new Sortable(practiceList, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: (evt) => this.handlePracticeSort(evt)
        });
    }

    handlePracticeSort(evt) {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === newIndex) return;
        const [moved] = this.practiceList.splice(oldIndex, 1);
        this.practiceList.splice(newIndex, 0, moved);
        if (this.selectedPracticeIndex === oldIndex) this.selectedPracticeIndex = newIndex;
        else if (this.selectedPracticeIndex > oldIndex && this.selectedPracticeIndex <= newIndex) this.selectedPracticeIndex--;
        else if (this.selectedPracticeIndex < oldIndex && this.selectedPracticeIndex >= newIndex) this.selectedPracticeIndex++;
        const updatePromises = this.practiceList.map((practice, index) => {
            practice.order = index;
            return this.db.collection('courses').doc(this.currentLevel)
                .collection('lessons').doc(this.currentLesson)
                .collection('practice').doc(practice.id)
                .update({ order: index });
        });
        Promise.all(updatePromises).then(() => this.renderPracticeList());
    }

    debouncePracticeUpdate(practiceId, field, value) {
        if (!practiceId) return;
        clearTimeout(this.practiceSaveTimeout);
        this.practiceSaveTimeout = setTimeout(async () => {
            try {
                const practice = this.practiceList.find(p => p.id === practiceId);
                if (!practice) return;
                await this.db.collection('courses').doc(this.currentLevel)
                    .collection('lessons').doc(this.currentLesson)
                    .collection('practice').doc(practiceId)
                    .update({ [field]: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                practice[field] = value;
                console.log(`✅ 練習 ${practiceId} 的 ${field} 已更新`);
            } catch (error) {
                console.error('更新練習失敗:', error);
            }
        }, 2000);
    }

    async deletePractice(index) {
        if (index === undefined || index === null || !this.practiceList[index]) return;
        const practice = this.practiceList[index];
        if (!confirm(`確定要刪除練習「${practice.title}」嗎？此操作無法復原。`)) return;
        try {
            await this.db.collection('courses').doc(this.currentLevel)
                .collection('lessons').doc(this.currentLesson)
                .collection('practice').doc(practice.id).delete();
            if (this.selectedPracticeIndex === index) this.selectedPracticeIndex = null;
            else if (this.selectedPracticeIndex > index) this.selectedPracticeIndex--;
            await this.loadPracticeList();
        } catch (error) {
            console.error('刪除練習失敗:', error);
            alert('❌ 刪除失敗');
        }
    }

    async savePractice() {
        if (!this.currentLevel || !this.currentLesson) {
            alert('請先選擇等級和課次');
            return;
        }
        try {
            this.practiceList.forEach(p => p.order = (p.order || 0) + 1);
            const batch = this.db.batch();
            this.practiceList.forEach(practice => {
                const ref = this.db.collection('courses').doc(this.currentLevel)
                    .collection('lessons').doc(this.currentLesson)
                    .collection('practice').doc(practice.id);
                batch.update(ref, { order: practice.order });
            });
            await batch.commit();
            const docRef = await this.db.collection('courses').doc(this.currentLevel)
                .collection('lessons').doc(this.currentLesson)
                .collection('practice').add({
                    title: '（無標題）',
                    content: '',
                    order: 0,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            await this.loadPracticeList();
            if (this.practiceList.length > 0) {
                this.selectedPracticeIndex = 0;
                setTimeout(() => this.togglePracticeCollapse(0), 100);
            }
        } catch (error) {
            console.error('新增練習失敗:', error);
            alert('❌ 新增失敗');
        }
    }

    updatePracticePreview() {
        const previewContent = document.getElementById('practice-preview-content');
        if (!previewContent) return;
        if (this.selectedPracticeIndex !== null && this.practiceList[this.selectedPracticeIndex]) {
            const practice = this.practiceList[this.selectedPracticeIndex];
            const title = practice.title || '（無標題）';
            const content = practice.content || '';
            if (!content) {
                previewContent.innerHTML = `<div style="padding: var(--space-8); text-align: center; color: var(--gray-500);"><p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">✏️ ${this.escapeHtml(title)}</p><p style="font-size: var(--text-sm);">尚無內容</p></div>`;
                return;
            }
            if (typeof marked !== 'undefined') {
                previewContent.innerHTML = `<div style="padding: var(--space-4);"><h2 style="margin-bottom: var(--space-4); color: var(--gray-900);">${this.escapeHtml(title)}</h2><div class="markdown-body">${marked.parse(content)}</div></div>`;
            } else {
                previewContent.innerHTML = `<div style="padding: var(--space-4);"><h2 style="margin-bottom: var(--space-4); color: var(--gray-900);">${this.escapeHtml(title)}</h2><pre style="white-space: pre-wrap; font-family: inherit;">${this.escapeHtml(content)}</pre></div>`;
            }
        } else {
            previewContent.innerHTML = `<div style="padding: var(--space-8); text-align: center; color: var(--gray-500);"><p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">👆 點擊左側卡片查看預覽</p></div>`;
        }
    }

    updatePracticeStatus(message) {
        const statusEl = document.getElementById('practice-status');
        if (statusEl) {
            statusEl.textContent = message;
            setTimeout(() => {
                if (statusEl.textContent === message) {
                    statusEl.textContent = '';
                }
            }, 3000);
        }
    }
}

// 初始化 Studio Manager
let studioManager;

// 確保在 DOM 準備好後初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚀 Studio Manager 初始化中...');
        studioManager = new StudioManager();
    });
} else {
    // DOM 已經準備好
    console.log('🚀 Studio Manager 初始化中...');
    studioManager = new StudioManager();
}

