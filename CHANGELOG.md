# 更新日志

## 版本号规则（SemVer：MAJOR.MINOR.PATCH）

- **MAJOR（X.0.0）**：有破坏性变更（旧链接/旧流程/旧数据读取可能失效）。
- **MINOR（x.Y.0）**：新增功能或明显改版，但保持向后兼容（旧用法仍可用）。
- **PATCH（x.y.Z）**：修 bug / 文案 / 样式 / 小优化，不改变对外行为契约。

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



