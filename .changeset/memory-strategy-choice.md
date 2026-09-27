---
"dsh-mnemon": patch
---

Choose the main memory Strategy and the memory enhancements on the `dsh-mnemon` page under Plugins. The Starter now includes the general main Strategy, off until chosen, which offers every available Source and lets the model decide how to use each one. Core defines the selection, projection and capture slots as standard View extension slots: `defineMemoryViewExtension`, `validateMemoryViewExtension` and `memoryViewExtensionValues` in `dsh-mnemon/extension-sdk` let an extension follow any main Strategy that accepts its slot, and a second owner of a slot is rejected at registration. Where DSH's plugin manager is available, memory plugin enablement is kept in the DSH profile patch, so DSH's component switches and Mnemon's controls always agree; previously saved choices move there once. If the selected main Strategy is switched off while exactly one other is installed, the Host composes with that one and reports a diagnostic.

在“插件”中的 `dsh-mnemon` 页面选择主策略与记忆增强。Starter 新增通用主策略（默认关闭，选择后启用）：它提供全部可用 Source，由模型决定如何使用每一个。Core 将 selection、projection、capture 定义为标准 View 扩展槽：`dsh-mnemon/extension-sdk` 新增 `defineMemoryViewExtension`、`validateMemoryViewExtension` 与 `memoryViewExtensionValues`，扩展可以跟随任何接受该槽的主策略；同一槽的第二个所有者会在注册时被拒绝。DSH 插件管理器可用时，记忆插件的启用状态保存在 DSH profile patch 中，DSH 组件开关与 Mnemon 控件始终一致；此前保存的选择会一次性迁移过去。所选主策略被停用且恰好只剩另一个主策略时，Host 改用那一个并报告诊断。
