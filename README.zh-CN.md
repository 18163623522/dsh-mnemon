<h1 align="center">dsh-mnemon</h1>

<p align="center"><a href="https://github.com/omdsh-dev/dsh-mnemon/blob/main/README.md">English</a> · <strong>简体中文</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-mnemon"><img alt="npm 版本" src="https://img.shields.io/npm/v/dsh-mnemon?label=npm" /></a>
  <a href="https://www.npmjs.com/package/dsh-mnemon"><img alt="npm 累计下载量" src="https://img.shields.io/npm/dt/dsh-mnemon?label=%E7%B4%AF%E8%AE%A1%E4%B8%8B%E8%BD%BD" /></a>
  <a href="https://github.com/omdsh-dev/dsh-mnemon/releases/latest"><img alt="GitHub 发布版本" src="https://img.shields.io/github/v/release/omdsh-dev/dsh-mnemon" /></a>
  <a href="https://github.com/omdsh-dev/dsh-mnemon"><img alt="GitHub 收藏数" src="https://img.shields.io/github/stars/omdsh-dev/dsh-mnemon?label=stars" /></a>
  <a href="https://github.com/omdsh-dev/dsh-mnemon/blob/main/LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <a href="https://dshfind.com/zh/plugins/omdsh-dev/dsh-mnemon?ref=badge"><img alt="dshfind" src="https://dshfind.com/api/badge/omdsh-dev/dsh-mnemon?lang=zh" /></a>
  <a href="https://dshfind.com/zh/plugins/omdsh-dev/dsh-mnemon?ref=badge"><img alt="dshfind 下载量" src="https://dshfind.com/api/badge/omdsh-dev/dsh-mnemon?metric=downloads&amp;lang=zh" /></a>
</p>


<p align="center"><strong>面向 DeepSeek Harness 的可组合视图记忆。</strong></p>
<p align="center">记忆来源与策略可插拔，开箱即用提供分层记忆。</p>

<p align="center">
  <a href="https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/assets/webui-v0.5.17/README.md">
    <img src="https://raw.githubusercontent.com/omdsh-dev/dsh-mnemon/main/docs/assets/webui-v0.5.17/zh-CN/demo.gif" alt="一次提问同时用到工作记忆、记忆空间和项目档案，回合记忆栏列出所用工具；随后查看记忆空间图谱与主策略选择器" width="960" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/guides/getting-started.md"><strong>快速开始</strong></a> ·
  <a href="https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/assets/webui-v0.5.17/zh-CN/demo.mp4">观看演示</a> ·
  <a href="https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/README.md">文档中心</a> ·
  <a href="https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/development/extensions.md">制作插件</a>
</p>

## 为什么需要 dsh-mnemon

每次会话都从零开始的 Agent，会反复询问你早已说过的事情；把所有内容塞进同一个记忆库也不行，要么每轮都被淹没，要么漏掉真正要紧的信息。dsh-mnemon 为 DeepSeek Harness 提供分层、可见、可组合的记忆。

- **每一轮都拿到合适的记忆。** 偏好和工作中的事实常驻上下文；项目档案与长期证据只在问题需要时才检索。
- **看得见这一轮用了什么。** 每条回复下方的回合记忆栏列出背后的检索、召回与写入；记忆系统展示全部已保存的内容，并可直接编辑。
- **在插件页组合。** 选择一个主策略和若干可选增强，切换时无需迁移任何数据；每个组件都有自己的设置页。
- **数据放在你想放的地方。** 默认由 Mnemon Native 在本地保存，也可以接入八种第三方 Provider；存储范围可选全局、按工作区或集中存储，并支持 ZIP 备份。
- **可以扩展。** Source 与 Strategy 都是基于公开 SDK 的普通 DSH 插件；安装的组件与随附组件拥有同样的页面和开关。

## 看看实际效果

| 对话中的记忆 | 记忆系统 |
|---|---|
| [![一条回答引用了工作记忆、记忆空间和项目档案，回合记忆栏已展开](https://raw.githubusercontent.com/omdsh-dev/dsh-mnemon/main/docs/assets/webui-v0.5.17/zh-CN/chat-recall.jpg)](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/guides/ui-guide.md#在对话中) | [![选中一个实体的记忆空间图谱](https://raw.githubusercontent.com/omdsh-dev/dsh-mnemon/main/docs/assets/webui-v0.5.17/zh-CN/memory-graph.jpg)](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/guides/ui-guide.md#记忆空间) |
| 一条回答同时用到三类记忆，回合记忆栏写明所用的工具。 | 运行时记忆、项目档案与记忆空间集中呈现，图谱按记忆提到的实体把它们连接起来。 |
| **在插件页组合** | **长期记忆的 Provider** |
| [![可组合记忆插件页中的记忆组合面板](https://raw.githubusercontent.com/omdsh-dev/dsh-mnemon/main/docs/assets/webui-v0.5.17/zh-CN/plugin-composition.jpg)](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/guides/ui-guide.md#在插件页中) | [![记忆空间页面列出 Mnemon Native 与八种第三方 Provider](https://raw.githubusercontent.com/omdsh-dev/dsh-mnemon/main/docs/assets/webui-v0.5.17/zh-CN/plugin-spaces.jpg)](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/guides/memory-providers.md) |
| 一个主策略、它的记忆来源与可选增强，每一项的开关都即时生效。 | Mnemon Native 在本地运行；其他 Provider 启用后连接各自的服务。 |

更多画面见[界面指南](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/guides/ui-guide.md)与 [v0.5.17 图集](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/assets/webui-v0.5.17/README.md)。

## 三类记忆

| 记忆 | 适合保存 | 如何进入 Agent 上下文 |
|---|---|---|
| **运行时记忆** | 偏好、协作约定、下一轮就需要的事实 | 每轮以紧凑的 USER.md 与 MEMORY.md 注入 |
| **项目档案** | 设计、调查、流程与交接材料 | 先检索，相关时再阅读全文 |
| **记忆空间** | 长期事实、决策、实体及其关系 | 按需从已启用的 Provider 召回 |

默认的**分层策略**让运行时记忆常驻，另外两类按需读取；**通用策略**在同一份预算内提供全部可用来源，由模型决定如何使用。**记忆空间**是由 Provider 承载、可以独立命名和激活的长期证据范围，英文界面称 memory space。

## 快速开始

需要 DSH `0.1.7-rc.2` 宿主与 Node.js `^22.19.0 || >=24.0.0`。

```sh
dsh plugin --profile web add dsh-mnemon
dsh web
```

1. 在侧栏打开**记忆系统**，“状态”页列出每个记忆组件和 Provider。
2. 添加一条运行时记忆；创建项目档案前先选择 DSH 工作区。
3. 使用记忆空间时，可用 `npm install --global @mnemon-dev/mnemon` 安装 Mnemon Native 所需的 CLI，或在记忆空间页面启用其他 Provider。
4. 在**插件 → 可组合记忆**中选择主策略与增强。

Headless 使用同一个包：`dsh plugin --profile headless add dsh-mnemon`。更早的宿主请继续使用 `v0.5.16`。各平台步骤见[快速开始](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/guides/getting-started.md)，已有安装的升级见[兼容性与升级](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/reference/compatibility.md)。

## 工作原理

[![来源事实经策略组合与核心校验，形成交给 DSH 宿主的唯一上下文视图](https://raw.githubusercontent.com/omdsh-dev/dsh-mnemon/main/docs/assets/diagrams/zh-CN/composable-memory.png)](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/development/architecture.md)

- **Source（记忆来源）** 拥有记忆及其操作：运行时记忆、项目档案和记忆空间，Provider 是记忆空间的子模块。
- **Strategy（策略）** 决定可用的 Source 如何参与一轮对话：哪些常驻、哪些可以检索、使用哪些工具和预算。增强通过标准插槽为它补充能力。
- **Core（核心）** 把结果校验为本轮唯一的不可变 **View（上下文视图）**，DSH 宿主将它固定到这一轮并控制工具访问。

随附插件与外部仓库使用同一套公开契约。[架构](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/development/architecture.md)说明了归属关系、回合生命周期，以及组件可以贡献内容的界面区域。

## 官方插件

Starter 固定一组经过测试、各自独立版本的包。同一时间只运行一个主策略；增强在你打开之前保持关闭。

| 包 | 作用 | 默认 |
|---|---|---|
| [dsh-mnemon-source-runtime](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-source-runtime/README.md) | 运行时记忆：USER.md、MEMORY.md、修订与本地热存储 | 开启 |
| [dsh-mnemon-source-documents](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-source-documents/README.md) | 项目档案：Markdown、检索、修订与归档 | 开启 |
| [dsh-mnemon-source-memory-spaces](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-source-memory-spaces/README.md) | 记忆空间：长期证据及其 Provider | 开启 |
| [dsh-mnemon-strategy-default-three-tier](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-strategy-default-three-tier/README.md) | 分层策略：运行时记忆常驻，其余按需读取 | 选中 |
| [dsh-mnemon-strategy-general](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-strategy-general/README.md) | 通用策略：全部可用来源共享一份预算 | 关闭 |
| [dsh-mnemon-strategy-auto-capture](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-strategy-auto-capture/README.md) | 主动记录：在回合中提示保留有用的事实 | 关闭 |
| [dsh-mnemon-strategy-light-context](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-strategy-light-context/README.md) | 轻量上下文：为常驻内容设置共同上限 | 关闭 |
| [dsh-mnemon-strategy-scoped](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-strategy-scoped/README.md) | 范围组合：按顺序选择来源，并限定可写子集 | 关闭 |

记忆空间 Provider：[Mnemon Native](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-provider-mnemon-native/README.md)（默认，本地）· [OpenViking](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-provider-openviking/README.md) · [Honcho](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-provider-honcho/README.md) · [Mem0](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-provider-mem0/README.md) · [Hindsight](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-provider-hindsight/README.md) · [Holographic](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-provider-holographic/README.md) · [RetainDB](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-provider-retaindb/README.md) · [ByteRover](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-provider-byterover/README.md) · [Supermemory](https://github.com/omdsh-dev/dsh-mnemon/blob/main/plugins/dsh-mnemon-provider-supermemory/README.md)。第三方 Provider 在配置前保持关闭；图谱、删除与枚举能力因后端而异。详见 [Provider 指南](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/guides/memory-providers.md)。

## 自己动手扩展

用 `dsh-mnemon/extension-sdk` 定义 Source 或 Strategy，通过标准插槽编写增强，或用 `dsh-mnemon-source-memory-spaces/provider-sdk` 编写记忆空间驱动。组件还可以把自己的设置和状态卡片加入 dsh-mnemon 的页面。你的仓库自己负责清单、依赖、测试与构建；DSH 负责安装和挂载，是否把它选为主策略是另一个独立决定。

从[插件开发指南](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/development/extensions.md)开始。新能力与新 Provider 请先在 Issue 中讨论，再提交 PR，详见 [CONTRIBUTING](https://github.com/omdsh-dev/dsh-mnemon/blob/8466e3560a3b9de4e9f4b7302cbf005c84e8e69f/CONTRIBUTING.zh-CN.md)。

## 数据与信任

- 运行时记忆与项目档案是本地文件，Mnemon Native 也在本地；第三方 Provider 使用各自的服务与作用域。
- 关闭组件不会删除其中的记忆，更换存储位置也不会搬移数据；需要迁移时使用 ZIP 备份。
- 已保存的 Provider 凭据只留在宿主上，不会被导出；但备份仍包含私有记忆，请妥善保护。
- Source 与 Strategy 是受信任的进程内 JavaScript，**不是沙箱代码**；历史记忆永远不会凌驾于当前指令之上。

[备份与恢复](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/guides/operations.md) · [安全策略](https://github.com/omdsh-dev/dsh-mnemon/blob/8466e3560a3b9de4e9f4b7302cbf005c84e8e69f/SECURITY.md) · [版本历史](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/releases/README.md) · [路线图](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/roadmap.md)

## 开发与验证

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm verify:plugins
```

需要 Node.js `^22.19.0 || >=24.0.0` 与 pnpm。`node scripts/serve-e2e.mjs` 会启动一个用后即弃的真实 WebUI；加上 `--docs-demo` 即可得到这些截图背后的示例项目。机制测试不代表模型准确率，也不代表云端 Provider 的实际表现。详见[开发与验证](https://github.com/omdsh-dev/dsh-mnemon/blob/main/docs/zh-CN/development/README.md)。
