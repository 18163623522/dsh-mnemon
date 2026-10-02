---
"dsh-mnemon": patch
---

Idle review and the other memory subagents no longer fail with `no user query found in messages` on a local model whose chat template requires a user query, such as Qwen3.x on Ollama 0.33. A subagent's only user turn was its prompt. Once tool results filled the model's context window, Ollama's truncation dropped that prompt but kept the tool results after it, so the next request failed, sometimes after the review had already created a Document. When a server refuses a subagent request this way, Mnemon now adds a short user turn to that step and retries it at once; later tool continuations of that subagent end the same way. Subagents on servers that never refuse, and the main conversation, send exactly what they did before.

在 Ollama 0.33 上的 Qwen3.x 等要求用户查询的聊天模板下，后台审查和其他记忆子代理不再报 `no user query found in messages`。此前子代理唯一的用户消息是它的任务提示；工具结果填满模型的上下文窗口后，Ollama 截断时会丢掉这条提示、保留其后的工具结果，下一次请求随即失败，有时审查已经创建了项目档案。现在服务端以这种方式拒绝子代理的请求时，Mnemon 会在这一步追加一条简短的用户消息并立即重试；该子代理之后的工具续轮也以同样的消息结尾。从不拒绝的服务端上的子代理和主会话，发出的请求与之前完全相同。
