"""Extract detail-table text from a saved Seoul History Archive HTML page."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path


class DetailParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.cell = None
        self.label = ''
        self.parts = []
        self.fields = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'div':
            if self.depth:
                self.depth += 1
            elif 'view_table_info' in attrs.get('class', '').split():
                self.depth = 1
        if not self.depth:
            return
        if tag in ('th', 'td'):
            self.cell, self.parts = tag, []
        elif tag == 'br' and self.cell:
            self.parts.append('\n')

    def handle_data(self, data):
        if self.depth and self.cell:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if self.depth and tag == self.cell:
            value = '\n'.join(' '.join(line.split()) for line in ''.join(self.parts).splitlines() if line.strip())
            if tag == 'th':
                self.label = value
            else:
                if self.label in self.fields:
                    raise ValueError(f'Duplicate field: {self.label}')
                self.fields[self.label] = value
            self.cell = None
        if tag == 'div' and self.depth:
            self.depth -= 1


def extract(path, source_id, url, retrieved_at):
    raw = path.read_bytes()
    parser = DetailParser()
    parser.feed(raw.decode('utf-8'))
    if not parser.fields.get('명칭') or not parser.fields.get('아카이브 번호'):
        raise ValueError('Expected archive detail table missing; inspect page structure')
    return {
        'source_id': source_id,
        'source_url': url,
        'retrieved_at': retrieved_at,
        'html_path': path.as_posix(),
        'html_sha256': hashlib.sha256(raw).hexdigest(),
        'text_policy': 'Original labels and text; layout whitespace normalized, line breaks preserved.',
        'fields': parser.fields,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('html', type=Path)
    parser.add_argument('--source-id', required=True)
    parser.add_argument('--url', required=True)
    parser.add_argument('--retrieved-at', required=True, help='ISO 8601 retrieval timestamp')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    result = extract(args.html, args.source_id, args.url, args.retrieved_at)
    with args.output.open('x', encoding='utf-8') as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
        output.write('\n')
