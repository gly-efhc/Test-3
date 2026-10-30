#!/usr/bin/env python3
"""Normalize original root-absolute public asset URLs for project Pages basePath.

Do not rewrite actual React routes, JSON fixtures or API endpoints.
# /faq is a Next route; only /faq/*.json translation assets are rewritten.
"""
import argparse
from pathlib import Path
import re
import sys

PATTERN = re.compile(r'(["\'`(=])/(assets|locale|faq/[A-Za-z0-9_-]+\.json|audio|fonts|images|icons|favicon\.ico|manifest\.webmanifest)(?=[/?#"\'`\s)])')

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--directory',required=True)
    ap.add_argument('--base-path',required=True)
    args=ap.parse_args()
    root=Path(args.directory)
    base=args.base_path.rstrip('/')
    if not base or not re.fullmatch(r'/[A-Za-z0-9_.-]+',base):
        raise ValueError('Invalid Pages repository basePath')
    changed=0
    for p in root.rglob('*'):
        if not p.is_file() or p.suffix not in ('.html','.css','.js'):
            continue
        # Never alter the DEMO security blocker while fixing app assets.
        if p.name=='efhc-demo-safety.js':
            continue
        original=p.read_text(encoding='utf-8')
        updated=PATTERN.sub(lambda m:m.group(1)+base+'/'+m.group(2),original)
        if updated!=original:
            p.write_text(updated,encoding='utf-8')
            changed+=1
    print(f'EFHC_DEMO_PUBLIC_ASSET_BASEPATH_OK files_rewritten={changed}')

if __name__=='__main__':
    try:main()
    except (OSError,ValueError) as e:
        print('EFHC_ASSET_REWRITE_FAIL '+str(e),file=sys.stderr)
        raise SystemExit(1)
