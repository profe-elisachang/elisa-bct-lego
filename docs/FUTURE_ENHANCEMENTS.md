# 🗺️ 功能路線圖與未來優化方案

## 📝 說明
本文檔記錄功能設計靈感、未來優化方案和改進構想，供日後開發參考。

---

## 🎯 獨立 HTML 文件管理優化方案

### 問題背景
**日期：** 2026-01-21  
**相關功能：** Grammar/Practice Tab 的獨立 HTML 文件按鈕顯示

**現況：**
- `lesson-template-b.html` 的 Grammar 和 Practice Tab 會顯示獨立 HTML 文件的按鈕
- 目前固定顯示 5 個按鈕（grammar-1.html 到 grammar-5.html）
- 即使文件不存在也會顯示按鈕，點擊會導致 404 錯誤

**用戶需求：**
- 只顯示實際存在的文件按鈕
- 例如：只有 `grammar-1.html` 存在時，只顯示一個按鈕

---

### 方案 A：使用 fetch 檢查文件是否存在（✅ 已採用）

**實作方式：**
- 對每個可能的文件（1-5）發送 HEAD 請求檢查是否存在
- 只為存在的文件創建按鈕
- 顯示載入狀態，避免用戶困惑

**優點：**
- ✅ 自動化，無需手動維護
- ✅ 實現簡單，符合現有架構
- ✅ 即時反映文件狀態

**缺點：**
- ⚠️ 需要多個 HTTP 請求（最多 5 個）
- ⚠️ 可能有輕微延遲（約 1 秒，可接受）

**狀態：** ✅ 已實作

---

### 方案 C：在 timeline-admin.html 中管理文件列表（📋 未來優化）

**整體概念：**
在 Grammar/Practice 管理 Tab 中新增「獨立 HTML 文件管理」功能，讓教師為每個課程維護可用的獨立 HTML 文件列表。此列表儲存在 Firestore，學生端只顯示列表中的文件按鈕。

**操作流程：**

#### 第一階段：教師在 timeline-admin.html 管理文件列表

1. **進入 Grammar 管理 Tab**
   - 打開 `timeline-admin.html`
   - 點擊「📚 Grammar 管理」Tab

2. **選擇課程**
   - 在「等級」下拉選單選擇等級（BCT 1/2/3）
   - 在「課次」下拉選單選擇課次（Lesson 1/2/3...）

3. **進入「獨立 HTML 文件管理」區塊**
   - 在編輯面板下方或右側預覽區新增一個區塊
   - 標題：「📄 獨立 HTML 文件管理」

4. **新增文件記錄**
   - 點擊「+ 新增文件」按鈕
   - 填寫：
     - **文件名稱**：例如「文法 1」或「進階練習」
     - **文件路徑**：例如 `BCT1/L1/grammar-1.html`
     - **顯示順序**：數字（決定按鈕順序）
   - 點擊「保存」

5. **編輯/刪除文件記錄**
   - 在文件列表中點擊「編輯」修改名稱或順序
   - 點擊「刪除」移除記錄（不刪除實際文件）

6. **查看文件列表**
   - 列表顯示該課程的所有已註冊文件
   - 顯示文件名稱、路徑、順序

7. **Practice 管理 Tab 同樣操作**
   - 在「✏️ Practice 管理」Tab 中重複上述步驟

---

#### 第二階段：數據儲存

**儲存位置：** Firestore

**路徑結構：**
- Grammar：`courses/{level}/lessons/{lessonId}/grammar-files/{fileId}`
- Practice：`courses/{level}/lessons/{lessonId}/practice-files/{fileId}`

**數據格式：**
{
  fileName: "文法 1",           // 顯示名稱
  filePath: "BCT1/L1/grammar-1.html",  // 相對路徑
  order: 1,                    // 顯示順序
  createdAt: timestamp,
  updatedAt: timestamp
}---

#### 第三階段：學生端顯示（lesson-template-b.html）

1. **載入文件列表**
   - 從 Firestore 讀取該課程的文件列表
   - 例如：`courses/btc1/lessons/lesson1/grammar-files/`

2. **生成按鈕**
   - 根據列表中的記錄生成按鈕
   - 按照 `order` 排序
   - 按鈕文字使用 `fileName`
   - 點擊開啟 `filePath` 對應的文件

3. **顯示結果**
   - 只顯示已註冊的文件按鈕
   - 如果列表為空，不顯示按鈕區塊

---

**優點：**
- ✅ 教師可以完全控制顯示內容
- ✅ 可以自訂按鈕名稱（不依賴文件名）
- ✅ 可以調整顯示順序
- ✅ 集中管理，與 Grammar/Practice 內容管理在同一頁面

**缺點：**
- ⚠️ 需要手動維護文件列表
- ⚠️ 新增文件時需要手動註冊

**使用場景範例：**

情境：教師為 BCT 1 Lesson 1 準備了 3 個獨立文法文件

1. **實際文件：**
   - `BCT1/L1/grammar-1.html`（基礎文法）
   - `BCT1/L1/grammar-2.html`（進階文法）
   - `BCT1/L1/grammar-3.html`（補充練習）

2. **在管理介面註冊：**
   - 進入 Grammar 管理 Tab
   - 選擇 BCT 1 → Lesson 1
   - 在「獨立 HTML 文件管理」區塊新增 3 筆記錄：
     - 「基礎文法」→ `BCT1/L1/grammar-1.html` → 順序 1
     - 「進階文法」→ `BCT1/L1/grammar-2.html` → 順序 2
     - 「補充練習」→ `BCT1/L1/grammar-3.html` → 順序 3

3. **學生端顯示：**
   - 在 Grammar Tab 的「額外資源」區塊顯示 3 個按鈕
   - 按鈕文字：「基礎文法」「進階文法」「補充練習」
   - 點擊後開啟對應的 HTML 文件

**狀態：** 📋 未來優化方案

**優先級：** 中（功能增強，不影響現有功能）

**預計實作時間：** 2-3 小時

**相關文件：**
- `timeline-admin.html` - 需要新增文件管理 UI
- `assets/js/timeline-admin.js` - 需要新增文件列表管理邏輯
- `assets/js/loader.js` - 需要修改 `renderStandaloneButtons` 函數
- Firestore 數據結構設計

---

## 📝 其他功能靈感

（未來可以在此處添加其他功能設計靈感）

---

**最後更新：** 2026-01-21