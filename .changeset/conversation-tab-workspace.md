---
"dsh-mnemon": patch
---

The Memory System in a conversation tab no longer fails when DSH has not loaded that conversation's Agent. Mnemon found a conversation's workspace only through its loaded Agent, so a conversation DSH showed but had not resumed failed in two places:
- Status read "Waiting for workspace";
- Project Documents failed with `memory Source is unavailable in the requested management scope`.

One way to get there is a conversation whose Agent preset is no longer in the profile. The Host now finds the conversation's workspace in DSH's workspace registry, which lists every session whether or not its Agent is loaded. Writes from the Memory System, such as a new Project Document or Remember, go straight to the Source when the conversation's Agent is not loaded. They used to fail with "current DSH agent is not live", and the sidebar Memory System had the same failure.

会话标签页中的记忆系统不再因为 DSH 尚未加载该会话的 Agent 而出错。此前 Mnemon 只能通过已加载的 Agent 找到会话所属的工作区，因此 DSH 已显示但尚未恢复的会话在两处出错：
- 状态页显示“等待工作区”；
- 项目档案报 `memory Source is unavailable in the requested management scope`。

例如会话所用的 Agent 预设已不在当前 profile 中，就会出现这种情况。现在 Host 通过 DSH 的工作区注册表找到会话所属的工作区，无论其 Agent 是否已加载，注册表都列有该会话。会话的 Agent 未加载时，在记忆系统中进行的写入（如新建项目档案或存入记忆）直接写入 Source。此前它们会报“current DSH agent is not live”，侧边栏中的记忆系统也有同样的问题。
