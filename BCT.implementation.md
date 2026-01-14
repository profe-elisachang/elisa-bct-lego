實作地圖｜可調整、可演進

一、專案目錄結構（Current Working Map）
/00_BCT_Project
 ├── /data
 │    ├── /lessons        # 官方課程 Markdown
 │    └── /timeline       # 課堂即時補充（Firestore 或 JSON/MD）
 ├── /templates
 │    └── lesson.template.html
 ├── /css
 │    └── style.css
 ├── /js
 │    ├── loader.js       # 核心：載入資料並渲染
 │    ├── toggle.js       # EN / ES 顯示邏輯
 │    └── firestore.js    #（未來）即時同步
 └── index.html

二、Template 與資料流邏輯

lesson.template.html

僅包含結構與 slot

不包含任何課文內容

loader.js

根據路由 / 課次

載入對應 Lesson Markdown

載入對應 Timeline 資料

根據 metadata 決定是否進入 Review

三、Timeline 實作策略

錄入方式

設計「老師用錄入介面」

上課時即時新增補充內容

儲存

Firestore 為主

保留 JSON / MD fallback

呈現（雙重渲染）

出現在該 Lesson 頁面下方

同時出現在 Timeline Tab

四、Review / SRS 抓取邏輯（初版）

Review 系統抓取來源：

Lesson 中標記為 review: true 的 vocab

Timeline 中 type: vocab + review: true 的項目

Review 頁面不儲存內容，只做資料整合與演算法呈現。

五、可延後項目（Not Blocking）

HSK 等級 hover

複雜拖曳互動

學習熟練度視覺化

📌 此文件可隨實作調整，不影響專案核心精神。