#!/usr/bin/env python3
"""EFHC Pages nonblocking quality evidence: execute available checks, never claim missing backend was scanned.

This runner is imported from REPO ZIP via frontend/src/. It has no secrets, no network
integration and no write access to the application source. Security scans are diagnostics,
not production-release qualification.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

SCHEMA = 'efhc.pages.quality-evidence.v1'
SENSITIVE = re.compile(r'(?i)(password|token|secret|authorization|api[_-]?key)\s*[:=]\s*([^\s,;]+)')


def check(name: str, command: list[str] | None, cwd: Path, output: Path, timeout: int = 180, reason: str = '') -> dict:
    output.mkdir(parents=True, exist_ok=True)
    result = {'check': name, 'status': 'NOT_AVAILABLE', 'command': command or [], 'reason': reason, 'duration_sec': 0}
    if command is None:
        (output / f'{name}.log').write_text('NOT_AVAILABLE: '+reason+'\n', encoding='utf-8')
        return result
    executable = shutil.which(command[0])
    if executable is None and command[0] != sys.executable:
        result['status'] = 'TOOL_ERROR'
        result['reason'] = 'Required executable is not installed'
        (output / f'{name}.log').write_text(result['reason']+'\n', encoding='utf-8')
        return result
    started = time.monotonic()
    try:
        proc = subprocess.run(command, cwd=cwd, capture_output=True, text=True, errors='replace', timeout=timeout, env={**os.environ, 'PIP_DISABLE_PIP_VERSION_CHECK': '1'})
        result['status'] = 'PASS' if proc.returncode == 0 else 'FAIL'
        result['exit_code'] = proc.returncode
        log = (proc.stdout or '') + ('\n[stderr]\n' + proc.stderr if proc.stderr else '')
    except subprocess.TimeoutExpired as exc:
        result['status'] = 'TOOL_ERROR'; result['reason'] = f'timeout after {timeout} seconds'
        log = str(exc)
    except OSError as exc:
        result['status'] = 'TOOL_ERROR'; result['reason'] = exc.__class__.__name__
        log = str(exc)
    result['duration_sec'] = round(time.monotonic()-started, 2)
    log = SENSITIVE.sub(lambda m: m.group(1) + '=***REDACTED***', log)
    if len(log) > 500000:
        log = log[:250000] + '\n[TRUNCATED: inspect original tool output in Actions logs]\n' + log[-250000:]
    (output / f'{name}.log').write_text(log+'\n', encoding='utf-8')
    return result


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--phase', choices=('prebuild','postbuild'), required=True)
    parser.add_argument('--frontend', type=Path, required=True)
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--logs', type=Path, required=True)
    args=parser.parse_args()
    frontend=args.frontend.resolve(); repo=args.repo.resolve(); logs=args.logs.resolve()
    logs.mkdir(parents=True, exist_ok=True)
    if not frontend.is_dir(): raise SystemExit('Frontend build directory absent: cannot collect diagnostics')
    results=[]
    def run(name,command,cwd=frontend,timeout=180,reason=''):
        row=check(name,command,cwd,logs,timeout,reason)
        results.append(row)
        print('EFHC_QUALITY_CHECK='+json.dumps(row,ensure_ascii=False,sort_keys=True),flush=True)
    backend=next((p for p in (repo/'site/backend', repo/'site/ci/backend', repo/'backend') if (p/'app').is_dir()),None)
    tools=repo/'site/ci/pages-tools'
    if not tools.is_dir(): tools=repo/'frontend/src/reconstruction'  # local FULL check
    if args.phase=='prebuild':
        run('frontend-typecheck',['npm','run','typecheck'],timeout=240)
        run('frontend-tonconnect-regression',['npm','run','test:tonconnect-update-acceptance'],timeout=240)
        run('npm-dependency-audit',['npm','audit','--audit-level=high','--json'],timeout=150)
        pyfiles=sorted(str(p) for p in tools.glob('*.py'))
        pyfiles+=sorted(str(p) for p in (repo/'site/frontend/src/reconstruction').glob('ci_predeploy_diagnostics.py'))
        pyfiles=list(dict.fromkeys(pyfiles))
        if not pyfiles: pyfiles=[str(Path(__file__).resolve())]
        run('pages-python-compile',[sys.executable,'-m','py_compile',*pyfiles],cwd=repo)
        for name,cmd in (
            ('pages-flake8',['flake8','--isolated','--max-line-length=120',*pyfiles]),
            ('pages-bandit',['bandit','-q',*pyfiles]),
            ('pages-ruff',['ruff','check','--isolated',*pyfiles]),
        ): run(name,cmd,cwd=repo,timeout=120)
        if backend is None:
            for name in ('backend-compile','backend-bandit','backend-flake8','backend-ruff','backend-mypy','backend-pip-audit','backend-pytest'):
                run(name,None,cwd=repo,reason='Full backend/tests are absent from public Test-3 ZIP importer; run private full CI on FULL source')
        else:
            app=backend/'app'
            run('backend-compile',[sys.executable,'-m','compileall','-q',str(app)],cwd=repo)
            run('backend-bandit',['bandit','-q','-r',str(app)],cwd=repo,timeout=180)
            run('backend-flake8',['flake8','--isolated','--max-line-length=120',str(app)],cwd=repo,timeout=180)
            run('backend-ruff',['ruff','check',str(app)],cwd=repo,timeout=180)
            run('backend-mypy',['mypy','--no-incremental',str(app)],cwd=repo,timeout=240)
            lock=backend/'requirements.lock'
            run('backend-pip-audit',['pip-audit','-r',str(lock),'--disable-pip','--no-deps','--strict'] if lock.exists() else None,cwd=repo,timeout=240,reason='backend/requirements.lock missing')
            tests=next((p for p in (repo/'site/tests',repo/'tests') if p.is_dir()),None)
            run('backend-pytest',[sys.executable,'-m','pytest','-q',str(tests)] if tests else None,cwd=repo,timeout=360,reason='Backend tests absent; no full integration qualification')
    else:
        run('frontend-performance-budgets',['npm','run','performance-budgets'],timeout=180)
        run('frontend-release-assets',['npm','run','release-assets:verify'],timeout=180)
    data={'schema':SCHEMA,'phase':args.phase,'backend_source_present':backend is not None,'checks':results,
          'totals':{s:sum(r['status']==s for r in results) for s in ['PASS','FAIL','TOOL_ERROR','NOT_AVAILABLE']}}
    (logs/f'quality-{args.phase}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('EFHC_QUALITY_PHASE_SUMMARY='+json.dumps(data['totals'],sort_keys=True))
    return 1 if any(r['status'] in ('FAIL','TOOL_ERROR') for r in results) else 0


if __name__=='__main__':
    raise SystemExit(main())
