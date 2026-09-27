# 组件页与统一的交互规则

[English](./README.md)

实测实现：配置页为 `41fced12`，记忆系统为 `7fde5ecb`，叠加在记忆组合面板记录之上（[记录](../composition-board-20260927/README.zh-CN.md)）。macOS 15.6、Node 25.1.0、已发布的 DSH 0.1.7-rc.2、headless Chrome 1280 × 860（以及 420 × 900）。每次运行都从 Starter 默认配置与其测试模型的隔离 WebUI fixture 开始，未使用个人记忆或凭据。

## 配置页只保留不属于任何组件的内容

有自己设置的组件显示齿轮，点击打开它的页面；主策略的齿轮打开当前主策略。“存储”列出数据保存在其目录中的组件，并显示当前所在位置。“界面”的选择立即生效。

| 面板 | 存储与界面 |
|---|---|
| ![带齿轮的面板](./pages-board.png) | ![存储与界面](./pages-storage-interface.png) |

改动存储位置需要点击其“应用”，应用行说明后果：

![存储的应用行](./pages-storage-apply.png)

## 设置位于各自组件的页面

| 运行时记忆：USER.md 的位置 | 记忆空间：Provider 与嵌入 |
|---|---|
| ![运行时记忆页](./pages-runtime.png) | ![记忆空间页](./pages-spaces.png) |

| 默认三层：后台任务 | 审查参数等待其“应用” |
|---|---|
| ![默认三层页](./pages-three-tier.png) | ![编辑中的审查参数](./pages-three-tier-limits.png) |

## 名称即入口

| 行内的关联标签 | 关联名称在原处打开，并可返回 |
|---|---|
| ![关联标签](./pages-chips.png) | ![从主动记录打开记忆空间](./pages-related.png) |

声明的选项改动后才出现“应用”：

![编辑中的轻量上下文选项](./pages-options-edit.png)

## 记忆系统使用组件声明的名称

标签页、页头的主策略，以及每个 Source 组件的状态卡片都使用组件声明的名称，与配置页一致；每张卡片显示其组件提供的内容。

| 浅色 | 深色 |
|---|---|
| ![状态页](./workspace-status.png) | ![状态页，深色](./dark-workspace-status.png) |

## 深色主题与窄列

| 面板 | 存储与界面 | 审查参数 |
|---|---|---|
| ![面板，深色](./dark-pages-board.png) | ![存储，深色](./dark-pages-storage-interface.png) | ![审查参数，深色](./dark-pages-three-tier-limits.png) |

| 面板，420 px | 存储应用行，420 px | 审查参数，420 px |
|---|---|---|
| ![面板，窄列](./narrow-pages-board.png) | ![存储，窄列](./narrow-pages-storage-apply.png) | ![审查参数，窄列](./narrow-pages-three-tier-limits.png) |

## 验证

- 单元测试覆盖设置区域（注册、释放、目录）、随附面板（运行时记忆的用户画像范围，记忆空间的托管开关与连接信息，默认三层的路由、审查选择与参数）、存储的应用与旧键清理、界面选择即时生效且写入被拒时回退并说明、面板上的齿轮、名称、关联标签与返回、声明选项的应用，以及弹窗的盒模型。
- 完整的 `pnpm run verify` 与 `pnpm run release:intent` 通过；包体积预算记录了实测增长。
- 单元测试还覆盖状态卡片区域与随附 Source 的卡片，以及标签页、卡片（包括已关闭的 Source 与未提供内容的 Source）和页头都按组件命名的工作台。
- WebUI：脚本化走查采集 11 个浅色、4 个深色与 3 个窄列状态，无控制台错误；同样的流程也在应用内浏览器中手动完成，包括向真实 Host 写入空闲审查选项，以及修复前捕获到的嵌套路径写入被拒。

## 限制

配置下方 DSH 自己的组件列表仍按包名命名各行；通过 `plugins.row.config` 让这些行打开相同的组件页留待后续。状态页中的 Provider 列表与存储区仍是 Host 自己的区块，而非组件贡献。
