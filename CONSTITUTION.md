# 專案大憲法｜不可隨意更動

---

## 一、核心開發哲學（The Lego Method）

### 內容與結構分離
HTML 僅作為外殼樣板（Template），嚴禁將任何教學內容直接寫入 HTML 標籤內。

### 禁止死代碼
所有教學內容必須透過 JavaScript 從 Markdown 或 Firestore 動態加載。

### 特定班級導向（當前聚焦，保留擴充）
本專案目前聚焦單一班級/學生的高互動與即時性體驗，確保教學內容、Timeline 與 Review 的反饋能即刻回應學習狀態。同時，基礎架構必須保持多班級/多 cohort 擴充能力——包含資料驅動的課程導航、班級切換，以及課程條/時間軸的動態生成，避免因 UI/資料耦合而阻礙未來擴展。所有教學內容仍以外部資料源（Markdown/Firestore 等）注入，HTML 只作為模板容器，符合內容與結構分離原則

### 三大邏輯範疇（Scopes）

**Lesson（課本）**
穩定、官方的教學大綱與課程內容。

**Timeline（黑板）**
課堂即時補充內容，具備明確時間屬性，反映真實上課過程。

**Review（記憶系統）**
不產生內容，僅從 Lesson 與 Timeline 中提取資料，進行 SRS 複習。

---

## 二、四行文本與視覺標準（Visual Standards）

### 每一句教學文本遵循以下「四行結構」：

**Pinyin（拼音）**
顏色：`#28A745`，字體較小，位於最上方。

**Character（漢字）**
顏色：`#212529`，視覺核心，字體最大（2.2rem）且加粗。

**English（英文）**
顏色：`#20C997`。

**Spanish（西文）**
顏色：`#6F42C1`，斜體顯示。

### 背景設計原則：

- 使用 CSS linear-gradient 渲染約 30px 的網格紋理
- 營造工程圖紙感
- 禁止使用大面積圖片作為背景

---

## 三、交互邏輯（Interaction Logic）

### 雙重翻譯切換（Dual-Toggle System）

**全局切換：** 控制全站翻譯顯示

**單句切換：** 點擊 `.sentence-card` 可獨立展開該句翻譯
→ 預設隱藏翻譯，降低認知負荷

### 積木感交互

卡片具備 hover 浮起陰影與邊框變化

### 輔助功能（非核心）

- 點擊漢字觸發 TTS
- 單字 hover 顯示補充資訊（如等級、提示）

> 📌 本章屬於 UI/UX 原則，不影響資料結構是否成立。

---

## 四、數據標籤規範（Metadata Convention）

### 所有可被系統識別的內容必須包含 Frontmatter：

```yaml
---
id: unique_id
scope: lesson | timeline
type: vocab | sentence | note
review: true | false
date: YYYY-MM-DD
---
```

### 用途說明：

- **scope：** 決定內容所屬邏輯層
- **type：** 決定分類與使用方式
- **review：** 是否可被 SRS 系統抓取
- **date：** 排序與時間軸依據

> 📌 數據是強制性的，渲染是條件性的

---

## 五、開發禁令（Strict Protocols）

### CSS 強制命名

- `.line-pinyin`
- `.line-character`
- `.line-en`
- `.line-es`

### 嚴禁內聯樣式

- 禁止使用 `style=""`
- 必須統一透過 CSS class 控制

### HTML 定位

- HTML 不得承載任何教學內容
- 僅作為資料注入的容器

---
## Firebase Configuration
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

> 📌 **此文件為專案世界觀與不可動搖原則，不討論實作細節。**
