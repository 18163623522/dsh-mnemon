---
"dsh-mnemon": patch
---

**Check versions → Update** now updates dsh-mnemon in the desktop app. The Host used to run pnpm from PATH in the owning Profile, and the desktop app's Host has none, so the dialog only reported that pnpm was missing. The update now goes through DSH's own plugin installer, as `dsh plugin add dsh-mnemon@<version>` does, whenever the Host runs in the Profile that owns dsh-mnemon:
- it uses the Profile's package manager, which in the desktop app is the app's bundled pnpm, with the Profile's registry settings, fallbacks and lock;
- it installs the exact checked version, so pnpm's 24-hour release window does not hold it back;
- DSH checks the DSH versions the new release supports before keeping it and restores the Profile's files when the install fails, and the dialog shows DSH's reason;
- the enabled plugins stay as they were, and success is reported only once DSH lists the new version.

An optional Strategy the Profile added on its own is a DSH bundle too and updates the same way from the subpackage list. Where DSH has neither the app's pnpm nor one on PATH, the dialog asks for pnpm and offers no update, and profiles without DSH's plugin installer keep the pnpm route.

DSH loads a plugin's new browser code as soon as its files change, which used to close the Memory System and the dialog before the update could report back. The dialog now records the update in the page's session, and the new page reopens Status with the dialog, which shows the update and the restart it needs; the Host waits briefly for an update that is still finishing before it answers. The restart notice also covers the desktop app: quit it completely and reopen it.

Until DSH restarts, a notice above every Memory System page names the installed version and the one that still runs, whether the update came from Check versions or `dsh plugin`; packages updated on their own are named too. Status now shows the running version rather than the installed one, and Check versions shows the installed one, so it no longer offers an update `dsh plugin` already installed. From 0.5.21 or earlier, the desktop app still needs one removal and reinstall on the Plugins page; memory data stays.

**检查版本 → 更新**现在可以在桌面版中更新 dsh-mnemon。此前 Host 在所属 Profile 中运行 PATH 上的 pnpm，而桌面版的 Host 找不到 pnpm，面板只能提示缺少 pnpm。现在只要 Host 运行在 dsh-mnemon 所属的 Profile 中，更新就通过 DSH 自己的插件安装器完成，效果与 `dsh plugin add dsh-mnemon@<版本>` 相同：
- 使用 Profile 自己的包管理器（桌面版中即应用自带的 pnpm），并沿用 Profile 的安装源设置、备用源与锁；
- 安装检查到的精确版本，不受 pnpm 24 小时发布窗口的限制；
- 保留新版本之前，DSH 会检查它声明支持的 DSH 版本；安装失败时恢复 Profile 的文件，面板显示 DSH 给出的原因；
- 已启用的插件保持不变，DSH 列出新版本后才报告成功。

Profile 单独安装的可选 Strategy 同样是 DSH bundle，在子包列表中以相同方式更新。DSH 既没有应用自带的 pnpm、PATH 上也没有 pnpm 时，面板提示安装 pnpm，不提供更新；没有 DSH 插件安装器的 Profile 仍使用 pnpm。

插件文件一变化，DSH 就会载入它新的浏览器代码，此前这会在更新报告结果之前关闭记忆系统和面板。现在面板会把这次更新记在页面会话中，新页面重新打开状态页与面板，显示这次更新以及需要的重启；对于仍在收尾的更新，Host 会稍等片刻再回答。重启提示也覆盖了桌面版：完全退出后重新打开。

DSH 重启之前，记忆系统每个页面的顶部都会提示已安装的版本与仍在运行的版本，无论更新来自检查版本还是 `dsh plugin`；单独更新的子包也会列出。状态页现在显示正在运行的版本，而不是已安装的版本；检查版本显示已安装的版本，不再提供 `dsh plugin` 已经安装的更新。从 0.5.21 及更早的版本更新时，桌面版仍需在插件页移除并重新添加一次，记忆数据会保留。
