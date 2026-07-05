---
name: lworkspace-xhs-maker
description: 小红书图文视觉生产工具包。用户提供定稿内容，AI 完成封面生成 + 内容页排版 + 切图导出。触发词：出图、排版、做图、小红书图文、切片、图文制作、做封面。
version: 1.0.0
---

# XHS Visual Pipeline

## 触发后第一步：环境检查

### 依赖检查

检查 `node_modules/puppeteer-core` 是否存在：
- **不存在** → 告知用户「首次运行需要安装依赖，请稍等」，执行 `npm install puppeteer-core`，完成后继续
- **已存在** → 跳过

### 品牌配置检查

读取 `config/brand.css`，判断是否已有用户配置（`:root` 块内有非注释的变量值）。

#### 未配置：可视化引导初始化

**第一步：生成预设预览页**

将工具包根目录下的 `preset-preview.html` 的完整 `file://` 路径告知用户，引导他在浏览器中打开查看 6 种配色方案，例如：

> 请在浏览器打开以下链接查看配色预设，选好后告诉我编号或名称：
> `file:///[工具包实际路径]/preset-preview.html`
>（路径根据实际工具包位置调整）

**第二步：等待用户选择**

用户选定后：

- **选择预设（①–⑥ 或名称）**：
  1. 将 `presets/[预设名].css` 用绝对路径写入 `base.html`、`cover.html` 的第二行 `<link>`，替换原来的主题引用
  2. 清空 `config/brand.css` 的 `:root` 块（保留注释）
  3. 继续第三步

- **选择自定义**：
  1. 询问两个值：背景色（色号或描述）、主强调色（色号或描述）
  2. 将两个值写入 `config/brand.css`：
     ```css
     :root {
       --bg: [背景色];
       --accent: [强调色];
     }
     ```
  3. `base.html` 和 `cover.html` 的主题引用保持 `presets/warm-copper.css`（作为其余变量的基础）
  4. 继续第三步

**第三步：生成组件库参考文件**

基于 `visual-library.html` 模板，将第二行 CSS 引用更新为与 `base.html` 相同的路径，保存文件。

然后告知用户两个文件的用途：

> 配置完成。两个参考文件供你后续使用：
> - 配色预览：`file:///[工具包路径]/preset-preview.html`（选色时参考）
> - 组件库：`file:///[工具包路径]/visual-library.html`（查看所有组件的实际效果，改 brand.css 后刷新即可看到变化）

### 已配置：直接进入内容流程

---

## 内容流程

### Step 1：接收内容

用户提供定稿文字（markdown 或纯文字均可）。不需要用户指定布局，AI 自行判断。

### Step 2：内容类型判断

| 类型 | 判断特征 |
|------|---------|
| 知识解析 | 解释概念、拆解原理、有明确知识点或步骤 |
| 工具评测 | 涉及具体产品/工具，有对比、优缺点或推荐 |
| 经验分享 | 第一人称叙述，有具体经历和结论 |
| 观点表达 | 有明确立场，论点驱动，有反差或张力 |

### Step 3：读取组件库

读取 `templates/components.html`，了解可用组件的 HTML 片段和 class 名称。

按内容类型选择组件组合（使用 components.html 中实际存在的组件）：

| 内容类型 | 推荐组件组合 |
|---------|-------------|
| 知识解析 | section + steps 或 card × N + highlight block + conclusion bar |
| 工具评测 | section + card × N + compare grid + verdict（conclusion bar） |
| 经验分享 | section + narrative（用 card）+ pitfall + note card |
| 观点表达 | section + highlight block × 2-3 + note card + conclusion bar |

组件选择原则：
- 一张切片（1440px 高度）内放 2-4 个组件，不要过度填充
- 重点信息用 highlight block 或 conclusion bar 强调
- 不自行创建 components.html 中不存在的新组件

### Step 4：封面生成

从用户内容中提炼以下三个元素：

- **引导语**：一句话交代场景/背景，≤16字，不用标点结尾
- **主标题第一行**：核心主题，4-8字
- **主标题第二行**：补充或延伸，4-8字（标题总字数 ≤16字时可为空）
- **副标题**：进一步说明，≤20字

操作步骤：
1. 复制 `templates/cover.html` → `[工作目录]/cover.html`
2. **修复 CSS 引入路径**：模板中写的是相对路径 `../templates/tokens.css` 等，复制后需替换为绝对路径，指向本工具包的实际位置。找到以下三行：
   ```html
   <link rel="stylesheet" href="../templates/tokens.css">
   <link rel="stylesheet" href="../presets/warm-copper.css">
   <link rel="stylesheet" href="../config/brand.css">
   ```
   将 `../` 替换为 `[工具包根目录]/`，例如：
   ```html
   <link rel="stylesheet" href="/path/to/lworkspace-xhs-maker/templates/tokens.css">
   <link rel="stylesheet" href="/path/to/lworkspace-xhs-maker/presets/warm-copper.css">
   <link rel="stylesheet" href="/path/to/lworkspace-xhs-maker/config/brand.css">
   ```
   （用实际的文件系统绝对路径，不是相对路径）
3. 替换占位符：
   - `<!-- GUIDE_TEXT -->` → 引导语文字
   - `<!-- MAIN_TITLE_LINE1 -->` → 主标题第一行
   - `<!-- MAIN_TITLE_LINE2 -->` → 主标题第二行（空则保留空，模板会自动隐藏）
   - `<!-- SUBTITLE -->` → 副标题文字
4. 运行导出：
   ```bash
   node [脚本路径]/export-cover.js [工作目录]/cover.html [工作目录]/产出/封面.png
   ```

### Step 5：内容页制作

1. 复制 `templates/base.html` → `[工作目录]/demo.html`
2. **修复 CSS 引入路径**（同 Step 4 第 2 步）：将三行 `<link>` 的 `../` 替换为工具包根目录的绝对路径
3. 将选定的组件 HTML 片段填入 `<body>` 内容区
4. 将用户定稿文字填入对应组件，严格使用用户原文，不改写
5. 运行切图导出：
   ```bash
   node [脚本路径]/export-slice.js [工作目录]/demo.html [工作目录]/产出 1440
   ```

### Step 6：交付

向用户展示以下文件路径（只展示图片，不展