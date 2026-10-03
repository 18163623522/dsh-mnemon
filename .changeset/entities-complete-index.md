---
"dsh-mnemon-source-memory-spaces": patch
"dsh-mnemon": patch
---

The Entities page counts and lists every memory that carries an entity. It summed each space's 20 most frequent entities from the Provider's status, so most entities were missing and some counts were short, and selecting an entity ran Agent recall: its quality policy keeps at most four medium matches and fills the list with memories that do not carry the entity, so an entity carried by 22 memories could list 5. Now:
- each space's entity index comes from the memories its Provider lists, or from the Provider's own optional `entityIndex`; an entity's count is the number of memories that carry it, the same memories the page lists, and the rail lists every entity;
- selecting an entity lists all of those memories, most important first, a page at a time; below them, **Find related memories** runs recall for the entity among memories that do not carry it, only when asked for: once opened it stays open for the next entities in the browser session until hidden, and it opens by itself when no memory carries a name entered;
- the carrying memories come from the index at once; a placeholder shows only for a read that takes a while, and the spaces show from the directory before their indexes arrive; a forgotten memory leaves the lists at once, and the others stay in place until the refreshed lists arrive;
- an index stays while its space's Provider statistics hold, and a write through the Source drops it; when the same page selects another entity, the related recall it was still waiting for is cancelled.

实体页现在统计并列出带有某个实体的全部记忆。此前它把 Provider 状态中每个空间出现最多的 20 个实体相加，多数实体因此缺失，部分计数偏少；选中实体时走的是给 Agent 用的召回：其质量策略最多保留四条中相关结果，并用不带该实体的记忆补足列表，一个被 22 条记忆带有的实体可能只列出 5 条。现在：
- 每个空间的实体索引来自其 Provider 列出的记忆，或来自 Provider 可选的 `entityIndex`；实体的计数就是带有它的记忆数，也就是实体页列出的那些记忆，左侧列出全部实体；
- 选中实体后按重要性分页列出这些记忆；其下的**查找相关记忆**只在需要时运行，在不带该实体的记忆中召回与它相关的那些：展开后在本次浏览器会话中切换实体时保持展开，直到收起；输入的名称没有任何记忆带有时自动显示；
- 带有该实体的记忆直接从索引读取，立即显示；只有读取耗时较长时才显示占位，各空间先按目录显示，再等索引读取完成；删除的记忆立即从列表中移除，其余记忆留在原处，直到刷新后的列表到达；
- 空间的 Provider 统计不变时沿用其索引，经 Source 写入会立即使其失效；同一页面改选其他实体时，会取消仍在等待的相关召回。
