#!/usr/bin/env python3
"""Text audit for blog articles — flag high-signal typo patterns only."""
import re
import os
import sys

# Each pattern: (regex, label). Patterns are designed to have LOW false
# positive rate on normal Chinese prose.
PATTERNS = [
    # 几 + wrong char + 天 (the original "几卡天" bug)
    (r'几([^的天日月分时秒])天', '几X天 typo'),
    # Doubled CJK characters (3+ times in a row, not common phrases)
    (r'([\u4e00-\u9fff])\1{2,}', 'CJK char repeated 3+'),
    # Common doubling bugs
    (r'(?<![一二三四五六七八九十百千万亿零第])(的的|了了|是是|这这|那那|已已|与与|和和|地地|得得|会会|要要|能能|在在再)', 'doubled connective'),
    # Wrong 在/再 usage: "在...再" or "再...在" in non-natural contexts
    # Skipped — too noisy, requires context
    # Mixed punctuation (Chinese ,.!?; within English/code)
    # Skipped — requires careful context detection
    # Stray / repeated punctuation
    (r'[。，！？]{2,}', 'doubled Chinese punctuation'),
    (r'[.,!?;]{3,}', '3+ Latin punctuation in a row'),
    # Numbers / unit typos
    (r'(\d+)\s*([a-zA-Z]+)\s*(\d+)\s*\2', 'unit repeated weirdly'),
    # English in middle of CJK without spaces (sometimes legit, but often a paste artifact)
    # Skipped — too noisy
]

def line_ok(line: str, in_code: bool, in_frontmatter: bool) -> bool:
    if in_code or in_frontmatter:
        return False
    # Skip headings, list items, table rows, blockquotes (often have terse code-like text)
    if line.lstrip().startswith(('#', '-', '*', '+', '|', '>', '!', '[')):
        return False
    return True

issues = []
for root, _, files in os.walk('src/content/blog'):
    for f in files:
        if not f.endswith('.mdx'):
            continue
        path = os.path.join(root, f)
        with open(path) as fh:
            in_code = False
            in_frontmatter = False
            line_count = 0
            for ln, line in enumerate(fh, 1):
                line_count += 1
                stripped = line.strip()
                # Frontmatter
                if line_count == 1 and stripped == '---':
                    in_frontmatter = True
                    continue
                if in_frontmatter:
                    if stripped == '---':
                        in_frontmatter = False
                    continue
                # Code block
                if stripped.startswith('```'):
                    in_code = not in_code
                    continue
                if not line_ok(line, in_code, in_frontmatter):
                    continue
                for pat, kind in PATTERNS:
                    for m in re.finditer(pat, line):
                        issues.append((path, ln, kind, line.strip()[:120], m.group(0)))

if not issues:
    print('OK: no high-signal typos found')
    sys.exit(0)

print(f'Found {len(issues)} potential issues:')
for path, ln, kind, line, snippet in issues:
    print(f'  {path}:{ln}  [{kind}]  {line}')
    if snippet:
        print(f'    match: {snippet!r}')
