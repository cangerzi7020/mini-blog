#!/usr/bin/env python3
"""笔记库校验与索引重建工具。

用法：
    python tools/notes.py           # 等同 check：校验全部笔记与索引
    python tools/notes.py check     # 只校验，不写文件
    python tools/notes.py index     # 依据笔记 Front Matter 重建 _index.md 的自动区块

约定见 README.md。脚本无第三方依赖，可在 Windows / macOS / Linux 直接运行。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "_index.md"
TAGS_FILE = ROOT / "_tags.md"

NOTE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
REF_ID_RE = re.compile(r"^R\d{3}$")
TAG_RE = re.compile(r"^[^-]+-[^-]+-[^-]+$")
LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")

STATUSES = ("草稿", "已整理", "已复习")
TAG_TYPES = ("方法", "概念", "指标", "工具", "流程", "案例")
REQUIRED_FIELDS = ("title", "course", "date", "tags", "status")
REQUIRED_SECTIONS = ("一、笔记内容", "二、名词解释", "三、参考资料")

REGIONS = ("course", "notes", "topic", "terms", "review")


# ---------------------------------------------------------------- 基础解析
def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig").replace("\r\n", "\n")


def parse_scalar(raw: str):
    raw = raw.strip()
    if raw.startswith("[") and raw.endswith("]"):
        inner = raw[1:-1].strip()
        if not inner:
            return []
        return [item.strip().strip("'\"") for item in inner.split(",") if item.strip()]
    return raw.strip("'\"")


def parse_front_matter(text: str):
    """返回 (元数据字典, 正文)。只支持本项目用到的 YAML 子集。"""
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        return {}, text
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            data = {}
            for line in lines[1:i]:
                if not line.strip() or line.lstrip().startswith("#"):
                    continue
                key, sep, value = line.partition(":")
                if not sep:
                    continue
                data[key.strip()] = parse_scalar(value)
            return data, "\n".join(lines[i + 1:])
    return {}, text


def section_text(body: str, heading_prefix: str) -> str:
    lines = body.split("\n")
    start = None
    level = 0
    for i, line in enumerate(lines):
        match = re.match(r"^(#+)\s+(.*)$", line)
        if match is None:
            continue
        if start is None and match.group(2).strip().startswith(heading_prefix):
            start, level = i, len(match.group(1))
            continue
        if start is not None and len(match.group(1)) <= level:
            return "\n".join(lines[start + 1:i])
    return "" if start is None else "\n".join(lines[start + 1:])


def split_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def table_rows(text: str) -> list[list[str]]:
    """取文本中第一张表的数据行（跳过表头与分隔行）。"""
    rows: list[list[str]] = []
    in_table = False
    for line in text.split("\n"):
        if line.strip().startswith("|"):
            if not in_table:
                in_table = True
                continue
            if set(line.strip()) <= set("|-: "):
                continue
            rows.append(split_row(line))
        elif in_table:
            break
    return rows


def table_header(text: str) -> list[str]:
    for line in text.split("\n"):
        if line.strip().startswith("|"):
            return split_row(line)
    return []


def clean_cell(cell: str) -> str:
    return re.sub(r"[`*]", "", cell).strip()


def link_target(cell: str) -> str:
    match = re.search(r"\]\(([^)]+)\)", cell)
    return match.group(1).strip() if match else ""


# ---------------------------------------------------------------- 笔记模型
class Note:
    def __init__(self, path: Path):
        self.path = path
        self.name = path.name
        self.rel = path.relative_to(ROOT).as_posix()
        self.text = read_text(path)
        self.meta, self.body = parse_front_matter(self.text)

        match = NOTE_RE.match(self.name)
        self.date = match.group(1) if match else ""
        self.slug = match.group(2) if match else ""

        self.title = str(self.meta.get("title") or "").strip()
        self.course = str(self.meta.get("course") or "").strip()
        self.meta_date = str(self.meta.get("date") or "").strip()
        self.status = str(self.meta.get("status") or "").strip()
        tags = self.meta.get("tags")
        self.tags = tags if isinstance(tags, list) else ([tags] if tags else [])

        self.terms = self._parse_terms()
        self.refs = self._parse_refs()
        self.todos = len(re.findall(r"^\s*-\s\[ \]", section_text(self.body, "一、笔记内容"), re.M))

    def _parse_terms(self) -> list[dict]:
        text = section_text(self.body, "二、名词解释")
        header = table_header(text)
        terms = []
        for row in table_rows(text):
            if not row or not row[0] or row[0] in ("名词", "待添加"):
                continue
            if not self._looks_like_term_header(header) and len(row) < 4:
                continue
            terms.append(
                {
                    "term": clean_cell(row[0]),
                    "english": clean_cell(row[1]) if len(row) > 1 else "",
                    "def": clean_cell(row[2]) if len(row) > 2 else "",
                }
            )
        return terms

    @staticmethod
    def _looks_like_term_header(header: list[str]) -> bool:
        return bool(header) and header[0].startswith("名词")

    def _parse_refs(self) -> list[dict]:
        text = section_text(self.body, "三、参考资料")
        refs = []
        for row in table_rows(text):
            if not row or not row[0] or row[0] in ("编号", "待添加"):
                continue
            if not REF_ID_RE.match(clean_cell(row[0])):
                continue
            refs.append(
                {
                    "id": clean_cell(row[0]),
                    "type": clean_cell(row[1]) if len(row) > 1 else "",
                    "title": clean_cell(row[2]) if len(row) > 2 else "",
                    "url": row[6].strip() if len(row) > 6 else "",
                }
            )
        return refs


def load_notes() -> list[Note]:
    notes = []
    for path in sorted(ROOT.glob("*.md")):
        if path.name.startswith("_") or path.name in ("README.md", "AGENTS.md"):
            continue
        if NOTE_RE.match(path.name):
            notes.append(Note(path))
    notes.sort(key=lambda n: (n.date, n.name))
    return notes


def load_tags() -> set[str]:
    if not TAGS_FILE.exists():
        return set()
    text = section_text(read_text(TAGS_FILE), "词表")
    tags = set()
    for row in table_rows(text):
        if row and row[0] and row[0] not in ("标签", "待添加"):
            tags.add(clean_cell(row[0]))
    return tags


# ---------------------------------------------------------------- 校验
class Report:
    def __init__(self):
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, scope: str, message: str):
        self.errors.append(f"{scope}: {message}")

    def warn(self, scope: str, message: str):
        self.warnings.append(f"{scope}: {message}")


def check_links(note: Note, report: Report):
    seen = set()
    for target in LINK_RE.findall(note.text):
        if target in seen or target.startswith(("http://", "https://", "mailto:", "#")):
            continue
        seen.add(target)
        path_part = target.split("#")[0]
        if not path_part:
            continue
        resolved = (note.path.parent / path_part).resolve()
        if not resolved.exists():
            report.error(note.name, f"链接目标不存在：{target}")


def check_notes(notes: list[Note], vocab: set[str], report: Report):
    term_owner: dict[str, str] = {}
    ref_owner: dict[str, tuple[str, str]] = {}

    for note in notes:
        scope = note.name
        if not NOTE_RE.match(note.name):
            report.error(scope, "文件名不符合 YYYY-MM-DD-英文slug.md")
        if note.meta_date and note.meta_date != note.date:
            report.error(scope, f"Front Matter date（{note.meta_date}）与文件名日期（{note.date}）不一致")
        if not DATE_RE.match(note.date or ""):
            report.error(scope, "文件名缺少有效日期")
        if "{{" in note.text:
            report.error(scope, "存在未替换的模板占位符 {{ }}")

        for field in REQUIRED_FIELDS:
            value = note.meta.get(field)
            if value in (None, "", []):
                report.error(scope, f"Front Matter 缺少字段或为空：{field}")
        if note.status and note.status not in STATUSES:
            report.error(scope, f"status 只能是 {' / '.join(STATUSES)}，当前为「{note.status}」")
        if note.meta.get("instructor") in (None, ""):
            report.warn(scope, "建议补全 Front Matter 的 instructor")

        for heading in REQUIRED_SECTIONS:
            if not re.search(rf"^#+\s+{re.escape(heading)}", note.body, re.M):
                report.error(scope, f"缺少固定章节「{heading}」")
        if not re.search(r"^#+\s+修订记录", note.body, re.M):
            report.error(scope, "缺少「修订记录」章节")

        for tag in note.tags:
            if not TAG_RE.match(tag):
                report.error(scope, f"标签「{tag}」不符合 课程-模块-类型 三段式")
                continue
            if tag.split("-")[2] not in TAG_TYPES:
                report.error(scope, f"标签「{tag}」的类型应为 {' / '.join(TAG_TYPES)}")
            if vocab and tag not in vocab:
                report.warn(scope, f"标签「{tag}」未在 _tags.md 词表登记")

        for term in note.terms:
            if not term["def"]:
                report.error(scope, f"名词「{term['term']}」缺少解释")
            if term["term"] in term_owner and term_owner[term["term"]] != note.name:
                report.error(
                    scope,
                    f"名词「{term['term']}」已在 {term_owner[term['term']]} 定义，应改为链接引用",
                )
            term_owner.setdefault(term["term"], note.name)

        for ref in note.refs:
            if not ref["title"]:
                report.error(scope, f"资料 {ref['id']} 缺少标题")
            key, value = ref_owner.get(ref["id"], (note.name, ref["title"]))
            if ref_owner and key != note.name and value != ref["title"]:
                report.error(scope, f"资料编号 {ref['id']} 已被 {key} 用于《{value}》")
            ref_owner.setdefault(ref["id"], (note.name, ref["title"]))

        check_links(note, report)

    if not notes:
        report.warn("notes", "库中还没有笔记")


# ---------------------------------------------------------------- 索引生成
def note_ids(notes: list[Note]) -> dict[str, str]:
    existing: dict[str, str] = {}
    if INDEX.exists():
        region = auto_region(read_text(INDEX), "notes")
        for row in table_rows(region):
            if len(row) < 2 or not re.match(r"^N\d{3}$", clean_cell(row[0])):
                continue
            target = link_target(row[3]) if len(row) > 3 else ""
            if target:
                existing[target] = clean_cell(row[0])
    used = set(existing.values())
    counter = 1
    for note in notes:
        if note.name in existing:
            continue
        while f"N{counter:03d}" in used:
            counter += 1
        existing[note.name] = f"N{counter:03d}"
        used.add(f"N{counter:03d}")
    return existing


def sort_key(note: Note):
    return (note.date, note.name)


def build_notes_region(notes: list[Note], ids: dict[str, str]) -> str:
    lines = [
        "| 编号 | 日期 | 课程 | 主题 | 标签 | 状态 | 术语 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for note in sorted(notes, key=sort_key, reverse=True):
        tags = "、".join(f"`{tag}`" for tag in note.tags) or "-"
        title = note.title or note.slug
        lines.append(
            f"| {ids[note.name]} | {note.date} | {note.course or '-'} "
            f"| [{title}]({note.rel}) | {tags} | {note.status or '-'} | {len(note.terms)} |"
        )
    return "\n".join(lines)


def build_course_region(notes: list[Note]) -> str:
    courses: dict[str, list[Note]] = {}
    for note in notes:
        courses.setdefault(note.course or "未分类", []).append(note)
    lines = [
        "| 课程 | 笔记数 | 最近一课 | 状态 |",
        "| --- | --- | --- | --- |",
    ]
    for course in sorted(courses, key=lambda c: (-len(courses[c]), c)):
        group = sorted(courses[course], key=sort_key)
        latest = group[-1]
        if any(n.status == "草稿" for n in group):
            state = "有待整理"
        elif all(n.status == "已复习" for n in group):
            state = "已复习完"
        else:
            state = "进行中"
        lines.append(
            f"| {course} | {len(group)} | [{latest.title or latest.slug}]({latest.rel})（{latest.date}） | {state} |"
        )
    return "\n".join(lines)


def build_topic_region(notes: list[Note]) -> str:
    modules: dict[str, list[Note]] = {}
    for note in notes:
        groups = {tag.split("-")[1] for tag in note.tags if TAG_RE.match(tag)} or {"未分类"}
        for module in groups:
            modules.setdefault(module, []).append(note)
    blocks = []
    for module in sorted(modules):
        items = sorted(modules[module], key=sort_key, reverse=True)
        lines = [f"### {module}", ""]
        for note in items:
            lines.append(f"- [{note.title or note.slug}]({note.rel}) — {note.date} · {note.course or '未分类'}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def build_terms_region(notes: list[Note]) -> str:
    first: dict[str, tuple[Note, dict]] = {}
    for note in sorted(notes, key=sort_key):
        for term in note.terms:
            first.setdefault(term["term"], (note, term))
    lines = [
        "| 名词 | 首次出现 | 一句话说明 |",
        "| --- | --- | --- |",
    ]
    for term in sorted(first):
        note, data = first[term]
        lines.append(f"| {term} | [{note.title or note.slug}]({note.rel}) | {data['def']} |")
    return "\n".join(lines)


def build_review_region(notes: list[Note]) -> str:
    draft = [n for n in sorted(notes, key=sort_key) if n.status == "草稿"]
    ready = [n for n in sorted(notes, key=sort_key) if n.status == "已整理"]
    done = [n for n in notes if n.status == "已复习"]
    lines = [f"共 {len(notes)} 篇：草稿 {len(draft)} · 已整理 {len(ready)} · 已复习 {len(done)}", ""]
    lines.append("**待整理（草稿）**")
    lines.append("")
    lines.extend(
        [f"- [{n.title or n.slug}]({n.rel}) — {n.date}，待办 {n.todos} 条" for n in draft]
        or ["- 无"]
    )
    lines.append("")
    lines.append("**待复习（已整理，按时间从旧到新）**")
    lines.append("")
    lines.extend([f"- [{n.title or n.slug}]({n.rel}) — {n.date}" for n in ready] or ["- 无"])
    return "\n".join(lines)


def build_regions(notes: list[Note]) -> dict[str, str]:
    return {
        "notes": build_notes_region(notes, note_ids(notes)),
        "course": build_course_region(notes),
        "topic": build_topic_region(notes),
        "terms": build_terms_region(notes),
        "review": build_review_region(notes),
    }


def auto_region(text: str, name: str) -> str:
    pattern = re.compile(
        rf"<!-- AUTO:{name} -->\n(.*?)\n<!-- /AUTO:{name} -->", re.S
    )
    match = pattern.search(text)
    return match.group(1) if match else ""


def validate_regions(notes: list[Note], report: Report):
    if not INDEX.exists():
        report.error("_index.md", "索引文件不存在")
        return
    text = read_text(INDEX)
    generated = build_regions(notes)
    for name in REGIONS:
        pattern = re.compile(rf"<!-- AUTO:{name} -->\n(.*?)\n<!-- /AUTO:{name} -->", re.S)
        if not pattern.search(text):
            report.error("_index.md", f"缺少自动区块标记 AUTO:{name}")
            continue
        current = auto_region(text, name).strip()
        if current != generated[name].strip():
            report.error("_index.md", f"「{name}」区块与笔记不一致，运行 python tools/notes.py index")


def write_index(notes: list[Note]) -> None:
    if not INDEX.exists():
        raise SystemExit("未找到 _index.md")
    text = read_text(INDEX)
    for name, content in build_regions(notes).items():
        pattern = re.compile(rf"(<!-- AUTO:{name} -->\n).*?(\n<!-- /AUTO:{name} -->)", re.S)
        if not pattern.search(text):
            raise SystemExit(f"_index.md 缺少 AUTO:{name} 标记")
        text = pattern.sub(lambda m, c=content: m.group(1) + c + m.group(2), text)
    INDEX.write_text(text.rstrip("\n") + "\n", encoding="utf-8")


# ---------------------------------------------------------------- 入口
def main(argv: list[str]) -> int:
    command = argv[1] if len(argv) > 1 else "check"
    if command not in ("check", "index"):
        print(f"未知命令：{command}\n用法：python tools/notes.py [check|index]")
        return 2

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    notes = load_notes()
    if command == "index":
        write_index(notes)
        print(f"已重建索引：{INDEX.relative_to(ROOT)}（{len(notes)} 篇笔记）")

    report = Report()
    check_notes(notes, load_tags(), report)
    validate_regions(notes, report)

    for message in report.warnings:
        print(f"[警告] {message}")
    for message in report.errors:
        print(f"[错误] {message}")

    if report.errors:
        print(f"\n校验失败：{len(report.errors)} 个错误，{len(report.warnings)} 个警告")
        return 1
    print(f"校验通过：{len(notes)} 篇笔记，{len(report.warnings)} 个警告")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
