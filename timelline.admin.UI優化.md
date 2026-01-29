
Studio.html 核心功能清單
一、整體架構
雙面板設計
左側：編輯面板（可調整寬度、可收合）
右側：即時預覽面板
中間：可拖曳調整寬度的分隔線
響應式佈局
使用 CSS Variables 統一管理樣式
支援面板收合/展開
支援拖曳調整左右面板寬度
二、編輯面板功能
1. 表單卡片系統
可折疊/展開的卡片（預設收合）
每個卡片包含：
拖曳條（左側 12px，用於拖曳排序）
預覽區（顯示字/圖片）
發布狀態切換開關
完整表單欄位
2. 互動功能
點擊卡片標題：高亮顯示 + 右側即時預覽
雙擊卡片標題：展開/收合表單
拖曳排序：左側拖曳條，Y 軸跟隨滑鼠，其他卡片平滑讓位
全部展開/收合按鈕
新增項目按鈕
刪除項目按鈕（帶確認）
3. 表單欄位即時保存
輸入時自動防抖保存（1 秒延遲）
修改即時反映到右側預覽
修改字元/圖片時，卡片預覽區即時更新
三、預覽面板功能
1. 即時預覽
點擊左側卡片時，右側顯示該項目的完整預覽
支援 Markdown 渲染
支援圖片顯示（含字形補丁系統）
自動滾動到頂部
2. 預覽內容
字元/圖片顯示
拼音、意思
部件拆解
書本解釋（Markdown）
記憶故事（Markdown）
發音提示（Markdown）
詞組範例
例句
四、數據管理功能
1. 數據載入
下拉選單選擇課次
Tab 切換類型（部件/目標字）
從 Firebase Firestore 載入數據
按 order 欄位自動排序
2. 數據保存
防抖自動保存（1 秒延遲）
切換類型時自動保存當前數據
批量發布/取消發布功能
3. 發布管理
單個項目發布狀態切換
整課批量發布/取消發布
發布狀態視覺化顯示
五、技術實現要點
1. 核心 JavaScript 函數
- loadData() - 載入數據- loadDataForType() - 載入指定類型數據- renderEditPanel() - 渲染編輯面板- renderPreviewPanel() - 渲染預覽面板- createFormItem() - 創建表單卡片- attachFormEvents() - 綁定表單事件- handleFormItemClick() - 處理卡片點擊（單擊/雙擊）- toggleFormItem() - 展開/收合卡片- addItem() - 新增項目- deleteItem() - 刪除項目- saveToFirebase() - 保存到 Firebase- debounceSave() - 防抖保存- initDragAndDrop() - 初始化拖曳功能- handleDragMouseMove() - 處理拖曳移動（Y軸跟隨）- handleDragMouseUp() - 處理拖曳結束
2. 關鍵 CSS 類別
- .studio-container - 主容器- .edit-panel - 編輯面板- .preview-panel - 預覽面板- .form-item-card - 表單卡片- .drag-bar - 拖曳條- .form-item-card.dragging - 拖曳中狀態- .form-item-card.collapsed/expanded - 收合/展開狀態- .form-item-card.highlighted - 高亮狀態
3. 依賴項
Firebase SDK (Firestore, Auth)
Marked.js (Markdown 解析)
Cloudinary Widget (圖片上傳，可選)
六、用戶體驗細節
視覺反饋
點擊卡片時高亮顯示（3 秒後自動消失）
拖曳時卡片跟隨滑鼠（Y 軸）
其他卡片平滑讓位動畫
狀態消息提示（成功/錯誤/資訊）
操作流程
選擇課次 → 選擇類型 → 編輯內容 → 即時預覽
單擊卡片：預覽 + 高亮
雙擊卡片：展開表單
拖曳排序：即時更新順序並保存