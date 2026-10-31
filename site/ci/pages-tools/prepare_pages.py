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

SAFETY = r'''/* EFHC Pages DEMO: block external and live operations. */
(function () {
  'use strict';
  var base = '__BASE_PATH__';
  var nativeFetch = window.fetch.bind(window);
  // Real wallet discovery is opt-in; all EFHC business APIs and transactions stay blocked.
  // Bridge origins come ONLY from the official TonConnect registry.
  var tonRegistry = 'https://raw.githubusercontent.com/ton-connect/wallets-list/main/wallets-v2.json';
  var tonBridgeOrigins = new Set();
  var tonWalletOrigins = new Set();
  var nativeEventSource = window.EventSource;
  var nativeWebSocket = window.WebSocket;
  function isTonBridge(url) {
    return url.protocol === 'https:' && tonBridgeOrigins.has(url.origin) &&
      (url.pathname.startsWith('/bridge') || url.pathname.startsWith('/events'));
  }
  function canLaunchWallet(url) {
    return Date.now() < (window.__EFHC_TONCONNECT_USER_ACTIVATED_UNTIL__ || 0) &&
      ((url.protocol === 'https:' && tonWalletOrigins.has(url.origin)) || url.protocol === 'ton:');
  }
  function registerTonWallets(list) {
    if (!Array.isArray(list)) return;
    list.forEach(function(wallet) {
      (Array.isArray(wallet.bridge) ? wallet.bridge : []).forEach(function(bridge) {
        try {
          var url = new URL(bridge.url || '');
          if (url.protocol === 'https:' && (url.pathname.startsWith('/bridge') || url.pathname.startsWith('/events'))) {
            tonBridgeOrigins.add(url.origin);
          }
        } catch (_) {}
      });
      try {
        var url = new URL(wallet.universal_url || '');
        if (url.protocol === 'https:') tonWalletOrigins.add(url.origin);
      } catch (_) {}
    });
  }

  var apiHub = JSON.stringify([
    {id:1,code:'efhc_buy',title:'EFHC Shop',url:'#',sort_order:1,is_active:true},
    {id:2,code:'vip_getgems',title:'EFHC VIP NFT',url:'#',sort_order:2,is_active:true},
    {id:3,code:'efhc_ceo',title:'EFHC CEO',url:'#',sort_order:3,is_active:true},
    {id:4,code:'efhc_admin',title:'EFHC Admin',url:'#',sort_order:4,is_active:true}
  ]);
  function apiResponse(path) {
    var data = path.endsWith('/hub/links') ? apiHub : '{"detail":"EFHC_DEMO_READ_ONLY","demo":true}';
    return new Response(data, {status: path.endsWith('/hub/links') ? 200 : 503,
      headers: {'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});
  }
  function isStatic(path) {
    return path.startsWith(base + '/_next/') || path.startsWith(base + '/assets/') ||
      path.startsWith(base + '/locale/') || path.startsWith(base + '/faq/') ||
      path.startsWith(base + '/audio/') || path.startsWith(base + '/fonts/') ||
      path === base + '/manifest.webmanifest' || path === base + '/favicon.ico';
  }
  window.__EFHC_DEMO_READ_ONLY__ = true;
  window.fetch = function(resource, init) {
    var raw = typeof resource === 'string' ? resource : resource && resource.url;
    var url;
    try { url = new URL(raw || '', location.href); } catch (_) { return Promise.resolve(apiResponse('/invalid')); }
    var method = String(init && init.method || resource && resource.method || 'GET').toUpperCase();
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith(base + '/api/'))
      return Promise.resolve(apiResponse(url.pathname));
    if (url.href === tonRegistry && method === 'GET') {
      return nativeFetch(resource, init).then(function(response) {
        try { response.clone().json().then(registerTonWallets).catch(function(){}); } catch (_) {}
        return response;
      });
    }
    if (isTonBridge(url) && ['GET','POST'].includes(method)) return nativeFetch(resource, init);
    if (url.origin !== location.origin || !['GET','HEAD'].includes(method))
      return Promise.resolve(apiResponse('/blocked'));
    if (isStatic(url.pathname) || url.pathname.startsWith(base + '/'))
      return nativeFetch(resource, init);
    return Promise.resolve(apiResponse('/blocked'));
  };
  var nativeOpen = XMLHttpRequest.prototype.open;
  var nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method,url) {
    this.__efhcBlocked = true;
    try {
      var parsed = new URL(url, location.href);
      this.__efhcBlocked = !(isTonBridge(parsed) && ['GET','POST'].includes(String(method).toUpperCase())) &&
        (parsed.origin !== location.origin ||
         !['GET','HEAD'].includes(String(method).toUpperCase()) ||
         parsed.pathname.startsWith('/api/') || parsed.pathname.startsWith(base+'/api/'));
    } catch (_) {}
    if (!this.__efhcBlocked) return nativeOpen.apply(this, arguments);
    return nativeOpen.call(this, 'GET', 'data:application/json,{"detail":"EFHC_DEMO_READ_ONLY"}', true);
  };
  XMLHttpRequest.prototype.send = function() {return nativeSend.apply(this,arguments);};
  try { navigator.sendBeacon = function(){return false;}; } catch (_) {}
  window.WebSocket = function(url) {
    try {
      var value = new URL(url, location.href);
      if (value.protocol === 'wss:' && tonBridgeOrigins.has('https://' + value.host) &&
          (value.pathname.startsWith('/bridge') || value.pathname.startsWith('/events'))) {
        return new nativeWebSocket(url);
      }
    } catch (_) {}
    throw new Error('EFHC_DEMO_NETWORK_DISABLED');
  };
  window.EventSource = function(url, options) {
    try {if (isTonBridge(new URL(url, location.href))) return new nativeEventSource(url, options);} catch (_) {}
    throw new Error('EFHC_DEMO_NETWORK_DISABLED');
  };
  var nativeWindowOpen = window.open;
  window.open = function(url) {
    try {
      var dest = new URL(url || '',location.href);
      if (dest.origin !== location.origin && !canLaunchWallet(dest)) return null;
    } catch (_) {return null;}
    return nativeWindowOpen.apply(window,arguments);
  };
  document.addEventListener('click',function(event) {
    var target=event.target;
    var a=target && target.closest && target.closest('a[href]');
    if (!a) return;
    try {
      var url=new URL(a.href,location.href);
      if ((url.origin !== location.origin || (!url.pathname.startsWith(base+'/') && url.pathname !== base)) &&
          !canLaunchWallet(url)) {
        event.preventDefault(); event.stopPropagation();
      }
    } catch(_) {event.preventDefault();}
  },true);
  try {
    if(navigator.serviceWorker) {
      navigator.serviceWorker.register = function(){return Promise.reject(new Error('EFHC_DEMO_NO_SERVICE_WORKER'));};
    }
  } catch(_) {}
})();
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
    # Pages-only behavior is selected by NEXT_PUBLIC_EFHC_PAGES_PREVIEW.
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
    # Remove Telegram SDK remote script; mock mode has no external network.
    content = content.replace('<script src="https://telegram.org/js/telegram-web-app.js" async />', '')
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
    # The packaged browser demo never receives live service URLs.
    print(f'EFHC_PAGES_TEMP_BUILD_READY base={base!r} source={source} target={target}')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as exc:
        print(f'EFHC_PAGES_PREPARE_FAIL: {exc}', file=sys.stderr)
        raise SystemExit(1)
