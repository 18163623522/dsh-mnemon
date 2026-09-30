---
"dsh-mnemon": patch
---

The Memory System sidebar entry now looks like DSH's own panel rows in layouts without the native panel seat (#318). There, Mnemon inserts its own entry, which still used the older plugin-entry style: 13px secondary-color text, `0 10px` padding with no side margins, 8px corners, an 18px icon in a 24px box and a bold active label. Its text started 2px off the neighboring rows. The entry now copies DSH's panel row, identical in DSH 0.1.7-rc.2 and 0.2.0-rc.2:
- inherited 14px text in the primary label color, with a 22px line height;
- `7px 8px` padding, `0 2px` margins and `--dsw-radius-md` corners;
- a 16px icon (18px on the collapsed rail);
- the hover background for hover and the open workspace, and the native focus ring.

The open entry is also marked `aria-current="page"`. Layouts with the native seat already used DSH's own row and are unchanged.

没有原生面板席位的布局中，侧栏“记忆系统”入口现在与 DSH 自身的面板行一致（#318）。这类布局中由 Mnemon 自行插入入口，而它仍沿用旧的插件入口样式：13px 次要色文字、`0 10px` 内边距且无左右外边距、8px 圆角、24px 容器中的 18px 图标，选中时文字加粗；其文字起点也与相邻行错开 2px。现在入口沿用 DSH 面板行的数值，DSH 0.1.7-rc.2 与 0.2.0-rc.2 中两者相同：
- 继承的 14px 字号、主要文字色与 22px 行高；
- `7px 8px` 内边距、`0 2px` 外边距与 `--dsw-radius-md` 圆角；
- 16px 图标（折叠侧栏为 18px）；
- 悬停与打开状态使用同一悬停背景，并使用原生的焦点环。

打开时入口还会标记 `aria-current="page"`。已有原生席位的布局本就使用 DSH 自身的面板行，不受影响。
