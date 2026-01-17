# 更新日志

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



