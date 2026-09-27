---
"dsh-mnemon-source-memory-spaces": patch
---

Memory Spaces treat Mnemon Native as one Provider among peers. A space created without a named Provider, and a persistence strategy with no saved Provider, use the first ready Provider: Native while its CLI is installed, otherwise another enabled Provider. Native reports whether its CLI is found, the create and strategy dialogs start from a ready Provider and explain what Native needs, and a failing CLI no longer hides the other Providers' stats. A saved Provider choice is unchanged.

记忆空间把 Mnemon Native 视为众多 Provider 之一。创建时未指定 Provider 的空间，以及尚未保存 Provider 的沉淀策略，都使用第一个已就绪的 Provider：安装 CLI 时为 Native，否则为其他已启用的 Provider。Native 如实报告是否找到 CLI，创建与沉淀策略对话框从已就绪的 Provider 开始并说明 Native 需要什么，CLI 出错也不再隐藏其他 Provider 的统计。已保存的 Provider 选择保持不变。
