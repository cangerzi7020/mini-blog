# 历史存档

本目录只存放**已废弃**的结构，仅供追溯，不参与任何检索，不作为模板或规范依据。

| 目录 | 原结构 | 废弃原因 |
| --- | --- | --- |
| `v1-four-layer/` | 根 `index.md` + `notes/` `glossary/` `references/` `templates/` 四层分工 | 与根 `_index.md`、`_note-template.md` 形成两套并行规范，索引重复、命名冲突、AI 与人工维护路径不一致 |

现行规范见根目录 `README.md`。新建笔记只用 `_note-template.md`，登记索引只用 `python tools/notes.py index`。

如果确需复用旧存档里的内容，请把内容改写为现行三段式结构后再放回根目录，不要直接复制文件。
