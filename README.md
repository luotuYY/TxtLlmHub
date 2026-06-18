# TxtLlmHub

本地 LLM + 商业 API 双模文本工具，支持 **翻译/润色** 和 **分词/标签分类** 两大功能。上传 `原文=旧译文` 格式的 txt 文件，逐行处理，预览、对比、导出一站完成。

## 功能概览

| 模块 | 说明 |
|---|---|
| **翻译** | 直译 / 润色双模式，支持单行、全量、勾选批量翻译，并发可调 1–10 |
| **分词** | LLM 自动分类（硬术语 / 硬生动），拖拽调整分类，按类目导出 |
| **本地/商业双模** | 工具栏一键切换，默认本地 LLM |
| **文件管理** | 拖拽上传、多文件管理、勾选显示/隐藏、拖拽排序 |
| **导出** | 单文件 / 分别导出 / 合并导出，优先导出勾选行 |

## 项目结构

```
TxtLlmHub/
├── app.py                  # Flask 后端（API 路由 + LLM 调用）
├── requirements.txt        # Python 依赖：flask + requests
├── start.bat               # Windows 一键启动
├── static/
│   ├── index.html          # 翻译页面
│   ├── tag.html            # 分词页面（完全独立）
│   ├── uta.jpg             # 背景图片
│   ├── css/
│   │   ├── style.css       # 全局样式
│   │   └── tag.css         # 分词页专属样式
│   └── js/
│       ├── utils.js        # 工具函数（DOM、高亮、toast）
│       ├── state.js        # 翻译页状态管理 + 提示词模板
│       ├── api.js          # 翻译页 API 调用 + 文件管理
│       ├── render.js       # 翻译页 DOM 渲染
│       ├── app.js          # 翻译页事件处理 + 网格拖拽
│       ├── tag.js          # 分词页完整逻辑（独立模块）
│       └── particles.js    # 粒子特效
└── README.md
```

## 架构

```
┌─────────────────────┐    ┌─────────────────────┐
│   翻译页 index.html  │    │   分词页 tag.html    │
│   style.css          │    │   style.css          │
│   state/api/render/  │    │   tag.css            │
│   app.js             │    │   tag.js (独立)       │
└──────────┬──────────┘    └──────────┬──────────┘
           │ <a href> 浏览器跳转       │
           └──────────┬───────────────┘
                      │ HTTP
┌─────────────────────▼─────────────────────┐
│                  app.py                    │
│  /api/upload  /api/manual-input            │
│  /api/translate  /api/translate-polish      │
│  /api/tag  /api/translate-batch(…-polish)  │
│  /api/check-llm  /api/config               │
│  ThreadPoolExecutor · requests.Session     │
└─────────────────────┬─────────────────────┘
                      │
               ┌──────▼──────┐
               │   LLM API   │
               │ /v1/chat/   │
               │ completions  │
               └─────────────┘
```

**两个页面完全独立**：翻译页和分词页各自加载独立的 JS/CSS，通过 `<a>` 标签跳转，不共享 DOM 或状态。

## 翻译功能

| 功能 | 说明 |
|---|---|
| 直译 / 润色 | 两模式独立参数和 Prompt，一键切换 |
| 润色两步流程 | 直译底稿（带 `[UI]`/`[DIALOGUE]` 标签）→ 对比糅合（UI 铁律 / 对白重写） |
| 预览栏 | 行数可调（2000/5000/全部/自定），悬停「译」按钮单行翻译 |
| 勾选翻译 | 复选框 + 全选，勾选后批量并发翻译 |
| 翻译对比 | 原文 / 旧译文 / 新译文三列对照，点击编辑新译文 |
| 行内操作 | 保留译文 / 重译 / 复制，工具栏批量操作 |
| System Prompt | 预设模板 + 自定义保存，直译/润色各自独立 |
| 卡片拉伸 | 四格交叉处拖拽调整布局，双击重置 |
| 参数持久化 | 所有参数变更自动保存到 localStorage |

## 分词功能

| 功能 | 说明 |
|---|---|
| 分类体系 | 一级：硬术语（🔧）、硬生动（🎭）；二级：UI文本、对话/台词等 15 个子类 |
| LLM 自动分类 | 低温度 JSON 输出，自动匹配一级+二级类目 |
| 手动修改 | 点击卡片 ✏️ 按钮，搜索选择类目 |
| 拖拽操作 | 同栏拖拽排序，跨栏拖拽改变分类 |
| 折叠面板 | 工具栏居中按钮，收起/展开输入和预览区域 |
| 预览限行 | 和翻译页一致的行数限制（2000/5000/全部/自定） |
| 导出 | 合并导出（按类目分组）或按类目分别导出 |

### 分类预设

| 一级类目 | 二级类目 |
|---|---|
| **硬术语** 🔧 | UI文本、菜单/按钮、属性/状态、物品/装备、技能/招式、系统提示、Mod/插件、代码标识符 |
| **硬生动** 🎭 | 对话/台词、旁白/叙述、情感/语气、俚语/口语、描述/刻画、幽默/讽刺、严肃/正式 |

## 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动（确保 LLM 服务已运行）
python app.py

# 3. 浏览器打开
# 翻译页：http://127.0.0.1:5000
# 分词页：http://127.0.0.1:5000/tag
```

Windows 用户双击 `start.bat` 一键启动。

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `LLM_API_URL` | `http://127.0.0.1:8080/v1/chat/completions` | LLM 服务地址 |
| `LLM_MODEL` | `local-model` | 模型名称 |
| `LLM_API_KEY` | _(空)_ | API Key |

### 商业 API 示例

| 服务商 | API Base URL | 模型名 |
|---|---|---|
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | `deepseek-chat` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `qwen-plus` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | `glm-4-flash` |

## 支持的 LLM 部署

任何提供 `/v1/chat/completions` 端点的服务均可对接：llama.cpp、Ollama、vLLM、LocalAI 等。

## API 端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/` | GET | 翻译页面 |
| `/tag` | GET | 分词页面 |
| `/api/upload` | POST | 上传 txt 文件 |
| `/api/manual-input` | POST | 手动输入解析 |
| `/api/translate` | POST | 直译单条 |
| `/api/translate-polish` | POST | 润色单条 |
| `/api/tag` | POST | 分词单条（不追加翻译隐式规则） |
| `/api/translate-batch` | POST | 批量直译（NDJSON 流式） |
| `/api/translate-batch-polish` | POST | 批量润色（NDJSON 流式） |
| `/api/check-llm` | GET/POST | 检测 LLM 连通性 |
| `/api/config` | GET | 返回当前配置 |

## 文件格式

输入 txt 每行一条，`=` 左侧为原文，右侧为旧译文：

```
Clothes overlays=衣服贴图
ON=打开
OFF=关闭
```

- 无 `=` 的行视为纯原文
- 空行自动跳过
- 优先 UTF-8，失败回退 GBK

## 技术栈

- **前端**：原生 JavaScript，零构建工具，零依赖
- **后端**：Flask，ThreadPoolExecutor 并发，requests.Session 连接复用
- **UI**：玻璃卡片风格（backdrop-filter），粒子特效，可拖拽网格布局

## 提速建议

| 措施 | 效果 |
|---|---|
| 使用非推理模型 | `deepseek-chat` 比 `deepseek-reasoner` 快数倍 |
| 关闭思考推理 | 商业 API 面板取消勾选「启用思考」 |
| 降低 max_tokens | 512 → 256 对短文本足够 |
| 提高并发数 | 5 → 8–10（取决于 LLM 服务能力） |
