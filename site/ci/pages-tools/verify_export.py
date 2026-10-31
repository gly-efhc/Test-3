"""Reject missing, incomplete or unsafe compiled Next.js Pages artifacts."""
import argparse
import sys
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--directory', required=True)
    ap.add_argument('--base-path', required=True)
    args = ap.parse_args()
    root = Path(args.directory)
    index = root / 'index.html'
    if not index.is_file():
        raise ValueError('Next static export missing index.html')
    content = index.read_text(encoding='utf-8')
    if '__NEXT_DATA__' not in content and '/_next/' not in content:
        raise ValueError('index.html does not appear to be a Next.js build')
    static = root / '_next' / 'static'
    js = list(static.rglob('*.js')) if static.exists() else []
    css = list(static.rglob('*.css')) if static.exists() else []
    if not js or not css:
        raise ValueError('Next compiled JavaScript/CSS missing')
    base = args.base_path.rstrip('/')
    if base and base + '/_next/' not in content:
        raise ValueError('Next static asset basePath was not applied')
    if not (root / 'efhc-demo-safety.js').is_file():
        raise ValueError('Isolated DEMO bootstrap file missing')
    forbidden = [
        p for p in root.rglob('*')
        if p.is_file() and (
            p.suffix.lower() in {'.zip', '.log', '.pem', '.key', '.db', '.sqlite'}
            or p.name.startswith('.env')
        )
    ]
    if forbidden:
        raise ValueError(f'Forbidden published asset: {forbidden[0]}')
    pages = len(list(root.rglob('*.html')))
    print(f'EFHC_PAGES_EXPORT_PASS js={len(js)} css={len(css)} pages={pages}')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as exc:
        print('EFHC_PAGES_EXPORT_FAIL: ' + str(exc), file=sys.stderr)
        raise SystemExit(1)
