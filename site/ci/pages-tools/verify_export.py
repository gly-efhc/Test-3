#!/usr/bin/env python3
"""Fail closed if a Pages build has no actual compiled Next output."""
import argparse
import hashlib
from pathlib import Path
import re
import sys

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--directory', required=True)
    ap.add_argument('--base-path', required=True)
    args=ap.parse_args()
    root=Path(args.directory)
    index=root/'index.html'
    if not index.is_file():
        raise ValueError('Next static export missing index.html')
    content=index.read_text(encoding='utf-8')
    if '__NEXT_DATA__' not in content and '/_next/' not in content:
        raise ValueError('index.html does not appear to be a Next.js build')
    js=list((root/'_next'/'static').rglob('*.js')) if (root/'_next'/'static').exists() else []
    css=list((root/'_next'/'static').rglob('*.css')) if (root/'_next'/'static').exists() else []
    if not js or not css:
        raise ValueError('Next compiled JavaScript/CSS missing')
    base=args.base_path.rstrip('/')
    if base and base+'/_next/' not in content:
        raise ValueError('Next static asset basePath was not applied')
    if not (root/'efhc-demo-safety.js').is_file():
        raise ValueError('Read-only network safety file missing')
    # No backend code or uploaded physical/archive logs in Pages published directory.
    forbidden = [p for p in root.rglob('*') if p.is_file() and
                 (p.suffix.lower() in {'.zip','.log','.pem','.key','.db','.sqlite'} or
                  p.name.startswith('.env'))]
    if forbidden:
        raise ValueError(f'Forbidden published asset: {forbidden[0]}')
    print(f'EFHC_PAGES_EXPORT_PASS js={len(js)} css={len(css)} pages={len(list(root.rglob("*.html")))}')

if __name__=='__main__':
    try:
        main()
    except (ValueError,OSError) as e:
        print('EFHC_PAGES_EXPORT_FAIL: '+str(e),file=sys.stderr)
        raise SystemExit(1)
