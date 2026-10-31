#!/usr/bin/env python3
"""Transform an ephemeral COPY of actual React source for safe static export.

The imported source tree site/frontend is never changed by this script.
"""
import argparse
import json
import os
import shutil
import sys
from pathlib import Path

NEXT_CONFIG = '''/** EFHC isolated GitHub Pages DEMO; generated for an ephemeral build only. */
const basePath = process.env.EFHC_DEMO_BASEPATH || '';
module.exports = {
  reactStrictMode: true,
  output: 'export',
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: false },
  // Pages Router basePath guard: prevent repeated /Test-3/ hard redirects.
  // Next.js upstream #75477 / #80852; temporary DEMO build only.
  experimental: { cpus: 2, clientRouterFilter: false },
};
'''

# The old v907 global interception shim blocked TONConnect bridges,
# real TEST API requests, external HUB destinations, XHR, WebSockets and
# window.open even after a direct user gesture. This restores the
# browser transport and leaves identity, RBAC and payment validation in
# the real application/backend, instead of emulating a failed request.
SAFETY = r'''/* EFHC Pages: isolated DEMO account bootstrap only.
This flag selects local DEMO when no explicit authenticated TEST API
is configured; it is NOT a network, wallet or navigation firewall.
Real server actions remain protected by the API/identity contracts. */
window.__EFHC_DEMO_READ_ONLY__ = true;
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True)
    ap.add_argument('--target', required=True)
    ap.add_argument('--base-path', required=True)
    args = ap.parse_args()
    base = args.base_path.rstrip('/')
    if base and (not base.startswith('/') or '/' in base[1:] or base in ('/.', '/..')):
        raise ValueError('base-path must be empty or /single-repository-name')
    source, target = Path(args.source), Path(args.target)
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)
    # v868 owns the fixes in actual React source; no temporary TS/route hacks.
    # Pages-only data routing is selected by NEXT_PUBLIC_EFHC_PAGES_PREVIEW.
    # Static image paths still require the subpath prefix on project Pages.
    splash = target / 'src/components/SplashScreen.tsx'
    splash_text = splash.read_text(encoding='utf-8')
    logo_src = 'src="/assets/efhc/canon/efhc_logo_canon.svg"'
    if splash_text.count(logo_src) != 1:
        raise ValueError('Splash logo path changed: review basePath manually')
    splash.write_text(
        splash_text.replace(logo_src, f'src="{base}/assets/efhc/canon/efhc_logo_canon.svg"', 1),
        encoding='utf-8',
    )
    print('EFHC_PAGES_SPLASH_LOGO_BASEPATH=PASS')
    # All edits above apply exclusively to the ephemeral build-copy.
    (target / 'next.config.js').write_text(NEXT_CONFIG, encoding='utf-8')
    # GitHub Pages cannot execute Next API handlers. Keep all real USER/ADMIN React pages.
    api = target / 'src/pages/api'
    if api.exists():
        shutil.rmtree(api)
    # Pages Router custom _error has getInitialProps and cannot be statically exported.
    custom_error = target / 'src/pages/_error.tsx'
    if custom_error.exists():
        custom_error.unlink()
    doc = target / 'src/pages/_document.tsx'
    content = doc.read_text(encoding='utf-8')
    if 'src="/public-runtime-config.js"' not in content:
        raise ValueError('Expected runtime-config script not found in actual _document.tsx')
    content = content.replace('src="/public-runtime-config.js"',
                              f'src="{base}/efhc-demo-safety.js"', 1)
    # Retain the existing Telegram runtime; public Pages remains an ordinary browser host.
    # Static assets referenced directly from document are not basePath-rewritten by Next.
    content = content.replace('href="/assets/', f'href="{base}/assets/')
    doc.write_text(content, encoding='utf-8')
    safety = SAFETY.replace('__BASE_PATH__', base)
    (target / 'public/efhc-demo-safety.js').write_text(safety, encoding='utf-8')
    owner = os.environ.get('GITHUB_REPOSITORY_OWNER', 'gly-efhc')
    if not owner or not owner.replace('-', '').isalnum():
        raise ValueError('Invalid Pages owner in TONConnect manifest')
    public_url = f'https://{owner}.github.io{base}'
    manifest = {'url': public_url, 'name': 'EFHC Browser DEMO',
                'iconUrl': public_url + '/icon.png',
                'termsOfUseUrl': public_url + '/web-profile/?legal=terms',
                'privacyPolicyUrl': public_url + '/web-profile/?legal=privacy'}
    (target / 'public/tonconnect-manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (target / 'public/sw.js').unlink(missing_ok=True)
    (target / 'public/runtime-config.json').unlink(missing_ok=True)
    (target / 'public/manifest.webmanifest').unlink(missing_ok=True)
    # TEST service origins remain controlled by explicit frontend configuration.
    print(f'EFHC_PAGES_TEMP_BUILD_READY base={base!r} source={source} target={target}')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as exc:
        print(f'EFHC_PAGES_PREPARE_FAIL: {exc}', file=sys.stderr)
        raise SystemExit(1)
