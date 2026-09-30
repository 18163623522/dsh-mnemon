---
"dsh-mnemon-source-memory-spaces": patch
"dsh-mnemon-provider-mnemon-native": patch
---

Runtime memory keeps archiving into Mnemon Native when a Memory Space is large (#320). Mnemon Native reads a whole Memory Space in three places: its contents list, its graph, and the exact-content check that runs before runtime memory archives entries at capacity. Every Mnemon command was capped at 2 MiB of output, while a Store of about 1,000 insights already returns 3–9 MB, so these reads were stopped and hot memory could no longer make room. Those whole-Store reads now accept up to 128 MiB; every other command keeps the 2 MiB cap. Memory Spaces passes a per-call cap to the process (`maxOutputBytes` in the Provider SDK's Native runner options), and a failed call names its cause: only a failed launch suggests installing Mnemon, while a timeout, a cancellation or an oversized output says so.

记忆空间较大时，运行时记忆也能继续归档到 Mnemon Native（#320）。Mnemon Native 在三处读取整个记忆空间：内容列表、图谱，以及运行时记忆满容量归档前的逐字比对。此前每条 Mnemon 命令的输出上限都是 2 MiB，而约 1,000 条记忆的 Store 已经会返回 3–9 MB，这些读取因此被中断，热记忆也就无法腾出空间。现在这几次整库读取的上限为 128 MiB，其余命令仍为 2 MiB。记忆空间会把单次调用的上限传给进程（Provider SDK 中 Native runner 选项的 `maxOutputBytes`），调用失败时也会写明原因：只有启动失败才提示安装 Mnemon，超时、取消或输出超限会各自说明。
