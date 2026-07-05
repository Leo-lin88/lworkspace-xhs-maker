# lworkspace-xhs-maker

小红书、抖音内容创作，图文内容生产工具包 · 适用于 Claude、Codex类Agent工具

你产出内容脚本后，Ai自动排版、分页切图、封面制作、图文导出。

---

## 前置要求

- Node.js 18+ （本地缺失时，Ai会引导下载安装）
- Chrome 或 Chromium 浏览器（已安装即可，脚本自动检测路径）
- Claude、Codex类 Agent工具（用于运行 SKILL.md）

## 安装

```bash
git clone https://github.com/Leo-lin88/lworkspace-xhs-maker.git
cd lworkspace-xhs-maker
npm install puppeteer-core
```

## 快速开始

1. 将工具包目录告知 Claude，或将 SKILL.md 添加到你的 Claude 项目
2. 把你写好的内容文字发给 Claude，说"帮我制作图文"
3. 首次运行会引导你配置品牌色，约 1 分钟完成
4. AI 自动完成排版 + 封面 + 切图，交付图片文件

## 输出规格

- 封面：1080 × 1440 px（PNG）
- 内容切片：1080 × 1440 px（PNG）× N 张

## 视觉与主题
6 套预设配色，一键切换整套视觉风格，支持自定义
26类视觉组件（卡片、步骤、高亮块、金句、对话气泡等）

## 个性化配置

编辑 `config/brand.css`，覆盖任意设计 token：

```css
:root {
  --bg: #FAF8F5;      /* 背景色 */
  --accent: #C8673A;  /* 主强调色 */
}
```

完整 token 列表见 `templates/tokens.css`。

## 目录说明

```
lworkspace-xhs-maker/
├── SKILL.md           AI 工作流指令
├── config/brand.css   用户品牌配置（首次运行后自动生成）
├── presets/           6 套配色预设（warm-copper / clean-minimal / ocean-blue / forest-green / editorial-red / ink-purple）
├── templates/         HTML 模板 + 组件库 + 设计 token
└──
