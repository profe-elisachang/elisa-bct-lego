# 🚀 性能优化计划：Firestore 索引

## 📅 时间安排
- **本周**：使用选项 B（客户端过滤）进行功能测试 ✅
- **下周**：建立 Firestore 索引，升级到选项 A

---

## ⚠️ 待优化问题清单

### 1-1. 复习页刷新后跳回 BCT 1
**问题描述：**
- 在 `bct-review.html` 切换到 BCT 2
- URL 已更新为 `?level=btc2&cohort=taigen-a`
- 但刷新页面后，等级按钮回到 BCT 1

**原因分析：**
- `switchLevel()` 使用 `pushState` 更新 URL ✅
- 但 `init()` 方法读取 URL 后没有更新按钮的 active 状态 ❌
- 需要添加 `updateLevelButtons()` 方法

**优先级：** 中（影响用户体验，但不影响功能）

**解决方案：**
```javascript
// 在 bct-review.js 中添加
updateLevelButtons() {
    document.querySelectorAll('#levelTabSystem .level-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.level === this.currentLevel) {
            btn.classList.add('active');
        }
    });
}

// 在 init() 和 switchLevel() 后调用
this.updateLevelButtons();
```

---
### 1-2. 课程页面直接切换班级（目前需返回首页）
**问题描述：**
- 在课程页面（`lesson-template-b.html`）点击右上角「👤 Taigen A」标签
- 系统弹出班级选择对话框，确认后无法直接切换到新班级
- 必须返回首页才能成功切换

**原因分析：**
- 课程页面切换逻辑未处理 URL 更新和数据重新加载
- 首页的切换逻辑正常

**优先级：** 中（影响操作流畅度，但可通过返回首页达成目标）

**解决方案：**
- 在课程页面的班级切换确认函数中，加入：
  1. 更新 URL 参数（?cohort=新班级）
  2. 重新调用 `loadLessonData()` 或页面刷新并保留参数
- 预计修改文件：`assets/js/course.js`（或对应文件）的切换回调函数

**解決方案繁體字給我Elisa看：**  
   - 修改課程頁面的「👤 Taigen A」點擊事件，讓它也呼叫相同的彈出選擇框函數（與首頁一致）  
   - 代碼位置：lesson-template-b.html 的 navbar 點擊處理，或相關 JS 檔案  
   - 預計修改時間：15–30 分鐘  
   - 改完後測試：課程頁直接切換班級後，URL 自動更新，頁面內容跟著變更  


**预计时间：** 20-30 分钟




### 2. Firestore 查询性能优化
**当前状态：** 使用选项 B（客户端过滤）  
**目标：** 升级到选项 A（服务器端索引查询）

---

## 📊 为什么需要优化？

### 当前数据量估算：
```
单个 BCT 等级（20堂课）：
├── Components（共用）：20-40 条
├── Vocab（每班）：40-60 条  
└── Notes（每班）：60 条

单班总计：120-160 条
全部 3 个等级 × 2 个班：600-800 条
```

### 性能对比：
| 数据量 | 选项 B（当前） | 选项 A（优化后） |
|--------|--------------|----------------|
| 100 条 | 1-2 秒 ⚠️ | 0.5 秒 ✅ |
| 800 条 | 5-10 秒 ❌ | 0.5 秒 ✅ |

---

## 🔧 优化步骤（下周执行）

### 步骤 1：触发索引建立提示

1. 打开课程页面：`lesson-template-b.html?level=btc1&lesson=lesson1&cohort=taigen-a`
2. 打开浏览器 Console（F12）
3. 查看是否有黄色警告：
   ```
   The query requires an index. You can create it here:
   https://console.firebase.google.com/...
   ```
4. **复制这个链接**

---

### 步骤 2：在 Firebase Console 建立索引

1. 打开步骤 1 复制的链接（或按住 Ctrl 点击）
2. 会自动跳转到 Firebase Console 的索引建立页面
3. 确认索引参数：
   - Collection: `timeline/btc1/notes/taigen-a/items`
   - Fields: `lesson` (ASC)
4. 点击「**建立索引**」按钮
5. 等待 2-5 分钟（状态变成绿色 ✅）

**需要建立的索引：**
- Components: `timeline/{level}/components/` 的 `lesson` 字段
- Vocab: `timeline/{level}/vocab/{cohort}/items/` 的 `lesson` 字段
- Notes: `timeline/{level}/notes/{cohort}/items/` 的 `lesson` 字段

**提示：** 每个路径需要单独建立索引，Firebase 会自动提示

---

### 步骤 3：修改代码，改回使用 where 查询

修改文件：`assets/js/firestore.js`

找到 `getTimelineForLesson()` 方法，将客户端过滤改回 where 查询：

**修改前（选项 B - 客户端过滤）：**
```javascript
// 读取所有数据
.collection('items')
.get();  

// 然后在客户端过滤
snapshot.forEach(doc => {
    const data = doc.data();
    if (data.lesson === lessonId) {
        // 添加到结果
    }
});
```

**修改后（选项 A - 使用索引）：**
```javascript
// 使用 where 直接在服务器端过滤
.collection('items')
.where('lesson', '==', lessonId)
.get();

// 直接使用结果
snapshot.forEach(doc => {
    // 添加到结果
});
```

---

## 📝 相关文件

### 需要修改的文件：
- `assets/js/firestore.js` - `getTimelineForLesson()` 方法

### 需要测试的页面：
- `lesson-template-b.html` - 学生课程页面
- `timeline-admin.html` - 教师时间轴管理（下个阶段）
- `bct-review.html` - 复习系统（下个阶段）

---

## ✅ 验证优化成功

优化完成后，在 Console 应该看到：

```
🔍 开始读取 Timeline 数据：{ lessonId: 'lesson1', cohort: 'taigen-a', level: 'btc1' }
📦 读取 Components：timeline/btc1/components/
📦 找到 Components：1 个  ← 使用 where，直接找到
📝 读取 Vocab：timeline/btc1/vocab/taigen-a/items/
📝 找到 Vocab：1 个  ← 使用 where，直接找到
📒 读取 Notes：timeline/btc1/notes/taigen-a/items/
📒 找到 Notes：1 个  ← 使用 where，直接找到
⏱️ Timeline 载入速度：< 1 秒
```

**不再有「原始数量」和「过滤后」的区别，因为服务器端已经过滤好了！**

---

## 🎯 后续阶段

完成性能优化后，继续：
- ✅ **阶段 2**：学生端修改（已完成）
- 🔄 **性能优化**：建立索引（本文档）
- ⏳ **阶段 3**：教师端修改（timeline-admin.html）
- ⏳ **阶段 4**：复习系统修改（bct-review.html）
- ⏳ **阶段 5**：整合测试与文档更新

---

## 💡 小贴士

### 索引是自动维护的
- 建立索引一次后，不需要再管
- 添加新数据，索引自动更新
- 查询永远都是快的

### 如果遇到问题
- 确认索引状态是否为「已启用」（绿色勾）
- 等待索引建立完成（通常 2-5 分钟）
- 清除浏览器缓存重新测试

---

**文档创建日期：** 2026-01-17  
**优化目标：** 将查询速度从 5-10 秒优化到 0.5 秒  
**预期影响：** 提升 10-20 倍性能 🚀

---

### 3. Markdown 圖片大小控制擴展

**問題描述：**
- 目前系統只支援三種預定義圖片類型：`comp`、`origin`、`story`
- 無法靈活控制圖片大小，例如需要 30%、50%、80% 等不同寬度
- 在 Live Note 和筆記功能中，需要更多圖片大小選項

**當前實現：**
- 使用 `alt` 文字判斷圖片類型
- `![comp](url)` → 行內顯示，1.6em 高度
- `![origin](url)` → 55% 寬度，置中
- `![story](url)` → 90% 寬度，置中
- 其他 → 自適應，max-width: 100%

**優先級：** 低（不影響現有功能，屬於功能增強）

**解決方案（方案 D - 混合方式）：**

擴展 `assets/js/markdown-renderer.js` 和 `assets/js/loader.js` 的 `renderMarkdown` 方法：

1. **保留現有類型**（向後兼容）：
   - `![comp](url)` → 行內，1.6em（現有）
   - `![origin](url)` → 55% 寬度（現有）
   - `![story](url)` → 90% 寬度（現有）

2. **新增預定義類型**：
   - `![small](url)` → 30% 寬度，置中
   - `![medium](url)` → 50% 寬度，置中
   - `![large](url)` → 80% 寬度，置中
   - `![full](url)` → 100% 寬度
   - `![note](url)` → 自適應，適合筆記欄（max-width: 100%）

3. **支援自定義寬度語法**：
   - `![width:45%](url)` → 45% 寬度，置中
   - `![width:300px](url)` → 300px 固定寬度
   - `![width:40%,center](url)` → 40% 寬度，置中（可選參數）

**需要修改的文件：**
- `assets/js/markdown-renderer.js` - `renderMarkdown()` 方法
- `assets/js/loader.js` - `renderMarkdown()` 方法
- `styles/templates/lesson-b.css` - 新增 `.img-small`、`.img-medium`、`.img-large`、`.img-full`、`.img-note` 樣式

**預計時間：** 30-45 分鐘

**測試場景：**
- 在 Live Note 中輸入各種圖片語法
- 在 `lesson-template-b.html` 的筆記欄中顯示
- 確認所有圖片類型正確渲染
- 確認向後兼容（現有的 comp/origin/story 仍可用）

---

**記錄日期：** 2026-01-21  
**相關功能：** Live Note、筆記功能  
**狀態：** ⏳ 待實作

---

### 3. Markdown 圖片大小控制擴展

**問題描述：**
- 目前系統只支援三種預定義圖片類型：`comp`、`origin`、`story`
- 無法靈活控制圖片大小，例如需要 30%、50%、80% 等不同寬度
- 在 Live Note 和筆記功能中，需要更多圖片大小選項

**當前實現：**
- 使用 `alt` 文字判斷圖片類型
- `![comp](url)` → 行內顯示，1.6em 高度
- `![origin](url)` → 55% 寬度，置中
- `![story](url)` → 90% 寬度，置中
- 其他 → 自適應，max-width: 100%

**優先級：** 低（不影響現有功能，屬於功能增強）

**解決方案（方案 D - 混合方式）：**

擴展 `assets/js/markdown-renderer.js` 和 `assets/js/loader.js` 的 `renderMarkdown` 方法：

1. **保留現有類型**（向後兼容）：
   - `![comp](url)` → 行內，1.6em（現有）
   - `![origin](url)` → 55% 寬度（現有）
   - `![story](url)` → 90% 寬度（現有）

2. **新增預定義類型**：
   - `![small](url)` → 30% 寬度，置中
   - `![medium](url)` → 50% 寬度，置中
   - `![large](url)` → 80% 寬度，置中
   - `![full](url)` → 100% 寬度
   - `![note](url)` → 自適應，適合筆記欄（max-width: 100%）

3. **支援自定義寬度語法**：
   - `![width:45%](url)` → 45% 寬度，置中
   - `![width:300px](url)` → 300px 固定寬度
   - `![width:40%,center](url)` → 40% 寬度，置中（可選參數）

**需要修改的文件：**
- `assets/js/markdown-renderer.js` - `renderMarkdown()` 方法
- `assets/js/loader.js` - `renderMarkdown()` 方法
- `styles/templates/lesson-b.css` - 新增 `.img-small`、`.img-medium`、`.img-large`、`.img-full`、`.img-note` 樣式

**預計時間：** 30-45 分鐘

**測試場景：**
- 在 Live Note 中輸入各種圖片語法
- 在 `lesson-template-b.html` 的筆記欄中顯示
- 確認所有圖片類型正確渲染
- 確認向後兼容（現有的 comp/origin/story 仍可用）

---

**記錄日期：** 2026-01-21  
**相關功能：** Live Note、筆記功能  
**狀態：** ⏳ 待實作

