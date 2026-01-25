# 更新日志

## 版本号规则（SemVer：MAJOR.MINOR.PATCH）

- **MAJOR（X.0.0）**：有破坏性变更（旧链接/旧流程/旧数据读取可能失效）。
- **MINOR（x.Y.0）**：新增功能或明显改版，但保持向后兼容（旧用法仍可用）。
- **PATCH（x.y.Z）**：修 bug / 文案 / 样式 / 小优化，不改变对外行为契约。

## [3.7.1] - 2026-01-22

### 🐛 修復：平板模式統一體驗 + 側邊欄收合問題

- ✅ **平板模式統一使用橫條拉桿**：
  - 將平板模式（1024px - 1200px）改為使用橫條拉桿，與手機模式一致
  - 選擇等級後，側邊欄自動移到上方變成橫條拉桿
  - 可以左右滑動選擇課程，體驗統一
  - 解決 12 吋平板功能不一致的問題

- ✅ **修復側邊欄收合問題**：
  - 修復左側側邊欄收合時主內容被隱藏的問題
  - 參考右側筆記欄的實現方式，使用 `display: none` 隱藏側邊欄和拉條
  - 修改 grid 布局，移除側邊欄列，讓主內容區自動擴展
  - 現在收合側邊欄時，主內容區正常顯示，與筆記欄收合行為一致

### 📁 修改文件

| 文件 | 修改内容 |
|------|---------|
| `styles/templates/lesson-b.css` | 在 1200px 斷點中添加橫條拉桿樣式，修復側邊欄收合時的 grid 布局問題，使用 display: none 隱藏側邊欄 |

## [3.7.0] - 2026-01-22

### 🎨 響應式設計優化：筆記欄全裝置可見 + 側邊欄拉條功能

- ✅ **筆記欄響應式優化**：
  - 將斷點從 1400px 調整為 1200px，確保 12 吋平板橫向（≈1366px）顯示桌面版
  - 移除筆記欄隱藏規則，所有裝置都能看到「Elisa's Classroom Notes」
  - 平板/手機模式（≤ 1200px）下，筆記欄移到主內容下方完整顯示
  - 添加視覺分隔：上方邊框、間距，與主內容區明顯區分
  - 筆記欄寬度在平板/手機版自動調整為 100%

- ✅ **側邊欄拉條功能**：
  - 將左側課程選擇欄固定寬度 260px 改為可調整的 CSS 變數 `--sidebar-width`
  - 添加側邊欄拉條（`sidebar-resizer`），樣式與筆記欄拉條一致
  - 實現拖動調整寬度功能（200px ~ 600px），寬度保存在 localStorage
  - 保留收合功能，兩個功能完美協同工作
  - 收合按鈕位置根據側邊欄寬度動態計算
  - 在平板/手機模式下自動隱藏拉條

- ✅ **文案優化**：
  - 將 Grammar 空狀態提示改為更友善的英文版本
  - 使用 Elisa 第一人稱視角，讓學生感覺像在看老師的筆記本

### 📁 修改文件

| 文件 | 修改内容 |
|------|---------|
| `styles/templates/lesson-b.css` | 調整響應式斷點為 1200px，移除筆記欄隱藏規則，添加平板/手機版筆記欄下方顯示樣式，添加側邊欄拉條樣式，更新所有 grid 布局以支持可調整寬度 |
| `lesson-template-b.html` | 添加側邊欄拉條元素，實現側邊欄拉條拖動功能 JavaScript，更新收合按鈕位置計算邏輯 |
| `assets/js/loader.js` | 優化 Grammar 空狀態提示文案，改為更友善的英文版本 |

## [3.6.0] - 2026-01-22

### 🎨 Studio Tab 功能增強：類型選擇器 + 批量發布功能

- ✅ **類型選擇器**：
  - 在 Studio tab 的預覽面板 header 中添加類型選擇器
  - 可選擇「部件」或「目標字」兩種類型
  - 根據選擇的類型載入對應的 Firestore 集合（`components` 或 `target-characters`）
  - 類型切換時自動重新載入數據
  - 與 `studio.html` 的實現保持一致

- ✅ **批量發布功能**：
  - 添加「整課全部發布」按鈕（綠色）
  - 添加「整課全部取消發布」按鈕（灰色）
  - 批量操作當前顯示的所有項目（根據選擇的等級和類型）
  - 使用 Firestore batch 操作提高效率
  - 同時更新 `is_published` 和 `published` 字段
  - 發布時自動設置 `published_at` 時間戳
  - 操作前顯示確認對話框（包含項目數量）
  - 操作完成後顯示成功提示並自動重新渲染列表

- ✅ **表單欄位完善**：
  - 在 Studio tab 的表單中添加 `meaning`（意思）欄位
  - 更新發布狀態檢查邏輯，同時檢查 `is_published` 和 `published` 字段
  - 發布狀態變更時同時更新兩個字段，保持數據一致性

- ✅ **數據載入優化**：
  - 根據類型選擇正確的 Firestore 集合路徑
  - 對於目標字使用無排序查詢（與 `studio.js` 保持一致）
  - 對於部件嘗試使用 `orderBy` 排序，失敗時回退到無排序查詢
  - 添加類型匹配驗證，防止載入錯誤類型的數據

### 📁 修改文件

| 文件 | 修改内容 |
|------|---------|
| `timeline-admin.html` | 在 Studio tab 預覽面板 header 中添加類型選擇器，在預覽內容區域添加批量發布按鈕 |
| `assets/js/timeline-admin.js` | 添加類型選擇器事件監聽、實現 `loadStudioComponents()` 支持類型參數、實現 `batchPublishStudioComponents()` 批量發布功能、更新 `updateStudioField()`、`addStudioComponent()`、`deleteStudioComponent()` 支持類型選擇、在 `createStudioFormItem()` 中添加 `meaning` 欄位並更新發布狀態邏輯 |

## [3.5.0] - 2026-01-22

### 🎯 BCT Review 系統重大更新：By Difficulty 功能 + UI 優化

- ✅ **新增 By Difficulty 複習模式**：
  - 添加 Review Method Tab System（Smart Review / By Difficulty）
  - 實作四個 Mastery Boxes（Forgotten / Hard / Good / Easy）
  - 點擊任一難度 Box 可直接開始該難度的複習（不考慮到期日）
  - 統計數字與 Smart Review 同步更新
  - 樣式與 Smart Review Section 對齊，簡潔統一

- ✅ **步驟指示器（Step Indicator）**：
  - 添加 4 步驟視覺指示器（Level → Type → Lessons → Start）
  - 圓形數字 + 連接線設計，清楚顯示當前進度
  - 動態更新：當前步驟 active（橘色），已完成步驟 completed（綠色）
  - 響應式設計，手機版自動縮小

- ✅ **開始按鈕優化**：
  - 手機版 sticky 固定在底部，始終可見
  - 添加脈衝動畫（pulse animation）吸引注意
  - 按鈕內部分為圖示、文字、提示三部分
  - 提示文字："👆 Click here to begin!"
  - 按鈕顏色改為主站品牌色（橘色漸變）

- ✅ **課程選擇視覺改進**：
  - 鎖定課程（L3-L20）使用灰色背景、降低透明度、grayscale 濾鏡
  - 可用課程（L1, L2）正常顯示，hover 效果明顯
  - 視覺區分明確，學生不會誤點鎖定課程

- ✅ **各步驟說明文字**：
  - Step 2 Hint：說明 Type Tab 對應關係（Components / 汉字 / Vocabulary）
  - Step 3 Hint：說明如何選擇課程，鎖定課程的提示
  - Step 4 Hint：說明如何開始複習
  - 統一樣式：淺橘色背景 + 左側邊框，簡潔清晰

- ✅ **手機按鈕並列**：
  - Select All / Clear All 在手機版也並列顯示
  - 使用 `flex: 1` 讓兩個按鈕等寬，節省空間

- ✅ **Type Tab 標籤對應**：
  - Components → "Components"（與 lesson page 一致）
  - Characters → "汉字"（與 lesson page 一致，學生看不懂是正常的，這就是練習認字的地方）
  - Vocab → "Vocabulary"（對應 lesson page 的 "Vocabulary" + "Vocab A" tabs）

- ✅ **Smart Review Section 重新設計**：
  - 移除漸變背景和背景圖案，改為簡潔的白色背景
  - 移除標題，簡化結構
  - 將四個大框改為一行文字顯示：`📊 Breakdown: 3 Forgot | 1 Hard | 1 Good | 0 Easy`
  - 按鈕移到最上方，資訊作為小提示
  - 與 By Difficulty Section 樣式對齊，視覺統一

### 📁 修改文件

| 文件 | 修改内容 |
|------|---------|
| `bct-review.html` | 添加步驟指示器、Review Method Tabs、By Difficulty Section、各步驟說明文字、更新 Type Tab 標籤、重新組織 Smart Review Section 結構 |
| `assets/js/bct-review.js` | 添加 `startBoxReview()` 方法、Tab 切換邏輯、`updateStepIndicator()` 方法、更新 `updateStats()` 同時更新兩個地方的統計、添加防護措施和調試信息 |
| `assets/css/review.css` | 添加步驟指示器樣式、By Difficulty Section 樣式、Step Hints 樣式、按鈕 pulse 動畫、手機版 sticky 按鈕、改進鎖定課程視覺、手機按鈕並列、Smart Review Section 簡潔風格 |

## [3.4.0] - 2026-01-21

### 📚 Grammar 和 Practice Tab 功能增強：摺疊/展開、智能文件檢測、簡體中文

- ✅ **摺疊/展開功能**：
  - 在 `lesson-template-b.html` 的 Grammar 和 Practice Tab 中為多筆 Markdown 內容添加摺疊/展開功能
  - 每筆內容獨立控制，可同時展開多筆內容
  - 預設全部摺疊，點擊標題行可展開/摺疊
  - 標題行右側顯示展開/摺疊圖示（▶/▼），整個標題行可點擊
  - 使用 CSS transition 實現平滑動畫效果（300ms）
  - 標題行 hover 效果：背景色從 #f8f9fa 變為 #e9ecef

- ✅ **智能文件檢測（方案 A）**：
  - 使用 `fetch` HEAD 請求檢查獨立 HTML 文件是否存在
  - 只為實際存在的文件創建按鈕，避免 404 錯誤
  - 顯示載入狀態提示「⏳ 正在检查可用文件...」
  - 如果沒有文件存在，顯示「目前没有可用的独立文件」提示
  - 並發檢查最多 5 個文件，優化載入性能

- ✅ **顯示順序調整**：
  - 獨立 HTML 文件按鈕移到最上方
  - Firestore 的 Markdown 內容移到下方，使用分隔線區分
  - 改善用戶體驗，讓學生優先看到可點擊的資源按鈕

- ✅ **空狀態提示優化**：
  - 當查詢不到數據時，顯示更明確的提示訊息
  - 包含當前查詢的等級和課次資訊
  - 顯示完整的 Firestore 路徑，方便調試
  - 提供操作指引，提示如何在 timeline-admin.html 新增內容

- ✅ **簡體中文支援**：
  - 將所有此次新增的 Grammar/Practice 相關繁體中文改為簡體中文
  - 確保學生端看到的中文資訊都是簡體中文
  - 修改範圍包括：標題、空狀態提示、按鈕文字、載入提示等
  - 舊內容保持不變，僅修改此次新增的功能

### 📁 修改文件

| 文件 | 修改内容 |
|------|---------|
| `timeline-admin.html` | 添加 Grammar 管理和 Practice 管理 Tab，提供教師編輯 Grammar/Practice Markdown 內容的介面，包含等級/課次選擇器、實時預覽、自動保存等功能 |
| `assets/js/timeline-admin.js` | 實現 Grammar 和 Practice 管理系統，包含載入、保存、刪除、實時預覽等功能，數據儲存在 `courses/{level}/lessons/{lessonId}/grammar/` 和 `practice/` 路徑 |
| `assets/js/loader.js` | 添加 Grammar/Practice 摺疊/展開功能，實現智能文件檢測（fetch HEAD 請求），調整顯示順序，優化空狀態提示，將繁體中文改為簡體中文 |

## [3.3.2] - 2026-01-21

### 🎨 Studio 功能增強：折疊/展開、Cloudinary 上傳、雙擊跳轉

- ✅ **折疊/展開功能**：
  - 在 `studio.html` 和 `timeline-admin.html` 的 Studio 區塊中添加項目折疊/展開功能
  - 每個表單項目可單獨折疊，折疊時只顯示「字」欄位，方便上課時拖曳排序
  - 編輯表單標題列添加「全部折疊」和「全部展開」按鈕，可批量控制所有項目
  - 刪除按鈕移到 Published checkbox 旁邊，表單標題更簡潔

- ✅ **移除編輯區課次選擇器**：
  - `studio.html` 編輯區移除「Lesson (課次)」選擇器（右上角已有課次選擇器）
  - 新增項目時自動使用右上角選擇的課次，簡化操作流程

- ✅ **Cloudinary 圖片上傳功能**：
  - 在兩個 Studio 中添加「🖼️ 上傳字形補丁圖片到 Cloudinary」按鈕（`display_image` 欄位）
  - 在兩個 Studio 中添加「🖼️ 上傳輔助插圖到 Cloudinary」按鈕（`image` 欄位）
  - 上傳完成後自動填入對應輸入框並更新 Firestore
  - 顯示上傳進度條（0%-100%），每個表單項目都有獨立的按鈕

- ✅ **雙擊預覽卡片跳轉功能**：
  - 單擊預覽卡片：打開教學模態框（原有功能保留）
  - 雙擊預覽卡片：跳轉到對應的編輯表單項目
  - 自動展開編輯面板（如果被最小化）
  - 平滑滾動到對應項目並居中顯示

### 📁 修改文件

| 文件 | 修改内容 |
|------|---------|
| `studio.html` | 添加 Cloudinary script，編輯表單標題列添加全部折疊/展開按鈕 |
| `studio.js` | 添加折疊/展開功能，移除編輯區課次選擇器，添加 Cloudinary 上傳功能，添加雙擊跳轉功能 |
| `timeline-admin.html` | Studio 區塊編輯表單標題列添加全部折疊/展開按鈕 |
| `assets/js/timeline-admin.js` | Studio 區塊添加折疊/展開功能，添加 `display_image` 欄位，添加 Cloudinary 上傳功能，添加雙擊跳轉功能 |
| `assets/css/timeline-admin.css` | 添加折疊/展開相關 CSS 樣式 |

## [3.3.1] - 2026-01-21

### 🎨 複習卡片優化：尺寸調整、內容順序統一、語音按鈕樣式統一

- ✅ **複習卡片尺寸優化**：
  - 桌面版：卡片寬度從 400px 增加到 600px，高度從 380px 增加到 700px，更適合寬螢幕顯示
  - 手機版：卡片高度調整為 70vh，確保在手機端占據畫面 70% 的空間
  - 卡片背面佈局改為 `flex-start`，內容從上方開始排列，充分利用垂直空間

- ✅ **補充說明區域高度增加**：
  - 桌面版：`.back-notes` 最大高度從 80px 增加到 600px，可完整顯示 25-35 行內容
  - 手機版：`.back-notes` 最小高度設置為 250px，確保有足夠空間顯示圖片和詳細內容
  - 添加 `flex-grow: 1` 屬性，讓補充說明區域能夠自動擴展使用可用空間

- ✅ **卡片背面內容順序統一**：
  - 調整內容顯示順序為：形（字）→ 音（拼音）→ 义（意思）→ 圖片 → 補充解釋
  - 與 `lesson-template-b.html` 的【部件】和【汉字】tabs 保持一致
  - 新增 `.back-image` 容器，將輔助插圖從補充說明中分離出來，放在正確位置

- ✅ **語音按鈕樣式和位置統一**：
  - 語音按鈕改為與 `lesson-template-b.html` 相同的圓形按鈕樣式（40x40px）
  - 使用 primary 顏色漸變背景，保持設計一致性
  - 按鈕位置從卡片底部移到字旁邊，使用 `.back-character-wrapper` 實現並排顯示
  - 按鈕文字改為只有 🔊 圖標，移除 "Speak" 文字，更簡潔緊湊
  - 手機版按鈕尺寸調整為 36x36px，確保觸控友好

- ✅ **響應式佈局優化**：
  - 桌面版：`.review-area` 保持原有佈局
  - 手機版：`.review-area` 使用 flex 佈局，讓按鈕貼近畫面下方
  - 確保桌面版和手機版都有足夠的空間顯示完整內容

### 📁 修改文件

| 文件 | 修改内容 |
|------|---------|
| `bct-review.html` | 調整卡片背面 HTML 結構，添加 `.back-character-wrapper` 和 `.back-image` 容器，語音按鈕移到字旁邊 |
| `assets/css/review.css` | 調整卡片尺寸、補充說明區域高度、卡片背面佈局、語音按鈕樣式，添加響應式樣式 |
| `assets/js/bct-review.js` | 調整 `renderCardBack` 函數，將圖片渲染到新容器，確保內容順序正確 |

## [3.3.0] - 2026-01-21

### 🎨 Studio 2.0：部件與目標字管理 + 實時預覽

- ✅ **Studio 功能擴展**：`studio.html` 升級為「部件與目標字管理 2.0」，支持管理部件（components）和目標字（target-characters）兩種類型。
- ✅ **類型與課次選擇**：新增類型選擇器（部件/目標字）和課次選擇器（可選擇特定課次或全部），支持按課次過濾顯示。
- ✅ **實時預覽功能**：右側預覽面板實時顯示編輯結果，讓學生可以即時看到編輯效果。
- ✅ **拖拽調整側邊欄寬度**：新增可拖拽的分隔線，允許用戶自由調整編輯面板和預覽面板的寬度（5%-60%），當寬度小於 10% 時自動切換到最小化模式（60px）。
- ✅ **編輯面板最小化**：點擊切換按鈕時，編輯面板縮小為 60px（顯示標題）而非完全隱藏，確保預覽面板和切換按鈕始終可見。
- ✅ **修復目標字載入問題**：目標字查詢改為不使用 `orderBy`，直接使用 `.get()` 載入所有數據（與 `timeline-admin.js` 保持一致），確保所有目標字項目都能正確載入。
- ✅ **移除 Markdown 多餘色彩配置**：在 `studio.html` 和 `lesson-b.css` 中移除 Markdown 標題和粗體文字的多餘顏色配置，改為繼承父元素顏色，保持樣式簡潔一致。
- ✅ **完整的表單字段**：支持編輯 Character、Display Image、Pinyin、Meaning、Lesson、Notes、Image URL、Published 等所有字段。
- ✅ **自動保存與拖拽排序**：保留 1000ms 防抖自動保存和 SortableJS 拖拽排序功能，所有編輯功能在兩種模式下都正常工作。

### 📁 修改文件

| 文件 | 修改内容 |
|------|---------|
| `studio.html` | 添加類型選擇、課次選擇、拖拽調整寬度功能，移除 Markdown 多餘色彩配置 |
| `studio.js` | 擴展支持兩種 collection（components 和 target-characters），修復目標字載入邏輯，添加詳細日誌 |
| `styles/templates/lesson-b.css` | 移除 Markdown 標題和粗體文字的多餘顏色配置 |

## [3.2.0] - 2026-01-20

### 🧊 Cohort freeze guard + 简化导航（移除 Group UI）

- ✅ **新增 cohort 凍結机制（active / frozen）**：前台初始化时读取 Firestore `cohorts`，若 URL / localStorage 的 cohort 非 `active`，自动 fallback 到 `taigen-a`，并同步修正 URL（`replaceState`）与 `localStorage['bct-cohort']`。
- ✅ **新增开关式隐藏 Group UI**：加入 `assets/js/app-flags.js`（`window.BCT_ENABLE_GROUP_UI = false`），让 desktop + mobile 导航完全移除 Group（cohort）相关 UI，但保留未来可一键开启的能力。
- ✅ **所有关键入口改用 enforced cohort**：`assets/js/loader.js`、`assets/js/bct-review.js` 优先读取 `window.BCT_ACTIVE_COHORT`，避免用户手动改 URL 访问 frozen cohort 的资料。
- ✅ **避免 Firebase 重复初始化**：在 `assets/js/firestore.js`、`assets/js/bct-review.js`、`assets/js/cohort-guard.js` 加入 `firebase.apps.length` 防重入。
- ✅ **首页补齐 Firebase SDK**：`index.html` 新增 Firebase app/firestore SDK，供 `cohort-guard` 在首页也能执行拦截与校正。
- 📝 **文档更新**：`docs/USER_FLOW_GUIDE.md` 追加「日后新增班级」与「凍結机制」操作说明。

## [3.1.0] - 2026-01-19

### 📱 Mobile navigation polish

- ✅ 全站 `index.html`、`lesson-template-b.html`、`bct-review.html` 共用 `mobile-nav` 與新增的 `assets/js/mobile-nav.js`，保持 Courses/Review/Group dropdown 與 `back-to-top` 行為一致。
- ✅ Home 只顯示 icon，其他三個按鈕繼續顯示 icon+文字 pill style，desktop 端既有 `.unified-nav` 完整保留。
- ✅ 重構行動樣式：`styles/templates/lesson-b.css` 拆除冗餘 nav，所有手機樣式移至 `assets/css/style.css`，並以 `@media (max-width:1024px)` 顯示，`nav-global.css` 在手機隱藏桌機 nav。
- ✅ 手機 nav 改為相對定位並加上統一 padding/gap，新增 `back-to-top` 按鈕與 icon-only Home hit area，保持頁面內容可捲動。
- ✅ `templates/lesson.template.html` 移到 `standalone(archive)` 並更新 `README.md`，確保舊版本被封存但不影響現有流程。

## [3.0.0] - 2026-01-18

✅ Unified navigation across all 3 pages
✅ Issue 1-2 solved (class switching without returning to homepage)
✅ Hero section redesigned with light gray background
✅ BCT tab behavior unified (all jump to lesson page)
✅ Language toggle moved below title with colored buttons (Pinyin=green, English=teal, Spanish=purple)
✅ 3-column layout optimized for 65" TV (260px | 1fr | 350px)
✅ Grammar tab added
✅ Collapsible sidebar with localStorage persistence




## [2.1.0] - 2026-01-17

### 🎯 阶段 5 完成：系统整合与 URL 参数统一

本次更新修复了整个系统的 URL 参数传递逻辑，确保 `level` 和 `cohort` 参数在所有页面间正确传递。

---

### ✅ 核心修复

#### 1. URL 参数统一（阶段 5.1）
- **index.html**：BCT 按钮动态读取 cohort 参数
- **nav.js**：所有 Review 链接统一参数（`class` → `level`，添加 `cohort`）
- **loader.js**：课程页复习链接包含完整 `level` + `cohort`
- **bct-review.js**：初始化时从 URL 读取 `level` 和 `cohort`

#### 2. 班级切换实时更新（阶段 5.2）
- **cohort-selector.js**：修复 `updateLessonLinks()` 方法
  - 同时更新 `.lesson-link` 和 `.course-entry-btn` 类
  - 学生切换班级后，首页按钮立即更新，无需刷新
- **bct-review.js**：切换 BCT 等级时使用 `pushState` 更新 URL

---

### 📊 数据流现状

#### ✅ 已完成
```
index.html → 选班级（Taigen A）
  ↓
点击 BCT 1 → ?level=btc1&lesson=L1&cohort=taigen-a
  ↓
课程页 → 点击"复习" → ?level=btc1&cohort=taigen-a
  ↓
复习页 → 加载对应等级和班级的数据 ✅
  ↓
切换班级 → 所有链接实时更新 ✅
```

#### ⚠️ 已知问题（待优化）
- **复习页刷新后跳回 BCT 1**
  - 切换到 BCT 2 → URL 已更新 → 但刷新后回到 BCT 1
  - 已记录到性能优化清单

---

### 📁 修改文件

| 文件 | 修改内容 |
|------|---------|
| `index.html` | 添加动态更新 BCT 按钮的脚本 |
| `assets/js/nav.js` | 修复 3 处 Review 链接参数 |
| `assets/js/loader.js` | updateReviewLink 添加 level 参数 |
| `assets/js/bct-review.js` | init() 添加 URL 参数读取，switchLevel() 更新 URL |
| `assets/js/cohort-selector.js` | updateLessonLinks() 支持 .course-entry-btn |

---

### 🧪 测试结果

| 测试项 | 状态 |
|--------|------|
| ✅ 首页 → 课程页参数传递 | 通过 |
| ✅ 课程页 → 复习页参数传递 | 通过 |
| ✅ 导航栏 Review 链接 | 通过 |
| ✅ 班级切换后链接实时更新 | 通过 |
| ✅ 复习页切换 BCT 等级 | 通过 |
| ⚠️ 复习页刷新保持等级 | 待优化 |

---

## [2.0.1] - 2026-01-17

### 🔧 优化更新：班级切换流程改进

#### 修改内容
- **课程页面班级标签改为返回首页链接**
  - 移除课程页面的班级切换弹窗
  - 点击「👤 Taigen A」直接返回首页
  - 避免学生在课程中误操作更换班级

#### 修改文件
- `lesson-template-b.html` - 班级标签改为 `<a>` 链接
- `assets/js/cohort-selector.js` - 课程页面不显示切换功能
- `styles/templates/lesson-b.css` - 添加链接样式
- `docs/USER_FLOW_GUIDE.md` - 更新更换班级流程说明

#### 用户体验改进
- ✅ 更清晰的班级切换流程
- ✅ 防止误操作
- ✅ 保持首页的完整功能

---

## [2.0.0] - 2026-01-17

### 🎉 重大更新：班级分流系统

本次更新实现了班级分流功能，允许不同班级的学生看到各自班级的补充内容。

---

### ✨ 新增功能

#### 学生端（lesson-template-b.html）
- ✅ 首页班级选择器（Taigen A / Taigen B）
- ✅ 右上角班级标签显示
- ✅ Vocab tab 动态显示班级代号（Vocab A / Vocab B）
- ✅ 分班独立的生词补充内容
- ✅ 分班独立的课堂笔记
- ✅ 所有班共用的部件补充

#### 教师端（timeline-admin.html）
- ✅ BCT 等级选择器（BCT 1 / 2 / 3）
- ✅ 班级选择器（Taigen A / Taigen B）
- ✅ 根据内容类型自动显示/隐藏班级选择器
  - 部件：不需要选班级（自动共用）
  - 生词/笔记：必须选班级
- ✅ 列表显示等级和班级信息
- ✅ 按等级、班级筛选功能

#### 复习系统（bct-review.html）
- ✅ 自动读取学生班级
- ✅ Components 模式包含所有班共用的部件
- ✅ Vocab 模式只包含该班的生词补充
- ✅ 多等级支持（BCT 1/2/3）

---

### 🔧 修改内容

#### 数据结构调整
```
旧结构：
timeline/
  └── {date}/
      ├── components/
      ├── vocabulary/
      └── notes/

新结构：
timeline/
  └── {level}/              # 新增：等级分层
      ├── components/       # 保持：所有班共用
      │   └── {date}/
      ├── vocab/            # 新增：分班目录
      │   ├── taigen-a/
      │   │   └── {date}/
      │   └── taigen-b/
      │       └── {date}/
      └── notes/            # 新增：分班目录
          ├── taigen-a/
          │   └── {date}/
          └── taigen-b/
              └── {date}/
```

#### 界面文字统一
- ✅ 所有提示文字改为简体中文
- ✅ 占位符统一格式：`暂无内容 Nothing here yet.`
- ✅ 按钮文字：`确认`、`删除`、`查询`、`储存`

---

### 📝 文档更新

- ✅ 新增 `docs/USER_FLOW_GUIDE.md`：完整的使用流程文档
- ✅ 新增 `CHANGELOG.md`：本文档

---

### 🎯 核心设计原则

1. **数据隔离清晰**
   - 官方课本：所有班共用
   - 部件补充：所有班共用（知识通用）
   - 生词补充：分班独立（讨论不同）
   - 课堂笔记：分班独立（重点不同）

2. **用户体验流畅**
   - 学生首次选择班级后自动记住
   - URL 自动带班级参数
   - 教师新增内容时自动判断是否需要选班级

3. **扩展性强**
   - 新增班级：只需添加按钮和代号
   - 新增等级：只需添加 Firestore 路径

---

### 🐛 已知问题

- 暂无

---

### 🔮 未来计划

#### v2.1（短期）
- [ ] 学生登录系统（Firebase Auth）
- [ ] 学生个人复习进度记录
- [ ] 教师操作日志

#### v2.2（中期）
- [ ] 批量复制补充内容到其他班级
- [ ] 软删除功能（回收站）
- [ ] 导出/导入功能（Excel）

#### v3.0（长期）
- [ ] 艾宾浩斯遗忘曲线智能复习推荐
- [ ] 学生掌握度统计分析
- [ ] 多语言界面支持

---

### 📊 统计数据

- 修改文件：7 个
- 新增文件：2 个
- 新增代码行数：约 800 行
- 新增功能点：15 个
- 文档页数：本指南约 50 页

---

## [1.0.0] - 2026-01-15

### 初始版本

- ✅ 基础课程系统
- ✅ Timeline 补充功能
- ✅ 复习系统
- ✅ 教师管理后台

---

**完整使用流程请参考：** [docs/USER_FLOW_GUIDE.md](docs/USER_FLOW_GUIDE.md)



