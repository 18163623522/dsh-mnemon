---
"dsh-mnemon": patch
"dsh-mnemon-source-runtime": patch
---

Memory can be managed in the DSH Desktop app again with default settings (#310). Desktop windows load from the app's own `dsh-app://app/` address rather than a loopback URL, so Mnemon treated them as remote pages: every call went through the API Gateway, and the default `remoteAccess: read-only` made Runtime memory, Memory Spaces and the plugin settings read only while agent tools could still write. An application window now uses Mnemon's local channels, which DSH admits like any request from its own window; only a page for which DSH declares a transport that does not own the Host still counts as remote. Pages opened from another machine keep the API Gateway and its read-only default, and now say why: the Memory System and the plugin settings name `remoteAccess: trusted-host` and the DSH restart it needs. The English Runtime memory note no longer blames the deployment for a read-only page.

记忆重新可以在 DSH 桌面版中以默认设置管理（#310）。桌面窗口从应用自己的 `dsh-app://app/` 地址加载，而不是回环地址，Mnemon 因此把它当作远程页面：所有调用都经 API Gateway，默认的 `remoteAccess: read-only` 让运行时记忆、记忆空间与插件设置都变为只读，而 Agent 工具仍可写入。应用窗口现在使用 Mnemon 的本地通道，DSH 会像对待自身窗口的任何请求一样接纳它们；只有 DSH 声明了不持有 Host 的传输方式的页面才仍算作远程。从其他机器打开的页面继续使用 API Gateway 与默认只读，并会说明原因：记忆系统与插件设置写明需要 `remoteAccess: trusted-host` 并重启 DSH。运行时记忆页的英文只读说明不再归咎于部署。
