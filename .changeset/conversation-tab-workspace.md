---
"dsh-mnemon": patch
---

The Memory System in a conversation tab now works when DSH has not loaded that conversation's Agent. Mnemon found a conversation's workspace only through its loaded Agent, so for a conversation DSH showed but had not resumed:
- Status read "Waiting for workspace", and Project Documents failed with `memory Source is unavailable in the requested management scope`;
- with workspace or centralized storage, Runtime memory and Memory Spaces in that tab used the directory DSH was started from, not the conversation's workspace. Entries saved that way stay in that directory.

One way to get there is a conversation whose Agent preset is no longer in the profile. The Host now finds the conversation's workspace in DSH's workspace registry, which lists every session whether or not its Agent is loaded. In that state a new Project Document is written directly. When Documents are full, a task Agent in the conversation's workspace archives the least recently used one first, as the conversation's Agent would, and a task Agent also chooses a new Memory Space's Provider. Both used to fail with "current DSH agent is not live".

会话标签页中的记忆系统现在在 DSH 尚未加载该会话的 Agent 时也能正常使用。此前 Mnemon 只能通过已加载的 Agent 找到会话所属的工作区，因此对于 DSH 已显示但尚未恢复的会话：
- 状态页显示“等待工作区”，项目档案报 `memory Source is unavailable in the requested management scope`；
- 使用工作区或集中存储时，该标签页中的运行时记忆和记忆空间用的是 DSH 启动时所在的目录，而不是会话所属的工作区。这样保存的条目仍留在那个目录中。

例如会话所用的 Agent 预设已不在当前 profile 中，就会出现这种情况。现在 Host 通过 DSH 的工作区注册表找到会话所属的工作区，无论其 Agent 是否已加载，注册表都列有该会话。在这种状态下，新建项目档案会直接写入；项目档案已满时，会由会话所属工作区中的任务 Agent 先归档最久未用的档案，与会话的 Agent 做法相同；新建记忆空间时也由任务 Agent 选择 Provider。这两项此前都会报“current DSH agent is not live”。
