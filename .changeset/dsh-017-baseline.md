---
"dsh-mnemon": patch
---

Support DSH 0.1.7-rc.2 only and follow its official contracts. The pinned development host and both DSH peer ranges move to 0.1.7-rc.2; stay on v0.5.16 with an older DSH. The lifecycle now reads the session start source from `agent/created` (DSH recreates the Agent for clear, resume and compaction), reads the model-visible Session surface directly, registers routing guidance through `inject(['systemPrompt'])`, and always writes settings through the DSH profile settings forms. Compatibility shims for DSH hosts older than 0.1.7, unused scripts and dead client code are removed; memory data, settings and the UI are unchanged apart from Agent Teams hints naming 0.1.7-rc.2 and a clipboard fallback for version commands.

仅支持 DSH 0.1.7-rc.2，并改用其官方契约。锁定的开发宿主与两个 DSH peer 范围均升至 0.1.7-rc.2；更早的 DSH 请继续使用 v0.5.16。生命周期改为从 `agent/created` 读取会话启动来源（清空、恢复与压缩时 DSH 会重建 Agent），直接读取模型可见的 Session surface，通过 `inject(['systemPrompt'])` 注册路由引导，设置一律经 DSH profile 设置表单写入。移除面向 0.1.7 之前宿主的兼容代码、无用脚本与客户端死代码；记忆数据、设置与界面保持不变，仅 Agent Teams 提示改为 0.1.7-rc.2，版本命令复制增加剪贴板回退。
