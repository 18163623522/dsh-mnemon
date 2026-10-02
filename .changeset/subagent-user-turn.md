---
"dsh-mnemon": patch
---

Idle review and the other memory subagents no longer fail with `no user query found in messages` on a local model whose chat template requires a user query, such as Qwen3.x on Ollama 0.33. A subagent's only user turn was its prompt. Once tool results filled the model's context window, Ollama's truncation dropped that prompt but kept the tool results after it, so the next request failed, sometimes after the review had already created a Document. Each tool continuation of a Mnemon subagent now ends with a short user turn, which the server always keeps. The main conversation is unchanged.

在 Ollama 0.33 上的 Qwen3.x 等要求用户查询的聊天模板下，后台审查和其他记忆子代理不再报 `no user query found in messages`。此前子代理唯一的用户消息是它的任务提示；工具结果填满模型的上下文窗口后，Ollama 截断时会丢掉这条提示、保留其后的工具结果，下一次请求随即失败，有时审查已经创建了项目档案。现在 Mnemon 子代理的每一次工具续轮都以一条简短的用户消息结尾，服务端总会保留最后一条消息。主会话不受影响。
