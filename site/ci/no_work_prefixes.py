#!/usr/bin/env python3
"""Reject additions of work-number identities; retain existing debt in place."""

import argparse
from collections import Counter
import json
from pathlib import Path
import re
import subprocess
import sys


POLICY_PATH = 'site/ci/work-prefix-exceptions.json'
TOKEN = re.compile(r'[A-Za-z_$][A-Za-z0-9_$]*(?:[-.][A-Za-z0-9_$]+)*')
SEGMENT = re.compile(
    r'(?:^|[-_.])(?:v|cycles?|iterations?|iter|it|revision|rev|release|build|patch)[_-]?\d+'
    r'|(?:^|[-_.])(?:c\d{2,}|i\d{2,})', re.IGNORECASE,
)
CAMEL = re.compile(r'(?<=[a-z0-9])(?:V\d+|C\d{2,}|I\d{2,}|Cycle[_-]?\d+|Iteration[_-]?\d+|Revision[_-]?\d+|Release[_-]?\d+|Build[_-]?\d+|Patch[_-]?\d+)')
DOM_WORK_VALUE = re.compile(
    r'(data-[\w-]*(?:cycle|iteration|version|revision)[\w-]*)\s*=\s*'
    r'(?:[\"\']([vV]?\d+)[\"\']|\{(\d+)\})', re.IGNORECASE,
)
SOURCE_SUFFIXES = {'.py', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html', '.json', '.yml', '.yaml', '.sh'}
QUOTED_HASH = re.compile(r'([\"\'])[a-f0-9]{40}(?:[a-f0-9]{24})?\1', re.IGNORECASE)
COLOR_VALUE = re.compile(r'(?<=:)\s*#(?:[a-f0-9]{8}|[a-f0-9]{6}|[a-f0-9]{4}|[a-f0-9]{3})(?![\w-])', re.IGNORECASE)


def git(*args):
    return subprocess.check_output(['git', *args])


def resolve(ref):
    # Resolve before constructing any object specifications. No shell evaluation.
    return git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}').decode().strip()


def tree(ref):
    result = {}
    for record in git('ls-tree', '-r', '-z', ref).split(b'\0'):
        if record:
            metadata, path = record.split(b'\t', 1)
            mode, kind, sha = metadata.decode().split()
            result[path.decode('utf-8')] = (mode, kind, sha)
    return result


def blob(entry):
    if entry[1] != 'blob':
        raise ValueError('unreviewed submodule cannot bypass identifier inspection')
    return git('cat-file', 'blob', entry[2])


def read_policy(ref):
    raw = git('show', ref + ':' + POLICY_PATH)
    policy = json.loads(raw)
    if policy.get('schema') != 1 or set(policy) != {'schema', 'exceptions'}:
        raise ValueError('invalid exception policy')
    for item in policy['exceptions']:
        if set(item) != {'path', 'literal', 'kind', 'reason'}:
            raise ValueError('exception must specify exact path, literal, kind and reason')
        if not item['reason'].strip() or not item['literal'] or any(x in item['path'] for x in ('*', '?', '..')):
            raise ValueError('blanket/undocumented exceptions are forbidden')
        if item['kind'] == 'external-action':
            if not re.fullmatch(r'[\w-]+/[\w./-]+@v\d+(?:\.\d+)*', item['literal']):
                raise ValueError('invalid external action version exception')
        elif item['kind'] == 'protocol':
            if not re.fullmatch(r'/[\w/-]+/v\d+/?|https://[^\s]+', item['literal']):
                raise ValueError('protocol exception must be an exact external address or API path')
        elif item['kind'] != 'historical-source':
            raise ValueError('unknown exception kind')
    return policy


def identities(path, content, policy):
    found = Counter()
    for part in path.split('/'):
        if SEGMENT.search(part) or CAMEL.search(part):
            found['path:' + part] += 1
    try:
        text = content.decode('utf-8')
    except UnicodeDecodeError:
        if Path(path).suffix.lower() in SOURCE_SUFFIXES:
            raise ValueError('non-UTF-8 working source cannot be inspected')
        return found
    if '\0' in text:
        if Path(path).suffix.lower() in SOURCE_SUFFIXES:
            raise ValueError('NUL in working source cannot bypass inspection')
        return found
    # This metadata file is validated from the trusted ref, not excluded by glob.
    # Candidate edits to policy are rejected separately, including new exemptions.
    if path == POLICY_PATH:
        return found
    for item in policy['exceptions']:
        if path == item['path']:
            text = text.replace(item['literal'], '')
    # Full quoted Git/SHA checksums and CSS declaration values are data, not
    # work-number identities. Selectors/function names are still inspected.
    text = QUOTED_HASH.sub('"checksum"', text)
    text = COLOR_VALUE.sub(' color', text)
    for match in TOKEN.finditer(text):
        token = match.group()
        if SEGMENT.search(token) or CAMEL.search(token):
            found['identifier:' + token] += 1
    for match in DOM_WORK_VALUE.finditer(text):
        found['attribute:' + match[1] + '=' + (match[2] or match[3])] += 1
    return found


def inspect(base, head, policy_ref):
    old, new = tree(base), tree(head)
    policy = read_policy(policy_ref)
    failures = []
    checked = 0
    # A PR cannot grant itself exceptions. Initial installation is the only case
    # in which the trusted policy ref is the candidate, pinned by the workflow.
    if new.get(POLICY_PATH) != tree(policy_ref).get(POLICY_PATH):
        failures.append({'path': POLICY_PATH, 'identity': 'exception policy changed; requires separate OWNER-controlled installation', 'added': 1})
    for path, entry in new.items():
        if old.get(path) == entry:
            continue
        checked += 1
        current = identities(path, blob(entry), policy)
        previous = identities(path, blob(old[path]), policy) if path in old else Counter()
        for identity, count in (current - previous).items():
            failures.append({'path': path, 'identity': identity, 'added': count})
    return {'guard': 'NO_WORK_PREFIXES', 'base': base, 'head': head,
            'checked_files': checked, 'status': 'FAIL' if failures else 'PASS', 'violations': failures}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', required=True)
    parser.add_argument('--head', default='HEAD')
    parser.add_argument('--policy-ref', help='trusted ref; defaults to base')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    try:
        base, head = resolve(args.base), resolve(args.head)
        result = inspect(base, head, resolve(args.policy_ref or args.base))
    except (ValueError, KeyError, UnicodeError, subprocess.CalledProcessError) as error:
        print('NO_WORK_PREFIXES FAIL: inspection could not complete (' + type(error).__name__ + ')', file=sys.stderr)
        return 2
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.report:
        args.report.write_text(encoded)
    print(encoded, end='')
    return 1 if result['violations'] else 0


if __name__ == '__main__':
    sys.exit(main())
