---
"dsh-mnemon": patch
---

Idle review no longer copies project records into hot memory (#319). Its instructions matched the routing guidance only in part: they sent stable project facts and decisions to MEMORY.md, so one review pass could write the same knowledge to a Document and to working memory, and repository details filled MEMORY.md, which every turn loads. Review now considers a Document first; MEMORY.md takes only a compact rule the user stated that no Document or entry already covers, and never a project record. The review guard holds each pass to one layer: after a Document, working-memory changes are refused, and after a working-memory change, a Document is refused, while USER.md changes stay independent. A new **Write runtime memory** switch under Idle review on the Layered strategy's page (`idleReview.runtimeMemory`, on by default) lets review create Documents only. The docs now state that review never writes Memory Spaces directly; its output reaches them through capacity and cold archiving.

空闲审查不再把项目记录复制进热记忆（#319）。此前它的指令与路由提示只部分一致：稳定的项目事实和决定会写入 MEMORY.md，因此同一轮审查可能把同一份知识同时写成项目档案和工作记忆，仓库细节也会占满每轮都加载的 MEMORY.md。现在审查先考虑项目档案；MEMORY.md 只收用户明确说过、且项目档案和已有条目都未涵盖的简短规则，从不收项目记录。审查 guard 让每轮只写一层：建了项目档案后，修改工作记忆会被拒绝；修改工作记忆后，新建项目档案会被拒绝；USER.md 的修改不受影响。分层策略页面的空闲审查中新增**写入运行时记忆**开关（`idleReview.runtimeMemory`，默认开启），关闭后审查只创建项目档案。文档也写明了审查从不直接写入记忆空间，其产出通过容量整理与冷归档进入记忆空间。
