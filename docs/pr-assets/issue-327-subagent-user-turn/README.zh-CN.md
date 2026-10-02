# 记忆子代理与要求用户查询的聊天模板：issue #327

[English](./README.md) | [验证数据](./verification.json)

Issue [#327](https://github.com/omdsh-dev/dsh-mnemon/issues/327) 反馈：通过 Ollama 0.33 运行本地模型、且聊天模板要求用户查询（例如 Qwen3.x）时，后台审查在第 4 次请求报 `500 no user query found in messages`，而此前它已经创建了项目档案。

基线：`main` `06182f4d`，即已发布的 dsh-mnemon 0.5.21。修复：`b0dc3c7ea684fcd17f2556482b9a3239e57af250`。验证于 2026-10-03（北京时间）：
- macOS 15.6 arm64 与 Node 24.19.0；
- 无头 Chrome 154，1280×800，zh-CN，浅色；
- DSH 0.1.7-rc.2（反馈中的版本）与 0.2.0-rc.2。

本机没有 Ollama 和 Qwen 模型，由本机回环的模型桩扮演服务端。DSH、Mnemon 和浏览器均为真实运行，未调用真实模型，记忆均为合成数据。

## 原因

- Mnemon 的记忆子代理（后台审查、记住等）只有一条用户消息，即委派给它的任务提示。之后每一步都会追加一次助手的工具调用及其结果。
- Ollama 0.33 渲染时保留系统提示，以及其余消息中能放进 `num_ctx` 的最长后缀，并且总会保留最后一条消息。工具结果填满窗口后，这段后缀就从任务提示之后开始。
- 要求用户查询的模板随即失败，Ollama 返回 500 `no user query found in messages`（[ollama/ollama#18303](https://github.com/ollama/ollama/issues/18303)）。截断时保留用户消息的修复 [ollama/ollama#18697](https://github.com/ollama/ollama/pull/18697) 尚未发布。
- 与 DSH 自己的上下文压缩无关：它会把压缩的区段替换为一条用户角色的摘要。

## 模拟方式

模型桩的行为与 Ollama 0.33 一致：
- 按上述规则截断，token 数按 JSON 长度除以 4 估算；
- 截断后没有用户文本消息时返回 500。

审查发出第 3 次请求时，窗口定为恰好容纳这次请求从任务提示开始的部分；再多一轮工具调用，第 4 次请求就会溢出，与反馈一致。只有模型的选择是脚本化的：检索项目档案、新建档案、再次检索、完成。

## 修复前（main）

![状态页：后台审查失败，memory subagent stopped with error: SERVER: no user query found in messages，并列出已提交的档案回执](./before-status.jpg)

两个宿主上：
- 第 1 至 3 次请求都保留了任务提示；
- 第 4 次请求只剩工具消息，服务端返回 500。DSH 重试了 5 次，结果相同；
- 状态页显示“后台审查失败”与 `memory subagent stopped with error: SERVER: no user query found in messages`，并列出已提交的 `mnemon_document_create · created` 回执，即反馈中“先写后死”的情形。

## 修复

每个委派子代理在 DSH 发布时都会挂上一个 `agent/pre-step` 处理器。从第 2 步起，某一步若没有用户文本，就以一条简短的 Mnemon 用户消息结尾：`Continue from the tool results above.`。服务端总会保留最后一条消息，因此无论截断多少，每次请求都带有用户查询。

带有任务提示的第 1 步不变，主会话也不变。已经带有用户文本的步骤（例如插话）不会再追加。

| 修复后：状态页 | 修复后：审查创建的档案 |
|---|---|
| ![状态页：系统正常，没有审查失败，1 份活跃档案](./after-status.jpg) | ![项目档案：Review checkpoint storage](./after-documents.jpg) |

两个宿主上，第 4 次请求仍因截断丢掉了任务提示，但它以续行消息结尾，一次即成功。状态页显示“系统正常”，没有审查失败，项目档案中出现了这份档案。所有运行都没有控制台错误。

## 逐次请求

进程内组合的结果，fork 与 spawn 两种审查相同：

| 请求 | main：最后一条消息 | main：用户查询 | 修复：最后一条消息 | 修复：用户查询 | 保留任务提示 |
|---|---|---|---|---|---|
| 1 | DSH 运行时上下文（user） | 有 | DSH 运行时上下文（user） | 有 | 是 |
| 2 | 工具结果 | 有 | 续行消息（user） | 有 | 是 |
| 3 | 工具结果 | 有 | 续行消息（user） | 有 | 是 |
| 4 | 工具结果 | **无：500** | 续行消息（user） | 有 | 否 |

两个宿主上的 WebUI 运行与此表一致。

## 自动检查

- `tests/review-user-turn-host.spec.ts` 在进程内运行真实的 DSH 0.1.7-rc.2 组合并接入上述模拟：agent 循环、fork 与 spawn provider，以及 Mnemon 的生命周期、协调器与工具。
  - main 上两种审查都以反馈中的错误失败，并留下部分写入回执。
  - 修复后两种审查都创建了档案，每次请求都带有用户查询，父会话没有任何续行消息。
- `tests/continuation-turn.spec.ts` 覆盖处理器本身：
  - 只给没有用户文本的续轮步骤追加；
  - 第 1 步、被拒绝或已中止的步骤、已带用户文本的步骤保持不变；
  - 只挂到自己这次启动、属于该父会话的子代理上，启动相互重叠时也能区分；
  - 启动失败或运行结束时释放已挂接的处理器。
- `tests/subagent.spec.ts`：委派的写入子代理同样挂上处理器。
- 修复版本上 `pnpm run verify` 通过：文档（2,979 个本地链接）、类型检查与确定性构建，全部 17 个插件的构建、类型检查与测试，根测试（115 个文件，1,567 通过，6 跳过），Headless 激活，包内容（解压后 1,501,839 字节，预算调整为 1,504,000），公开入口、publint 与 attw。

## 限制

- 服务端是依据 Ollama 0.33 已公开行为（ollama/ollama#18303 与 #18697）构建的模拟，并非真实的 Ollama 加 Qwen 模型。token 估算较粗，窗口在运行中确定，使溢出与反馈一样落在第 4 次请求。
- 截断仍会丢掉较早的上下文，包括任务提示。续行消息让每次请求保持有效；调大 Ollama 的上下文长度（`OLLAMA_CONTEXT_LENGTH` 或模型的 `num_ctx`）能让整个审查都留在窗口内。
- 主会话由 DSH 负责，本次不变；反馈中主会话没有失败。
