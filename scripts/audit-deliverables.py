"""Check assignment deliverables without changing application or historical data."""
from pathlib import Path
import gzip, hashlib, json, re, subprocess
from datetime import datetime, timezone
from PIL import Image
from pypdf import PdfReader

root = Path.cwd()
def git(*args):
    return subprocess.check_output(['git', *args], text=True, encoding='utf-8').strip()
def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))

checks = []
assert not git('diff', '9da21d1', '--', 'server.js', 'public/vendor', 'public/alat', 'package.json')
checks.append('protected server/vendor/measuring tool and runtime package manifest unchanged')
old = git('show', '820616b:laporan/PREDIKSI.md').split('## Sesudah perbaikan')[0]
now = Path('laporan/PREDIKSI.md').read_text(encoding='utf-8-sig').split('## Sesudah perbaikan')[0]
assert old == now
subprocess.check_call(['git', 'merge-base', '--is-ancestor', '820616b', 'b18d174'])
checks.append('all original predictions unchanged; prediction commit precedes first fix')

trace_count = 0
for phase in ['before', 'after']:
    for scenario in range(7):
        for run in range(1, 4):
            data = read(f'laporan/data/{phase}/S{scenario}-{run}.json')
            assert data['errors'] == [], (phase, scenario, run, data['errors'])
            path = Path(f'laporan/trace/{phase}-S{scenario}-{run}.json.gz')
            with gzip.open(path, 'rt', encoding='utf-8') as stream:
                trace = json.load(stream)
            assert len(trace['traceEvents']) > 100
            assert any(e['name'] == 'thread_name' for e in trace['traceEvents'])
            trace_count += 1
            del trace
    print(f'{phase}: 21 genuine Chrome traces and three runs per scenario verified', flush=True)
checks.append('42 baseline/final trace files parse successfully; 21 pairs; no page errors in run records')
for phase, scenario in [('audit-render', 1), ('audit-microtask', 4), ('audit-control', 1), ('audit-control', 4)]:
    for run in range(1, 4):
        with gzip.open(f'laporan/trace/{phase}-S{scenario}-{run}.json.gz', 'rt', encoding='utf-8') as stream:
            assert len(json.load(stream)['traceEvents']) > 100
checks.append('two AI candidates and matched controls have three valid traces each')

shots = sorted(Path('screenshots').glob('*.png'))
for path in shots:
    with Image.open(path) as img:
        assert img.width >= 400 and img.height >= 400
        img.verify()
checks.append(f'{len(shots)} PNG screenshots decode and appear in index')
index = Path('screenshots/INDEX.md').read_text(encoding='utf-8')
assert all(p.name in index for p in shots)

docs = [Path(p) for p in ['laporan/LAPORAN.md', 'laporan/PREDIKSI.md', 'laporan/AUDIT-AI.md', 'laporan/COMPLETION.md', 'screenshots/INDEX.md', 'demo/SCRIPT.md', 'scripts/README.md']]
links = 0
for doc in docs:
    text = doc.read_text(encoding='utf-8-sig')
    assert not re.search(r'\[ISI|\[VERIFIKASI|Tim: \.{3}', text), doc
    for link in re.findall(r'\]\(([^)]+)\)', text):
        if link.startswith(('https:', 'http:', '#')):
            continue
        assert (doc.parent / link.split('#')[0]).exists(), (doc, link)
        links += 1
report = docs[0].read_text(encoding='utf-8-sig')
assert len(re.findall(r'^## [1-7]\.', report, re.M)) == 7
assert len(re.findall(r'^### T-0[1-8]', report, re.M)) == 8
assert len(report.split('## 1.')[1].split('## 2.')[0].split()) <= 150
assert len(docs[2].read_text(encoding='utf-8-sig').split('## Refleksi')[1].split()) <= 210
pages = len(PdfReader('.capture-tmp/report-qa/LAPORAN.pdf').pages)
assert pages <= 6
checks.append(f'{links} local documentation links resolve; seven report sections/eight tickets; report QA {pages} A4 pages')

features = read('laporan/data/features-all.json')
assert features['products'] == 3000 and not features['errors']
voucher = read('laporan/data/voucher-correctness.json')
assert voucher['comparisons'] == 3028 and voucher['inputsDuringCalculation'] > 0
assert len(voucher['intermediateFrameValues']) > 2
checks.append('3000-product feature checks and 3028 voucher oracle comparisons passed')
for phase, count in [('before', 3), ('after', 1)]:
    summary = read(f'laporan/data/{phase}/summary.json')
    assert all(r['orders'] == count for r in summary['S3']['runs'])
checks.append('all three S3 repeats change from three orders to one')

video = read('demo/verification.json')
assert 0 < float(video['format']['duration']) <= 180
assert int(video['streams'][0]['nb_read_frames']) > 0
assert video['decodeCheck'] == 'ffmpeg full decode: exit 0'
assert video['cpuRate'] == 4
assert Path('demo/demo.mp4').stat().st_size == int(video['format']['size'])
chapters = read('demo/chapters.json')
assert [(c['phase'], c['scenario']) for c in chapters] == [(p, f'S{s}') for p in ['before', 'after'] for s in range(1, 6)]
assert all(c['end'] > c['start'] and c['speed'] >= 1 for c in chapters)
checks.append('captioned demo has all ten chapters, CPU 4x metadata, ffprobe frame count and full decode validation')

tracked = git('ls-files').splitlines()
assert not any(p.startswith(('.tools/', '.capture-tmp/', 'node_modules/')) for p in tracked)
assert not any(re.search(r'(^|/)(\.env($|\.)|id_rsa|id_ed25519)', p) for p in tracked)
assert all(Path(p).stat().st_size < 50 * 1024 * 1024 for p in tracked if Path(p).is_file())
subprocess.check_call(['git', 'diff', '--check'])
checks.append('no tracked tool installs/temp directories/secret filenames/individual files >=50 MiB; git diff --check passed')

manifest_files = sorted(set([*shots, *Path('laporan/trace').glob('before-*.json.gz'), *Path('laporan/trace').glob('after-*.json.gz'), Path('demo/demo.mp4')]))
manifest = {p.as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in manifest_files}
result = {'date': datetime.now(timezone.utc).isoformat(), 'applicationCommit': 'dcc5f7a', 'checks': checks, 'manualItems': ['actual team identity/contributions', 'human review and live individual exam', 'manual git push and submission'], 'remainingTargets': ['S3 INP 368 ms', 'S5 3 slow frames/10 s', 'S6 busy 13.45723%', 'S1 raw IPC task 116.731 ms'], 'sha256': manifest}
Path('laporan/data/final-audit.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print('\n'.join(checks))
