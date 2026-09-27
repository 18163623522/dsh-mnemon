---
"dsh-mnemon": patch
"dsh-mnemon-source-memory-spaces": patch
---

The Mnemon configuration moves from Settings → Memory System to the `dsh-mnemon` page under Plugins, where DSH 0.1.7 edits a plugin's own configuration; Settings keeps DSH's own sections and the read-only plugin inventory. Between the plugin's description and its components, the page shows Memory composition, Memory providers, Storage, Background tasks and Interface, a floating bar while changes are unsaved, and a read-only notice above the controls when the deployment cannot save. The page header offers Open Memory System, and the Memory System header offers Configure while the Plugins page is available. Loopback pages follow DSH's settings revision of the `mnemon` entry, so a save from another page or a profile reload appears without reloading the browser; remote pages keep the existing `remoteAccess` rules. Memory Spaces copy and Provider errors name the plugin page. Configuration keys, stored values and data are unchanged.

Mnemon 的配置从“设置 → 记忆系统”移到“插件”中的 `dsh-mnemon` 页面（可组合记忆），与 DSH 0.1.7 在插件自己的页面编辑其配置的方式一致；“设置”只保留 DSH 自身的分组与只读的插件清单。该页面在插件说明与组件列表之间依次显示记忆组合、记忆 Provider、存储、后台任务与界面；有未保存的修改时底部浮现保存栏；部署不允许保存时，只读提示显示在控件上方。页首提供“打开记忆系统”，“插件”页可用时记忆系统顶部提供“配置”。回环页面会跟随 DSH 中 `mnemon` 条目的设置 revision，在其他页面保存或 profile 重新加载后无需刷新浏览器即可看到新值；远程页面沿用现有的 `remoteAccess` 规则。记忆空间的文案与 Provider 错误改为指向插件页。配置键、已保存的值与数据不变。
