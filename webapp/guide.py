"""Render docs/landmarks.md as a site page with the small Markdown subset the guide uses."""
import html
import re
from functools import lru_cache
from urllib.parse import urlsplit

from django.conf import settings

GUIDE = 'docs/landmarks.md'


def anchor(text):
    # Headings such as "숭례문 (남대문)" are linked by the name the map popup shows.
    return re.sub(r'\s+\(.*\)$', '', text).strip()


def inline(text):
    out = html.escape(text, quote=False)
    out = re.sub(r'`([^`]+)`', r'<code>\1</code>', out)
    out = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', out)

    def link(m):
        label, url = m.group(1), html.escape(html.unescape(m.group(2)), quote=True)
        raw_url = html.unescape(url)
        try:
            scheme = urlsplit(raw_url).scheme.lower()
        except ValueError:
            return label
        if scheme not in ('', 'http', 'https') or raw_url.startswith('//'):
            return label
        external = url.startswith('http')
        extra = ' target="_blank" rel="noopener noreferrer"' if external else ''
        return f'<a href="{url}"{extra}>{label}</a>'
    return re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', link, out)


@lru_cache(maxsize=4)
def render_markdown(text):
    lines = text.splitlines()
    parts, toc, anchors, i = [], [], [], 0
    # Headings own their anchors; table rows only take names no heading uses, so IDs stay unique.
    heading_names = {anchor(m.group(1)) for m in (re.match(r'^#{2,3}\s+(.*)$', l) for l in lines) if m}
    title = ''
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        heading = re.match(r'^(#{1,3})\s+(.*)$', line)
        if heading:
            level, text = len(heading.group(1)), heading.group(2).strip()
            # "Heading {#id}" pins the anchor (the English guide keeps the Korean ids the map links to).
            pinned = re.match(r'^(.*?)\s*\{#([^}]+)\}$', text)
            if pinned:
                text, forced = pinned.group(1).strip(), pinned.group(2).strip()
            else:
                forced = None
            if level == 1:
                title = text
            else:
                ident = forced or anchor(text)
                if ident in anchors:
                    ident = f'{ident}-{anchors.count(ident) + 1}'
                anchors.append(ident)
                if level == 2:
                    toc.append(ident)
                # A combined heading such as "좌포도청·우포도청" is also reachable by each name.
                aliases = [n for n in ident.split('·') if '·' in ident and n not in heading_names and n not in anchors]
                anchors.extend(aliases)
                spans = ''.join(f'<span id="{html.escape(n, quote=True)}"></span>' for n in aliases)
                parts.append(f'<h{level} id="{html.escape(ident, quote=True)}">{spans}{inline(text)}</h{level}>')
            i += 1
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-{3,}:?', c) for c in cells):
                    rows.append(cells)
                i += 1
            head, body = rows[0], rows[1:]
            table = ['<div class="table"><table><thead><tr>', *(f'<th>{inline(c)}</th>' for c in head), '</tr></thead><tbody>']
            for row in body:
                # Rows without their own heading (the Yukjo offices) are still linkable by their first cell.
                ident = anchor(row[0])
                if ident in heading_names or ident in anchors:
                    table.append('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in row) + '</tr>')
                    continue
                anchors.append(ident)
                table.append(f'<tr id="{html.escape(ident, quote=True)}">' + ''.join(f'<td>{inline(c)}</td>' for c in row) + '</tr>')
            table.append('</tbody></table></div>')
            parts.append(''.join(table))
        elif line.startswith('- '):
            items = []
            while i < len(lines) and lines[i].startswith('- '):
                items.append(f'<li>{inline(lines[i][2:])}</li>')
                i += 1
            parts.append('<ul>' + ''.join(items) + '</ul>')
        else:
            para = []
            while i < len(lines) and lines[i].strip() and not re.match(r'^(#|\||- )', lines[i]):
                para.append(lines[i].strip())
                i += 1
            parts.append(f'<p>{inline(" ".join(para))}</p>')
    return {'title': title, 'body': '\n'.join(parts), 'toc': toc, 'anchors': anchors}


def render_guide(lang='ko'):
    if settings.CONTENT_SOURCE == 'database':
        from .content import guide_markdown
        return render_markdown(guide_markdown(lang))
    text = (settings.BASE_DIR / GUIDE).read_text()
    if lang == 'en':
        text = english_guide(text)
    return render_markdown(text)


def english_guide(text):
    """File mode: swap sections for docs/landmarks_en.json entries (title_en/body_en by Korean heading)."""
    import json
    path = settings.BASE_DIR / 'docs/landmarks_en.json'
    if not path.exists():
        return text
    table = json.loads(path.read_text())
    out, lines, i = [], text.splitlines(), 0
    while i < len(lines):
        heading = re.match(r'^(#{1,3})\s+(.*)$', lines[i])
        if heading and heading.group(2).strip() in table and table[heading.group(2).strip()].get('body_en') is not None:
            entry, level = table[heading.group(2).strip()], heading.group(1)
            out.append(f"{level} {entry.get('title_en') or heading.group(2).strip()} {{#{anchor(heading.group(2).strip())}}}")
            out.append('')
            out.append(entry['body_en'])
            i += 1
            while i < len(lines) and not re.match(r'^#{1,3}\s', lines[i]):
                i += 1
            continue
        out.append(lines[i])
        i += 1
    return '\n'.join(out)
