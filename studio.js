// Studio - Component Management Dashboard
// 管理 timeline/${level}/components 集合

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

            // 載入數據
            console.log('🔧 載入數據...');
            await this.loadComponents();

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
            levelSelect.addEventListener('change', (e) => {
                this.currentLevel = e.target.value;
                this.loadComponents();
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
            lessonSelect.addEventListener('change', (e) => {
                this.currentLesson = e.target.value;
                this.loadComponents();
            });
        }

        // 側邊欄切換
        const sidebarToggle = document.getElementById('sidebar-toggle');
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
                        if (sidebarToggle) {
                            sidebarToggle.textContent = '▶';
                            sidebarToggle.title = '顯示編輯面板';
                        }
                    } else if (newWidth >= 10 && layout.classList.contains('sidebar-hidden')) {
                        layout.classList.remove('sidebar-hidden');
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

        // 模態框關閉
        const modalClose = document.getElementById('modal-close');
        const modal = document.getElementById('teaching-modal');
        modalClose.addEventListener('click', () => {
            modal.classList.remove('active');
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });

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
    }

    async loadComponents() {
        try {
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
            this.render();
        } catch (error) {
            console.error('❌ 載入數據失敗:', error);
            const collectionName = this.currentType === 'component' ? 'components' : 'target-characters';
            const typeLabel = this.currentType === 'component' ? '部件' : '目標字';
            // 顯示錯誤信息在頁面上
            const formList = document.getElementById('form-list');
            const previewList = document.getElementById('preview-list');
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
            if (previewList) {
                previewList.innerHTML = `<div style="padding: var(--space-4); color: var(--danger);">
                    <p>❌ 載入${typeLabel}失敗</p>
                </div>`;
            }
        }
    }

    render() {
        this.renderFormList();
        this.renderPreviewList();
    }

    renderFormList() {
        const formList = document.getElementById('form-list');
        formList.innerHTML = '';

        if (this.components.length === 0) {
            const collectionName = this.currentType === 'component' ? 'components' : 'target-characters';
            const typeLabel = this.currentType === 'component' ? '部件' : '目標字';
            const lessonFilter = this.currentLesson ? `，課次: ${this.currentLesson}` : '';
            formList.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">📭 尚無數據</p>
                    <p style="font-size: var(--text-sm);">當前 Level: <strong>${this.currentLevel}</strong></p>
                    <p style="font-size: var(--text-sm);">類型: <strong>${typeLabel}</strong>${lessonFilter}</p>
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
    }

    createFormItem(comp, index) {
        const item = document.createElement('div');
        item.className = 'form-item';
        item.dataset.id = comp.id;
        item.dataset.index = index;
        // 添加折疊狀態數據屬性，預設為展開
        item.dataset.collapsed = 'false';

        item.innerHTML = `
            <div class="form-item-header">
                <span class="drag-handle">☰</span>
                <span class="form-item-title">項目 #${index + 1}</span>
                <div class="form-item-actions">
                    <button class="collapse-toggle" onclick="studioManager.toggleCollapse(${index})" title="折疊/展開">
                        ▼
                    </button>
                    <button class="btn-icon" onclick="studioManager.openTeachingModal(${index})" title="教學視圖">👁️</button>
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
                    <div class="checkbox-group" style="display: flex; align-items: center; gap: var(--space-2);">
                        <input type="checkbox" 
                               id="published-${comp.id}" 
                               ${(comp.is_published !== false && comp.published !== false) ? 'checked' : ''} 
                               onchange="studioManager.updateField('${comp.id}', 'is_published', this.checked)">
                        <label for="published-${comp.id}" style="margin: 0;">Published (發布給 Review 系統)</label>
                        <button class="btn-icon delete" onclick="studioManager.deleteComponent(${index})" title="刪除" style="margin-left: auto;">🗑️</button>
                    </div>
                </div>
            </div>
        `;

        return item;
    }

    renderPreviewList() {
        const previewList = document.getElementById('preview-list');
        previewList.innerHTML = '';

        if (this.components.length === 0) {
            previewList.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--gray-500);">
                    <p style="font-size: var(--text-lg); margin-bottom: var(--space-2);">📭 尚無預覽內容</p>
                    <p style="font-size: var(--text-sm);">請在左側編輯面板添加數據</p>
                </div>
            `;
            return;
        }

        this.components.forEach((comp, index) => {
            const card = this.createPreviewCard(comp, index);
            previewList.appendChild(card);
        });
    }

    createPreviewCard(comp, index) {
        const card = document.createElement('div');
        card.className = 'timeline-card';
        if (comp.isCharacterCard) {
            card.classList.add('character-card');
        }
        card.dataset.id = comp.id;
        card.dataset.index = index;
        card.style.cursor = 'pointer';
        
        // 單擊：打開教學模態框
        card.addEventListener('click', () => {
            this.openTeachingModal(index);
        });
        
        // 雙擊：跳轉到對應的編輯表單項目
        card.addEventListener('dblclick', () => {
            this.scrollToFormItem(comp.id, index);
        });

        // 字（優先顯示文字，否則顯示圖片）
        const charDiv = document.createElement('div');
        charDiv.className = 'line-character';
        
        let charDisplay = '';
        if (comp.character && comp.character.trim()) {
            charDisplay = comp.character;
        } else if (comp.display_image && comp.display_image.trim()) {
            charDisplay = `<img src="${comp.display_image}" class="img-comp" alt="comp" style="height: 1.8em; width: auto; vertical-align: middle;">`;
        }
        // 如果都沒有，顯示提示
        if (!charDisplay) {
            charDisplay = '<span style="color: var(--gray-400); font-style: italic;">（無字或圖片）</span>';
        }
        charDiv.innerHTML = charDisplay;
        card.appendChild(charDiv);

        // 拼音
        const pinyinDiv = document.createElement('div');
        pinyinDiv.className = 'line-pinyin';
        pinyinDiv.textContent = comp.pinyin || '';
        card.appendChild(pinyinDiv);

        // 意思
        const meaningDiv = document.createElement('div');
        meaningDiv.className = 'line-en';
        meaningDiv.textContent = comp.meaning || '';
        card.appendChild(meaningDiv);

        // 輔助插圖
        if (comp.image && comp.image.trim()) {
            const imageDiv = document.createElement('div');
            imageDiv.style.marginTop = '10px';
            imageDiv.innerHTML = `<img src="${comp.image}" style="max-width:100%;border-radius:6px;" onerror="this.style.display='none';">`;
            card.appendChild(imageDiv);
        }

        // 補充說明（支援 Markdown，但使用簡化樣式）
        if (comp.notes && comp.notes.trim()) {
            const notesDiv = document.createElement('div');
            notesDiv.className = 'timeline-notes';
            notesDiv.innerHTML = renderMarkdown(comp.notes);
            card.appendChild(notesDiv);
        }

        // 如果卡片完全空白，顯示提示
        const hasContent = (comp.character && comp.character.trim()) || 
                          (comp.display_image && comp.display_image.trim()) ||
                          (comp.pinyin && comp.pinyin.trim()) ||
                          (comp.meaning && comp.meaning.trim()) ||
                          (comp.notes && comp.notes.trim()) ||
                          (comp.image && comp.image.trim());
        
        if (!hasContent) {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.padding = '20px';
            emptyDiv.style.textAlign = 'center';
            emptyDiv.style.color = 'var(--gray-400)';
            emptyDiv.style.fontStyle = 'italic';
            emptyDiv.textContent = '（此項目數據不完整，請編輯補充）';
            card.appendChild(emptyDiv);
        }

        return card;
    }

    initSortable() {
        const formList = document.getElementById('form-list');
        const previewList = document.getElementById('preview-list');

        // 銷毀舊的實例
        if (this.sortableFormList) {
            this.sortableFormList.destroy();
        }
        if (this.sortablePreviewList) {
            this.sortablePreviewList.destroy();
        }

        // 表單列表拖拽
        this.sortableFormList = new Sortable(formList, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: (evt) => {
                this.handleSort(evt, 'form');
            }
        });

        // 預覽列表拖拽
        this.sortablePreviewList = new Sortable(previewList, {
            handle: '.timeline-card',
            animation: 150,
            onEnd: (evt) => {
                this.handleSort(evt, 'preview');
            }
        });
    }

    handleSort(evt, source) {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === newIndex) return;

        // 暫時禁用另一個列表的拖拽，避免衝突
        if (source === 'form' && this.sortablePreviewList) {
            this.sortablePreviewList.option('disabled', true);
        } else if (source === 'preview' && this.sortableFormList) {
            this.sortableFormList.option('disabled', true);
        }

        // 更新數組順序
        const [moved] = this.components.splice(oldIndex, 1);
        this.components.splice(newIndex, 0, moved);

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

    scrollToFormItem(componentId, index) {
        // 檢查編輯面板是否被最小化，如果是則展開
        const layout = document.getElementById('studio-layout');
        const sidebarToggle = document.getElementById('sidebar-toggle');
        
        if (layout && layout.classList.contains('sidebar-hidden')) {
            layout.classList.remove('sidebar-hidden');
            if (sidebarToggle) {
                sidebarToggle.textContent = '◀';
                sidebarToggle.title = '隱藏編輯面板';
            }
        }
        
        // 找到對應的編輯表單項目
        const formList = document.getElementById('form-list');
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

    openTeachingModal(index) {
        const component = this.components[index];
        if (!component) return;

        const modal = document.getElementById('teaching-modal');
        const modalBody = document.getElementById('modal-body');

        // 創建教學視圖卡片
        const card = this.createPreviewCard(component, index);
        modalBody.innerHTML = '';
        modalBody.appendChild(card);

        modal.classList.add('active');
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

            // 滾動到新項目
            setTimeout(() => {
                const newItem = document.querySelector(`[data-id="${docRef.id}"]`);
                if (newItem) {
                    newItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    newItem.classList.add('active');
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

