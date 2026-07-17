#!/usr/bin/env python3
"""Extract plain text from a .docx file."""
import re
import sys
import zipfile


def extract(path: str) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    text = re.sub(r'</w:p>', '\n', xml)
    text = re.sub(r'<[^>]+>', '', text)
    for a, b in [('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>'), ('&quot;', '"')]:
        text = text.replace(a, b)
    return text


if __name__ == '__main__':
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else None
    out = extract(src)
    if dst:
        with open(dst, 'w', encoding='utf-8') as f:
            f.write(out)
    print(f'chars={len(out)} lines={len(out.splitlines())}')
