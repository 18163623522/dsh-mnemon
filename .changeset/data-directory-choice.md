---
"dsh-mnemon": patch
---

**Data directory** under Storage is now a choice between **Default** and **Custom**, the same control Provider locations use, and shows the one directory memory uses: the default path under its title, or a custom path in its field. An empty field no longer means the default; choosing Custom puts the cursor in the field, and Apply waits for a path. The Host reports its default directory with the current one, so choosing Default shows where memory will go before Apply.

“存储”中的**数据目录**改为在“默认”与“自定义”之间选择，与 Provider 位置设置使用同一控件，并只显示记忆正在使用的一个目录：默认目录显示在标题下方，自定义目录显示在输入框中。输入框留空不再代表默认；选择“自定义”后光标进入输入框，填写路径后才能应用。Host 在返回当前目录时一并返回默认目录，因此选择“默认”后、应用前即可看到记忆将使用的位置。
