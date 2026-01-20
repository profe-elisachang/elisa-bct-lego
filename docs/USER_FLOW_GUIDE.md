# BCT 学习平台使用流程文档

> **版本：** 2.1  
> **更新日期：** 2026-01-17  
> **涉及系统：** 学生课程页面、教师管理后台、复习系统  
> **最新更新：** 阶段 5 完成 - URL 参数统一与班级切换优化

---

## 📋 版本更新说明

### v2.1 (2026-01-17) - 阶段 5：系统整合
- ✅ URL 参数统一：`level` + `cohort` 完整传递
- ✅ 班级切换实时更新（无需刷新）
- ✅ 复习页 BCT 等级切换（URL 同步更新）
- ⚠️ 已知问题：复习页刷新后等级按钮未保持（已记录到优化清单）

### v2.0 (2026-01-17) - 多等级/多班级系统
- ✅ 学生端班级分流系统
- ✅ 教师端多等级/多班级管理
- ✅ 复习系统支持新数据结构

---

## 目录

1. [数据架构总览](#数据架构总览)
2. [学生使用流程（lesson-template-b.html）](#学生使用流程)
3. [教师管理流程（timeline-admin.html）](#教师管理流程)
4. [复习系统流程（bct-review.html）](#复习系统流程)
5. [关键设计原则](#关键设计原则)
6. [技术实作细节](#技术实作细节)

---

## 数据架构总览

### Firestore 数据结构

```
Firestore
├── courses/                          # 官方课本内容
│   ├── btc1/
│   │   └── lessons/
│   │       ├── lesson1/
│   │       │   ├── dialogue/
│   │       │   ├── reading/
│   │       │   └── vocabulary/
│   │       ├── lesson2/...
│   │       └── lesson20/...
│   ├── btc2/
│   │   └── lessons/...
│   └── btc3/
│       └── lessons/...
│
└── timeline/                         # 教师课堂补充
    ├── btc1/
    │   ├── components/               # 所有班共用
    │   │   └── 2026-01-17/
    │   │       └── {auto-id}:
    │   │           - character: "木"
    │   │           - pinyin: "mù"
    │   │           - meaning: "wood"
    │   │           - notes: "..."
    │   │           - lesson: "lesson3"
    │   │           - date: "2026-01-17"
    │   │           - type: "component"
    │   │
    │   ├── vocab/                    # 分班独立
    │   │   ├── taigen-a/
    │   │   │   └── 2026-01-17/
    │   │   │       └── {auto-id}:
    │   │   │           - character: "树木"
    │   │   │           - pinyin: "shùmù"
    │   │   │           - meaning: "trees"
    │   │   │           - notes: "..."
    │   │   │           - lesson: "lesson3"
    │   │   │           - date: "2026-01-17"
    │   │   │           - type: "vocab"
    │   │   │           - cohort: "taigen-a"
    │   │   │
    │   │   └── taigen-b/
    │   │       └── 2026-01-17/...
    │   │
    │   └── notes/                    # 分班独立
    │       ├── taigen-a/
    │       │   └── 2026-01-17/
    │       │       └── {auto-id}:
    │       │           - title: "课堂讨论重点"
    │       │           - content: "注意『林』和『森』..."
    │       │           - lesson: "lesson3"
    │       │           - date: "2026-01-17"
    │       │           - type: "note"
    │       │           - cohort: "taigen-a"
    │       │
    │       └── taigen-b/
    │           └── 2026-01-17/...
    │
    ├── btc2/
    │   ├── components/...
    │   ├── vocab/...
    │   └── notes/...
    │
    └── btc3/
        ├── components/...
        ├── vocab/...
        └── notes/...
```

---

### 内容分层说明

| 内容类型 | 范围 | 数据来源 | 示例 |
|---------|------|---------|------|
| 官方课本 | 所有班共用 | `courses/btc1/lessons/` | Dialogue, Reading, Vocabulary |
| 部件补充 | 所有班共用 | `timeline/btc1/components/` | 「木」的解释、例字 |
| 生词补充 | 分班独立 | `timeline/btc1/vocab/taigen-a/` | 老师在 A 班讲的「树木」例句 |
| 课堂笔记 | 分班独立 | `timeline/btc1/notes/taigen-a/` | 「注意『林』和『森』的区别」 |

**核心概念：**
- **官方课本**：所有学生都学习相同的基础内容
- **部件补充（Components）**：汉字部件知识是通用的，所有班级共享
- **生词补充（Vocab）**：各班上课时讨论的例句、扩展词汇不同，需要分开
- **课堂笔记（Notes）**：记录各班课堂讨论的重点，分班独立

---

## URL 参数说明

### 参数结构

| 参数 | 值示例 | 说明 | 必填 |
|------|-------|------|------|
| `level` | `btc1`, `btc2`, `btc3` | BCT 等级 | ✅ |
| `lesson` | `L1`, `L2` 或 `lesson1` | 课程编号 | lesson-template-b.html 必填 |
| `cohort` | `taigen-a`, `taigen-b` | 学生班级 | ✅ |

### URL 示例

#### lesson-template-b.html
```
lesson-template-b.html?level=btc1&lesson=L1&cohort=taigen-a
                        ↑      ↑      ↑         ↑
                      等级   课程号   课次    班级
```

#### bct-review.html
```
bct-review.html?level=btc1&cohort=taigen-a
                 ↑             ↑
               等级         班级
```

### 参数来源优先级

系统按以下顺序读取参数：
1. **URL 参数**（最高优先级）
2. **localStorage**（用户上次选择）
3. **默认值**（`btc1` + `taigen-a`）

### 参数同步机制

- 首页选择班级 → 存入 `localStorage['bct-cohort']`
- 点击 BCT 按钮 → 动态读取 cohort，生成完整 URL
- 切换班级 → 实时更新所有课程链接（无需刷新）
- 切换 BCT 等级 → 使用 `pushState` 更新 URL

---

## 学生使用流程

### 适用页面：`lesson-template-b.html`

---

### 🎬 场景一：首次使用（选择班级）

#### 步骤 1：进入首页
- 学生打开网站首页（`index.html`）

#### 步骤 2：弹窗选班
系统检测到学生没有选过班级，显示对话框：

```
┌────────────────────────────────────┐
│  🎓 欢迎使用 BCT 学习平台！        │
│                                    │
│  请选择你的班级：                  │
│                                    │
│  [ 🎓 Taigen A ]  [ 🎓 Taigen B ] │
│                                    │
│              [确认]                │
└────────────────────────────────────┘
```

#### 步骤 3：选择班级
- 学生点击「Taigen A」按钮
- 点击「确认」
- 系统将选择储存到 localStorage

```javascript
localStorage.setItem('bct-cohort', 'taigen-a');
```

#### 步骤 4：界面更新
- 右上角 topbar 显示：`👤 Taigen A`
- 首页正常显示课程卡片
- 日后可以点击标签更换班级

---

### 🎬 场景二：进入课程页面

#### 步骤 5：点击课程卡片
- 学生在首页点击「BCT 1 - Lesson 3」卡片

#### 步骤 6：URL 自动带参数
浏览器跳转到：
```
lesson-template-b.html?level=btc1&lesson=lesson3&cohort=taigen-a
```

**参数说明：**
- `level=btc1`：课程等级
- `lesson=lesson3`：课次
- `cohort=taigen-a`：班级代号（自动从 localStorage 读取）

#### 步骤 7：页面载入
- 显示「Loading...」
- JavaScript 读取 URL 参数
- 从 Firestore 载入课程内容

---

### 🔄 场景：更换班级(1/18已經改為下拉選單可在任何頁面直接切換班級)

#### 方法一：从首页更换（推荐）

**步骤 1：**
- 回到首页（`index.html`）

**步骤 2：**
- 点击右上角橙色标签「👤 Taigen A」

**步骤 3：**
- 系统弹出班级选择对话框
- 选择新班级（例如：Taigen B）
- 点击「确认」

**步骤 4：**
- 重新点击课程卡片进入课程
- URL 自动更新为新班级：`?cohort=taigen-b`

#### 方法二：从课程页面返回首页

**步骤 1：**
- 在课程页面（`lesson-template-b.html`）
- 点击右上角「👤 Taigen A」标签（这是一个链接）

**步骤 2：**
- 自动跳转回首页（`index.html`）

**步骤 3：**
- 点击右上角橙色标签「👤 Taigen A」
- 选择新班级

**注意：**
- 课程页面的班级标签**不会弹出选择框**
- 必须返回首页才能更换班级
- 这样设计是为了避免学生误操作

---

### 📚 场景三：查看课程内容

#### Tab 导航栏布局

```
┌────────────────────────────────────────────────────────────────┐
│ [Dialogue] [Reading] [Vocabulary] [Components] [Vocab A] [Practice] │
└────────────────────────────────────────────────────────────────┘
```

**Tab 标签说明：**
- **Dialogue**：官方对话内容
- **Reading**：官方阅读内容
- **Vocabulary**：官方生词
- **Components**：部件补充（所有班共用）
- **Vocab A**：生词补充（动态显示班级）
  - Taigen A 班看到：`Vocab A`
  - Taigen B 班看到：`Vocab B`
- **Practice**：练习（开发中）

---

#### Tab 1: Dialogue（官方内容）

**小标题：**
```
Lesson 3: 你好
```

**内容来源：**
```javascript
courses/btc1/lessons/lesson3/dialogue
```

**显示内容：**
- 对话分组显示（Dialogue 1, Dialogue 2...）
- 每句包含：
  - 拼音（Pinyin）
  - 汉字（Character）
  - 英文翻译（English）
  - 西班牙文翻译（Español）
  - 🔊 发音按钮

**特点：**
- 所有班级看到的内容一样
- 可以切换隐藏/显示英文、西班牙文

**无内容时显示：**
```
暂无内容
Nothing here yet.
```

---

#### Tab 2: Reading（官方内容）

**内容来源：**
```javascript
courses/btc1/lessons/lesson3/reading
```

**显示内容：**
- 阅读句子卡片
- 每句包含：
  - 拼音（Pinyin）
  - 汉字（Character）
  - 英文翻译（English）
  - 西班牙文翻译（Español）
  - 🔊 发音按钮

**特点：**
- 所有班级看到的内容一样

**无内容时显示：**
```
暂无内容
Nothing here yet.
```

---

#### Tab 3: Vocabulary（官方内容）

**内容来源：**
```javascript
courses/btc1/lessons/lesson3/vocabulary
```

**显示内容：**
- 生词卡片（带 HSK 级别标签）
- 每个词包含：
  - 汉字（Character）+ 🔊 发音按钮
  - HSK 级别徽章（例如：`HSK 1`）
  - 拼音（Pinyin）
  - 英文翻译（English）
  - 西班牙文翻译（Español）

**特点：**
- 所有班级看到的内容一样
- HSK 徽章颜色根据级别不同

**无内容时显示：**
```
暂无内容
Nothing here yet.
```

---

#### Tab 4: Components（黑板补充 - 所有班共用）

**页面小标题：**
```
📦 部件补充（Teacher's Supplements）
```

**内容来源：**
```javascript
timeline/btc1/components/
// 筛选条件：lesson === 'lesson3'
```

**显示内容：**
- 老师讲过的部件卡片（例如：「木」）
- 每个部件包含：
  - 汉字（Character）+ 🔊 发音按钮
  - 拼音（Pinyin）
  - 意思（Meaning）
  - 补充说明（Notes）

**显示范例：**
```
┌──────────────────────┐
│  木  🔊              │
│  mù                  │
│  wood                │
│  记忆：像一棵树的样子  │
└──────────────────────┘
```

**特点：**
- Taigen A 和 Taigen B 看到的内容**一样**
- 部件知识是共通的，不需要分班
- 按日期倒序排列（最新的在上方）

**无内容时显示：**
```
暂无内容
Nothing here yet.
```

---

#### Tab 5: Vocab A（黑板补充 - 分班独立）

**页面小标题：**
```
📝 班级生词补充（Class Vocabulary）
```

**内容来源：**
```javascript
// Taigen A 班
timeline/btc1/vocab/taigen-a/
// 筛选条件：lesson === 'lesson3'

// Taigen B 班
timeline/btc1/vocab/taigen-b/
// 筛选条件：lesson === 'lesson3'
```

**显示内容：**
- 老师在该班上课时额外补充的生词卡片
- 每个词包含：
  - 汉字（Character）+ 🔊 发音按钮
  - 拼音（Pinyin）
  - 意思（Meaning）
  - 补充说明（Notes）

**显示范例：**
```
┌────────────────────────────┐
│  树木  🔊                  │
│  shùmù                     │
│  trees; árboles            │
│  例句：公园里有很多树木     │
└────────────────────────────┘
```

**特点：**
- Taigen A 班**看不到** Taigen B 的内容（反之亦然）
- 记录各班上课时老师补充的例句、扩展词汇
- 按日期倒序排列

**无内容时显示：**
```
暂无内容
Nothing here yet.
```

---

#### Tab 6: Practice（功能开发中）

**无内容时显示：**
```
练习功能开发中...
Practice feature coming soon.
```

---

### 📝 右侧笔记区（分班独立）

**位置：** 页面右侧固定区域

**卡片标题：**
```
Elisa 的笔记
```

**内容来源：**
```javascript
// Taigen A 班
timeline/btc1/notes/taigen-a/
// 筛选条件：lesson === 'lesson3'

// Taigen B 班
timeline/btc1/notes/taigen-b/
// 筛选条件：lesson === 'lesson3'
```

**显示内容：**
- 老师在该班上课时写的课堂笔记
- 每条笔记包含：
  - 标题（Title）
  - 内容（Content）

**显示范例：**
```
┌─────────────────────────┐
│  Elisa 的笔记           │
├─────────────────────────┤
│  课堂讨论重点           │
│  注意『林』和『森』的    │
│  区别：林是两个木，森    │
│  是三个木...            │
│                         │
│  发音技巧               │
│  注意声调变化...        │
└─────────────────────────┘
```

**特点：**
- 分班独立，Taigen A 看不到 Taigen B 的笔记
- 按日期倒序排列
- 可以有多条笔记

**无内容时显示：**
```
暂无笔记
No notes yet.
```

---

## 教师管理流程

### 适用页面：`timeline-admin.html`

---

### 🔑 场景一：登录验证

#### 步骤 1：进入管理页面
- 教师打开 `timeline-admin.html`

#### 步骤 2：密码验证
系统弹出输入框：
```
┌────────────────────────┐
│ 请输入老师密码：       │
│ [__________________]   │
│                        │
│    [确定]   [取消]     │
└────────────────────────┘
```

**密码：** `yainu8up`

#### 步骤 3：验证成功
- 右上角状态显示：`已验证`
- 密码储存在 localStorage
- 下次进入自动登录

#### 步骤 4：登出
- 点击「登出」按钮
- 清除 localStorage
- 刷新页面重新验证

---

### ➕ 场景二：新增课堂补充

#### 表单布局

```
┌────────────────────────────────────────┐
│  🛠️ 课堂补充管理                      │
│  状态：[已验证]  [登出]               │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  新增补充                              │
├────────────────────────────────────────┤
│  等级：  [BCT 1] [BCT 2] [BCT 3]      │
│  班级：  [Taigen A] [Taigen B]        │  ← 根据类型显示/隐藏
│  日期：  [2026-01-17]                 │
│  课次：  [下拉选单: Lesson 1-20]      │
│  类型：  ○ 部件  ○ 生词  ○ 笔记      │
│                                        │
│  汉字：  [________________]            │  ← 部件/生词时显示
│  拼音：  [________________]            │  ← 部件/生词时显示
│  意思：  [________________]            │  ← 部件/生词时显示
│  补充：  [________________]            │  ← 部件/生词时显示
│         [________________]            │
│                                        │
│  笔记标题：[________________]          │  ← 笔记时显示
│  笔记内容：[________________]          │  ← 笔记时显示
│           [________________]          │
│           [________________]          │
│                                        │
│          [💾 储存]                     │
└────────────────────────────────────────┘
```

---

#### 表单字段说明

##### 1. 等级选择（新增）
```
[BCT 1] [BCT 2] [BCT 3]
```
- 样式：Tab 按钮
- 预设选中：BCT 1
- 点击切换

##### 2. 班级选择（新增 - 条件显示）
```
[Taigen A] [Taigen B]
```
- 样式：Tab 按钮
- **显示条件：**
  - 类型选择「生词」或「笔记」时显示
  - 类型选择「部件」时隐藏（因为部件是所有班共用）
- 必填（当显示时）

##### 3. 日期
```
[2026-01-17]  ← 日期选择器
```
- 预设：今天
- 可以选择过去或未来的日期

##### 4. 课次
```
下拉选单：
[ 选择课次... ]
[ Lesson 1   ]
[ Lesson 2   ]
  ...
[ Lesson 20  ]
```
- 必填

##### 5. 类型（单选）
```
○ 部件（所有班共用）
○ 生词（分班独立）
○ 笔记（分班独立）
```
- 预设选中：部件
- 选择不同类型时，下方表单字段会动态变化

---

#### 类型 A：新增部件（所有班共用）

**选择「○ 部件」时：**

**显示字段：**
```
班级选择器：【隐藏】

汉字：  [例如：氵              ]
拼音：  [例如：shuǐ            ]
意思：  [English | Español     ]
补充：  [记忆故事、例句等...    ]
       [________________________]
```

**储存路径：**
```javascript
timeline/btc1/components/2026-01-17/{auto-id}
```

**数据结构：**
```javascript
{
  type: 'component',
  character: '氵',
  pinyin: 'shuǐ',
  meaning: 'water radical | radical de agua',
  notes: '三点水，与水有关的字大多有这个部件，例如：河、海、洗...',
  lesson: 'lesson3',
  date: '2026-01-17',
  timestamp: '2026-01-17T10:30:00Z'
}
```

**操作流程：**
1. 选择等级：BCT 1
2. 选择日期：2026-01-17
3. 选择课次：Lesson 3
4. 选择类型：○ 部件
5. 填写汉字：氵
6. 填写拼音：shuǐ
7. 填写意思：water radical | radical de agua
8. 填写补充：三点水，与水有关...
9. 点击「💾 储存」
10. 成功提示：「储存成功！」
11. 表单自动清空

**结果：**
- 所有 BCT 1 的 Lesson 3，所有班级（Taigen A 和 Taigen B）的学生都能在 Components tab 看到这个部件

---

#### 类型 B：新增生词（分班独立）

**选择「○ 生词」时：**

**显示字段：**
```
班级选择器：【显示】
班级：  [Taigen A] [Taigen B]  ← 必须选择

汉字：  [例如：树木            ]
拼音：  [例如：shùmù           ]
意思：  [trees | árboles       ]
补充：  [公园里有很多树木...    ]
       [________________________]
```

**储存路径（以 Taigen A 为例）：**
```javascript
timeline/btc1/vocab/taigen-a/2026-01-17/{auto-id}
```

**数据结构：**
```javascript
{
  type: 'vocab',
  cohort: 'taigen-a',  // 新增字段
  character: '树木',
  pinyin: 'shùmù',
  meaning: 'trees | árboles',
  notes: '公园里有很多树木。Parks have many trees.',
  lesson: 'lesson3',
  date: '2026-01-17',
  timestamp: '2026-01-17T10:30:00Z'
}
```

**操作流程：**
1. 选择等级：BCT 1
2. 选择班级：Taigen A
3. 选择日期：2026-01-17
4. 选择课次：Lesson 3
5. 选择类型：○ 生词
6. 填写汉字：树木
7. 填写拼音：shùmù
8. 填写意思：trees | árboles
9. 填写补充：公园里有很多树木...
10. 点击「💾 储存」
11. 成功提示：「储存成功！」
12. 表单自动清空

**结果：**
- **只有 Taigen A 班**的学生在 BCT 1 的 Lesson 3 能在 Vocab A tab 看到这个生词
- Taigen B 班的学生看不到

---

#### 类型 C：新增笔记（分班独立）

**选择「○ 笔记」时：**

**显示字段：**
```
班级选择器：【显示】
班级：  [Taigen A] [Taigen B]  ← 必须选择

笔记标题：[课堂讨论重点                    ]
笔记内容：[注意『林』和『森』的区别：      ]
         [林是两个木，表示树林；            ]
         [森是三个木，表示森林。            ]
         [森林比树林更茂密。                ]
```

**储存路径（以 Taigen A 为例）：**
```javascript
timeline/btc1/notes/taigen-a/2026-01-17/{auto-id}
```

**数据结构：**
```javascript
{
  type: 'note',
  cohort: 'taigen-a',  // 新增字段
  title: '课堂讨论重点',
  content: '注意『林』和『森』的区别：林是两个木，表示树林；森是三个木，表示森林。森林比树林更茂密。',
  lesson: 'lesson3',
  date: '2026-01-17',
  timestamp: '2026-01-17T10:30:00Z'
}
```

**操作流程：**
1. 选择等级：BCT 1
2. 选择班级：Taigen A
3. 选择日期：2026-01-17
4. 选择课次：Lesson 3
5. 选择类型：○ 笔记
6. 填写标题：课堂讨论重点
7. 填写内容：注意『林』和『森』的区别...
8. 点击「💾 储存」
9. 成功提示：「储存成功！」
10. 表单自动清空

**结果：**
- **只有 Taigen A 班**的学生在 BCT 1 的 Lesson 3 能在右侧笔记区看到这条笔记
- Taigen B 班的学生看不到

---

### 🔍 场景三：筛选 / 搜寻

#### 筛选面板布局

```
┌────────────────────────────────────────┐
│  筛选 / 搜寻                          │
├────────────────────────────────────────┤
│  等级：  [BCT 1] [BCT 2] [BCT 3] [全部]│
│  班级：  [Taigen A] [Taigen B] [全部] │
│  课次：  [下拉：全部课次 | Lesson 1-20]│
│  类型：  ☑ 部件  ☑ 生词  ☑ 笔记      │
│  关键字：[字/拼音/意思/标题...]        │
│  日期范围：[2026-01-01] — [2026-01-31]│
│                                        │
│          [🔍 查询]                     │
└────────────────────────────────────────┘
```

#### 筛选条件说明

##### 1. 等级筛选（新增）
```
[BCT 1] [BCT 2] [BCT 3] [全部]
```
- 样式：按钮组
- 预设：全部
- 可以单选

##### 2. 班级筛选（新增）
```
[Taigen A] [Taigen B] [全部]
```
- 样式：按钮组
- 预设：全部
- 可以单选
- **注意：** 部件类型的资料会显示「(共用)」

##### 3. 课次筛选
```
下拉选单：
[ 全部课次  ]
[ Lesson 1  ]
[ Lesson 2  ]
  ...
[ Lesson 20 ]
```
- 预设：全部课次

##### 4. 类型筛选（多选）
```
☑ 部件
☑ 生词
☑ 笔记
```
- 预设：全部勾选
- 可以多选

##### 5. 关键字搜寻
```
[字/拼音/意思/标题...]
```
- 搜寻范围：汉字、拼音、意思、补充说明、笔记标题、笔记内容
- 不区分大小写

##### 6. 日期范围
```
[2026-01-01] — [2026-01-31]
```
- 可以只填开始日期或结束日期
- 预设：当天

#### 筛选按钮
```
[🔍 查询]
```
- 点击后重新载入列表
- 自动跳到第一页

---

### 📋 场景四：补充列表

#### 列表显示格式

```
┌────────────────────────────────────────┐
│  补充列表                              │
│  共 15 笔                              │
├────────────────────────────────────────┤
│  日期        课次      等级    班级    │
│  类型        内容              操作    │
├────────────────────────────────────────┤
│  2026-01-17  Lesson 3  BCT 1  Taigen A│
│  [生词]      树木 · shùmù     [删除]  │
│              trees | árboles          │
├────────────────────────────────────────┤
│  2026-01-17  Lesson 3  BCT 1  (共用)  │
│  [部件]      氵 · shuǐ        [删除]  │
│              water radical            │
├────────────────────────────────────────┤
│  2026-01-17  Lesson 3  BCT 1  Taigen A│
│  [笔记]      课堂讨论重点     [删除]  │
│              注意『林』和『森』...    │
├────────────────────────────────────────┤
│  2026-01-16  Lesson 2  BCT 1  Taigen B│
│  [生词]      天气 · tiānqì    [删除]  │
│              weather | clima          │
└────────────────────────────────────────┘

         [上一页]  1 / 3  [下一页]
```

#### 列表栏位说明

| 栏位 | 说明 |
|-----|------|
| 日期 | 新增时填写的日期 |
| 课次 | 关联的课程（Lesson 1-20） |
| 等级 | BCT 1/2/3 |
| 班级 | Taigen A/B 或「(共用)」 |
| 类型 | [部件] / [生词] / [笔记] |
| 内容 | 根据类型显示主要信息 |
| 操作 | [删除] 按钮 |

#### 列表排序
- 按日期倒序排列
- 同一天的按新增时间倒序
- 最新的在最上方

#### 分页控制
```
[上一页]  1 / 3  [下一页]
```
- 每页显示 20 笔
- 自动计算总页数
- 第一页时「上一页」禁用
- 最后一页时「下一页」禁用

---

### 🗑️ 场景五：删除补充

#### 步骤 1：点击删除按钮
- 在列表中找到要删除的资料
- 点击该笔资料的「删除」按钮

#### 步骤 2：确认对话框
```
┌────────────────────────┐
│  确定删除这笔资料？    │
│                        │
│   [确定]    [取消]     │
└────────────────────────┘
```

#### 步骤 3：删除确认
- 点击「确定」：从 Firestore 删除该笔资料
- 点击「取消」：关闭对话框，不删除

#### 步骤 4：列表更新
- 删除成功后自动刷新列表
- 笔数统计更新
- 如果当前页没有资料了，自动跳到前一页

#### 注意事项
- 删除操作**无法撤销**
- 删除后学生端立即看不到该内容
- 建议定期备份重要资料

---

## 复习系统流程

### 适用页面：`bct-review.html`

---

### 🎯 场景一：进入复习页面

#### 方式 A：从课程页面点击

```
lesson-template-b.html
↓ 左侧边栏
↓ 点击「⚡ 课程复习」按钮
↓ URL 自动带参数
bct-review.html?cohort=taigen-a
```

**优点：**
- 自动带入学生的班级参数
- 学生不需要再选择班级

---

#### 方式 B：直接进入

```
直接打开 bct-review.html
↓ JavaScript 从 localStorage 读取班级
localStorage.getItem('bct-cohort')  // 'taigen-a'
↓ 如果没有，提示选择班级
```

**优点：**
- 可以直接访问复习页面
- 书签友善

---

### 🎯 场景二：选择复习范围

#### 页面布局

```
┌──────────────────────────────────────────┐
│        🧠 BCT Review System              │
│                                          │
│    [BCT 1] [BCT 2] [BCT 3]  ← 等级选择  │
│                                          │
│  Spaced Repetition • Smart Review       │
├──────────────────────────────────────────┤
│  [Components] [Characters] [Vocab]       │
│         ↑ 内容类型选择                   │
├──────────────────────────────────────────┤
│  课程选择 (0/20)                         │
│  ┌────────────────────────────────────┐ │
│  │ [L1] [L2] [L3] [L4] [L5]          │ │
│  │ [L6] [L7] [L8] [L9] [L10]         │ │
│  │ [L11] [L12] [L13] [L14] [L15]     │ │
│  │ [L16] [L17] [L18] [L19] [L20]     │ │
│  └────────────────────────────────────┘ │
│                                          │
│          [开始复习]                      │
└──────────────────────────────────────────┘
```

---

#### 步骤 1：选择等级

```
[BCT 1] [BCT 2] [BCT 3]
```

- 预设选中：BCT 1
- 点击切换等级
- 切换时：
  - 下方的课程选择器重新载入该等级的 20 课
  - 清空当前选择的课程
  - 从 localStorage 恢复该等级的选课记录

---

#### 步骤 2：选择内容类型

```
[Components] [Characters] [Vocab]
```

- **Components**：部件模式
  - 复习卡片显示部件、拼音、意思
  - 包含官方课本的部件 + Timeline 补充的部件（所有班共用）
  
- **Characters**：汉字模式
  - 复习卡片显示完整汉字、拼音、意思
  - 包含官方课本的生词
  
- **Vocab**：词汇模式
  - 复习卡片显示词汇、拼音、意思
  - 包含官方课本的生词 + Timeline 补充的生词（**只有该班的**）

---

#### 步骤 3：选择课程

```
课程选择 (0/20)

[L1] [L2] [L3] ... [L20]
```

- 点击课程按钮勾选/取消
- 可以多选
- 数字显示已选择的课程数量
- 选择会自动储存到 localStorage（按等级分别储存）

---

#### 步骤 4：开始复习

```
[开始复习]
```

- 点击按钮
- 系统载入选中课程的所有内容
- 进入复习卡片模式

---

### 🎴 场景三：复习卡片内容来源

#### 例：Taigen A 班学生，选择 BCT 1, L1-L3 复习

---

##### Components 模式

**卡片来源：**

✅ **官方词汇中的部件**
```javascript
courses/btc1/lessons/lesson1/vocabulary
courses/btc1/lessons/lesson2/vocabulary
courses/btc1/lessons/lesson3/vocabulary
// 筛选条件：type === 'component'
```

✅ **Timeline 部件补充（所有班共用）**
```javascript
timeline/btc1/components/*
// 筛选条件：lesson in ['lesson1', 'lesson2', 'lesson3']
```

❌ **不包含：**
- 其他等级的内容（BCT 2, BCT 3）
- 其他课次的内容（L4-L20）

**说明：**
- 部件是所有班共用的，所以不需要过滤班级
- Taigen A 和 Taigen B 在 Components 模式看到的内容一样

---

##### Vocab 模式

**卡片来源：**

✅ **官方词汇**
```javascript
courses/btc1/lessons/lesson1/vocabulary
courses/btc1/lessons/lesson2/vocabulary
courses/btc1/lessons/lesson3/vocabulary
// 筛选条件：type === 'vocab'
```

✅ **Taigen A 班的生词补充**
```javascript
timeline/btc1/vocab/taigen-a/*
// 筛选条件：lesson in ['lesson1', 'lesson2', 'lesson3']
```

❌ **不包含：**
```javascript
timeline/btc1/vocab/taigen-b/*  // Taigen B 班的生词
```

**说明：**
- 生词是分班独立的
- Taigen A 班只能复习自己班级的补充生词
- Taigen B 班看到的补充生词会不同

---

### 🎴 场景四：复习卡片操作

#### 卡片显示模式

**模式 1：拼音提示模式（Pinyin Hint）**
```
┌────────────────────────┐
│                        │
│      shùmù             │  ← 显示拼音
│                        │
│   [显示答案]           │
└────────────────────────┘
```

点击「显示答案」后：
```
┌────────────────────────┐
│       树木             │  ← 显示汉字
│       shùmù            │
│  trees | árboles       │  ← 显示意思
│                        │
│  [😊 会了] [🤔 再看]  │
└────────────────────────┘
```

---

**模式 2：汉字提示模式（Character Hint）**
```
┌────────────────────────┐
│                        │
│       树木             │  ← 显示汉字
│                        │
│   [显示答案]           │
└────────────────────────┘
```

点击「显示答案」后：
```
┌────────────────────────┐
│       树木             │
│       shùmù            │  ← 显示拼音
│  trees | árboles       │  ← 显示意思
│                        │
│  [😊 会了] [🤔 再看]  │
└────────────────────────┘
```

---

#### 复习统计

```
┌────────────────────────┐
│  进度：15 / 50         │
│  已会：8               │
│  再看：3               │
└────────────────────────┘
```

- 实时更新复习进度
- 记录学生的掌握情况

---

## 关键设计原则

### 1. 数据隔离清晰

| 内容类型 | 范围 | 原因 | 储存位置 |
|---------|------|------|---------|
| 官方课本 | 所有班共用 | 标准教材内容 | `courses/btc1/lessons/` |
| 部件补充 | 所有班共用 | 汉字部件知识是通用的 | `timeline/btc1/components/` |
| 生词补充 | 分班独立 | 各班进度和讨论内容不同 | `timeline/btc1/vocab/taigen-a/` |
| 课堂笔记 | 分班独立 | 上课讨论的重点不同 | `timeline/btc1/notes/taigen-a/` |

**设计理由：**
- 官方课本是标准化内容，所有学生都需要学习
- 部件知识（如「木」、「氵」）是客观的汉字结构知识，不因班级而异
- 生词补充和笔记记录各班上课时的讨论和例句，因班级而异

---

### 2. 用户体验流畅

**学生端：**
- ✅ 首次选择班级后，系统自动记住（localStorage）
- ✅ URL 自动带班级参数，分享链接时不会搞混
- ✅ 切换班级时，相关内容自动更新
- ✅ Review 页面自动过滤该班级的补充内容
- ✅ 界面文字简洁清晰

> 🔧 **2026-01 更新（班级凍结机制上线）**  
> 目前前台默认固定使用 `taigen-a`，并且可通过开关隐藏 Group UI（原因：手机导航太窄 + `taigen-b` 已冻结）。  
> - 当 `window.BCT_ENABLE_GROUP_UI = false` 时：学生端不会看到/操作班级切换，但系统仍会带/用 `cohort=taigen-a`。  
> - 即使用户手动改 URL 带入冻结班级（例如 `?cohort=taigen-b`），也会被前台 guard 自动改回 active cohort。

**教师端：**
- ✅ 新增内容时，自动判断是否需要选择班级
  - 部件 → 不需要选班级（自动存到共用区）
  - 生词/笔记 → 需要选班级（存到对应班级目录）
- ✅ 列表清楚显示内容属于哪个班级
- ✅ 筛选功能强大，可按等级、班级、课次、类型、关键字搜寻
- ✅ 一次登录，记住密码

---

### 3. 界面文字统一

**简体中文：**
- 所有提示文字：`暂无内容 Nothing here yet.`
- 按钮文字：`确认`、`删除`、`查询`、`储存`
- 状态信息：`已验证`、`共 15 笔`

**英文术语保持英文：**
- 专业术语：`Dialogue`, `Reading`, `Vocabulary`, `Components`, `Practice`
- Tab 标签：`Vocab A`, `Vocab B`（节省空间）
- 复习模式：`Pinyin Hint`, `Character Hint`

**原因：**
- 网站主要用户是中文学习者
- 专业术语保持英文有助于国际化
- 界面文字统一提升专业感

---

### 4. 扩展性强

**新增等级：**
- 只需在 Firestore 新增 `courses/btc4/lessons/` 和 `timeline/btc4/` 路径
- 前端自动支持（等级选择器可配置化）

**新增班级：**
- ✅ **推荐做法（新）：用 Firestore 的 `cohorts` collection 管控班级状态**  
  - 建立/更新：`cohorts/{cohortId}`  
  - 字段：`status`（目前只用 `active` / `frozen`）  
  - 前台会在初始化时读取并强制使用 active cohort（见下方「班级凍结机制」）

- ✅ **新增班级（老师操作手册）**
  - **步骤 A：先在 Firestore 建 cohort**
    - 新增文件：`cohorts/taigen-c`
    - 设置：`status = "active"`（要开放给学生使用就设 active；暂时不开就设 frozen）
  - **步骤 B：新增 Timeline 路径（按需求）**
    - 生词：`timeline/{level}/vocab/taigen-c/items/*`
    - 笔记：`timeline/{level}/notes/taigen-c/items/*`
    - 部件：仍是共用 `timeline/{level}/components/*`（无需新增班级路径）
  - **步骤 C：决定要不要开放前台「Group UI」**
    - 若你目前仍想维持「固定 A / 不显示 Group」：不用改 UI，新增 cohort 也不会影响学生端（但 teacher admin 仍可写入新 cohort 路径）。
    - 若你要让学生端可以切换班级：把 `assets/js/app-flags.js` 里的开关打开：
      - `window.BCT_ENABLE_GROUP_UI = true;`
    - （打开后）如需让下拉/弹窗显示新班级，再更新前端列表：
      - `assets/js/nav.js`（桌面导航 cohort 下拉）
      - `assets/js/mobile-nav.js`（手机 Group 下拉）
      - `assets/js/cohort-selector.js`（首次选择班级弹窗）
      - 以及任何写死的显示标签（例如 `Vocab A/B` 的地方）

- ✅ **冻结班级（让学生端不可访问）**
  - 把 `cohorts/{cohortId}.status` 设为 `"frozen"`  
  - 学生端会被 guard 自动 fallback 到 `taigen-a`，并且不会读/写冻结班级的数据路径

**新增课程类型：**
- 在 Timeline Admin 新增类型选项
- 定义新的储存路径规则
- 前端对应新增 Tab

---

### 5. 数据安全性

**教师端：**
- 密码验证（简易版）
- localStorage 记住登录状态
- 删除操作需要二次确认

**学生端：**
- 不需要登录
- 班级选择储存在本地
- 无法看到其他班级的私密内容

**未来改进：**
- Firebase Authentication（OAuth）
- 角色权限管理（学生/教师/管理员）
- 操作日志记录

---

## 技术实作细节

### localStorage 使用

```javascript
// 储存学生班级
localStorage.setItem('bct-cohort', 'taigen-a');

// 读取学生班级
const cohort = localStorage.getItem('bct-cohort');
// 返回：'taigen-a' 或 null（未设置）

// 储存教师密码
localStorage.setItem('teacher_auth', 'yainu8up');

// 储存各等级的选课记录
localStorage.setItem('btc1-selected', JSON.stringify([1, 2, 3]));
localStorage.setItem('btc2-selected', JSON.stringify([5]));

// 读取选课记录
const selected = JSON.parse(localStorage.getItem('btc1-selected') || '[]');
// 返回：[1, 2, 3]
```

---

### URL 参数传递

```javascript
// 课程页面 URL
lesson-template-b.html?level=btc1&lesson=lesson3&cohort=taigen-a

// 复习页面 URL
bct-review.html?cohort=taigen-a

// 读取 URL 参数
const urlParams = new URLSearchParams(window.location.search);
const cohort = urlParams.get('cohort');    // 'taigen-a'
const level = urlParams.get('level');      // 'btc1'
const lesson = urlParams.get('lesson');    // 'lesson3'

// 如果参数不存在，返回 null
// 可以提供默认值
const cohort = urlParams.get('cohort') || 'taigen-a';
```

---

### 班级凍结机制（active / frozen）

**目标：**
- 页面初始化时，从 URL/localStorage 取得 cohortId 后，去 Firestore 检查 `cohorts/{cohortId}.status`
- 若不是 `active`（包含 `frozen` 或文件不存在），就强制改用 `taigen-a`
- 该机制会拦截用户手动改 URL 的行为，避免读取/写入冻结班级的数据

**前端实现文件：**
- `assets/js/cohort-guard.js`
  - 会读取 Firestore `cohorts` collection
  - 计算并写入：
    - `window.BCT_ACTIVE_COHORT`
    - `window.BCT_ALLOWED_COHORTS`（只包含 active cohorts）
  - 会同步修正：
    - `localStorage['bct-cohort']`
    - URL query `cohort=...`（使用 `history.replaceState`，不重载页面）

**相关开关：**
- `assets/js/app-flags.js`
  - `window.BCT_ENABLE_GROUP_UI = false`：隐藏 Group UI（桌面+手机+首次选班）
  - 未来要开回班级切换：改成 `true`

### Firestore 查询范例

#### 查询 Taigen A 班的生词补充（Lesson 3）

```javascript
// 查询路径：timeline/btc1/vocab/taigen-a/2026-01-17
const snapshot = await db.collection('timeline')
  .doc('btc1')
  .collection('vocab')
  .doc('taigen-a')
  .collection('2026-01-17')
  .where('lesson', '==', 'lesson3')
  .get();

snapshot.forEach(doc => {
  console.log(doc.id, doc.data());
});
```

---

#### 查询所有班共用的部件补充（Lesson 1-3）

```javascript
// 查询路径：timeline/btc1/components/*
const snapshot = await db.collection('timeline')
  .doc('btc1')
  .collection('components')
  .collectionGroup()
  .where('lesson', 'in', ['lesson1', 'lesson2', 'lesson3'])
  .get();

snapshot.forEach(doc => {
  console.log(doc.id, doc.data());
});
```

---

#### 使用 collectionGroup 查询所有日期的资料

```javascript
// 查询所有日期下的 Taigen A 生词（效率较低，适合管理后台）
const snapshot = await db.collectionGroup('vocabulary')
  .where('cohort', '==', 'taigen-a')
  .where('lesson', '==', 'lesson3')
  .orderBy('timestamp', 'desc')
  .get();

snapshot.forEach(doc => {
  console.log(doc.ref.path, doc.data());
  // 输出：timeline/btc1/vocab/taigen-a/2026-01-17/abc123
});
```

---

### 动态 Tab 标签更新

```javascript
// 读取学生班级
const cohort = localStorage.getItem('bct-cohort'); // 'taigen-a'

// 转换为显示代号
const cohortLabel = cohort === 'taigen-a' ? 'A' : 'B';

// 更新 Vocab tab 标签
const vocabTab = document.getElementById('vocabTab');
vocabTab.textContent = `Vocab ${cohortLabel}`;

// 结果：
// Taigen A 班看到：Vocab A
// Taigen B 班看到：Vocab B
```

---

### 条件显示表单字段

```javascript
// 监听类型选择变化
document.querySelectorAll('input[name="type"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const type = e.target.value; // 'component', 'vocab', 或 'note'
    
    // 班级选择器
    const cohortSelector = document.getElementById('cohortSelector');
    
    // 部件 → 隐藏班级选择器
    // 生词/笔记 → 显示班级选择器
    if (type === 'component') {
      cohortSelector.style.display = 'none';
    } else {
      cohortSelector.style.display = 'block';
    }
    
    // 切换表单字段
    document.querySelectorAll('.type-vocab').forEach(el => {
      el.style.display = (type !== 'note') ? 'block' : 'none';
    });
    
    document.querySelectorAll('.type-note').forEach(el => {
      el.style.display = (type === 'note') ? 'block' : 'none';
    });
  });
});
```

---

## 更新记录

| 版本 | 日期 | 更新内容 | 涉及文件 |
|-----|------|---------|---------|
| 1.0 | 2026-01-15 | 初始版本 | - |
| 2.0 | 2026-01-17 | 新增班级分流功能、多等级支持 | `lesson-template-b.html`, `timeline-admin.html`, `bct-review.html` |

---

## 常见问题（FAQ）

### Q1: 学生如何更换班级？

**A:** 点击右上角的班级标签（例如「👤 Taigen A」），会弹出选班对话框，重新选择即可。

---

### Q2: 教师如何知道某个补充内容属于哪个班级？

**A:** 在 Timeline Admin 的列表中，班级栏位会显示：
- `(共用)`：所有班级都能看到（部件）
- `Taigen A`：只有 Taigen A 班能看到（生词/笔记）
- `Taigen B`：只有 Taigen B 班能看到（生词/笔记）

---

### Q3: 如果教师想让某个生词两个班都能看到，怎么办？

**A:** 需要分别新增两次：
1. 第一次选择班级「Taigen A」，新增生词
2. 第二次选择班级「Taigen B」，新增生词

**未来改进：** 可以新增「批量复制到其他班级」功能。

---

### Q4: 复习系统会记录学生的复习进度吗？

**A:** 目前版本（2.0）还没有记录功能。

**未来改进：**
- 记录每个学生的复习历史
- 根据艾宾浩斯遗忘曲线推荐复习时间
- 显示掌握度统计

---

### Q5: 如何备份 Firestore 数据？

**A:** 使用 Firebase Console 的导出功能：
1. 进入 Firebase Console
2. 选择项目 `bct-lego`
3. 进入 Firestore Database
4. 点击「导出数据」
5. 选择导出路径和集合

**建议：** 每周定期备份一次。

---

### Q6: 如果误删了重要的补充内容，能恢复吗？

**A:** 目前版本（2.0）删除是不可逆的。

**建议：**
- 删除前仔细确认
- 定期备份 Firestore 数据
- 重要内容可以先导出到 Excel

**未来改进：**
- 软删除功能（标记为删除，但不真正删除）
- 回收站功能（30 天内可恢复）
- 操作日志（记录谁在什么时候删除了什么）

---

## 附录

### A. 班级代号对照表

| 显示名称 | 代号 | 储存值 |
|---------|------|--------|
| Taigen A | A | `taigen-a` |
| Taigen B | B | `taigen-b` |

**命名规则：**
- 显示名称：用于界面显示，首字母大写
- 代号：用于简短显示（例如 Vocab A）
- 储存值：用于数据库路径，全小写，用连字符连接

---

### B. 课程等级代号对照表

| 显示名称 | 代号 | 储存值 |
|---------|------|--------|
| BCT 1 | 1 | `btc1` |
| BCT 2 | 2 | `btc2` |
| BCT 3 | 3 | `btc3` |

---

### C. 文件清单

| 文件路径 | 功能 | 修改状态 |
|---------|------|---------|
| `index.html` | 首页（课程卡片） | ✅ 已修改 |
| `lesson-template-b.html` | 学生课程页面 | ✅ 已修改 |
| `timeline-admin.html` | 教师管理后台 | ✅ 已修改 |
| `bct-review.html` | 复习系统 | ✅ 已修改 |
| `assets/js/loader.js` | 课程内容载入逻辑 | ✅ 已修改 |
| `assets/js/timeline-admin.js` | 管理后台逻辑 | ✅ 已修改 |
| `assets/js/bct-review.js` | 复习系统逻辑 | ✅ 已修改 |
| `assets/js/cohort-selector.js` | 班级选择器（新增） | ✅ 已新增 |
| `docs/USER_FLOW_GUIDE.md` | 本文档 | ✅ 已新增 |

---

**文档结束**

如有任何疑问或建议，请联系开发团队。



