"""Asset/mapping QA, not a claim of listening validation."""
from pathlib import Path
import json,wave,hashlib
import numpy as np
R=Path(__file__).resolve().parent
records=json.loads((R/'manifest.json').read_text())
hashes=set()
for r in records:
    assert len(r['variants'])==3
    for v in r['variants']:
        with wave.open(str(R/v['file']),'rb') as f:
            assert (f.getnchannels(),f.getsampwidth(),f.getframerate())==(1,2,48000)
            pcm=f.readframes(f.getnframes())
        h=hashlib.sha256(pcm).hexdigest();assert h==v['sha256'] and h not in hashes
        hashes.add(h)
        a=np.frombuffer(pcm,dtype='<i2').astype(float)/32767
        assert .1<len(a)/48000<2
        assert 0.015<max(abs(a))<.9
        assert abs(a[0])<.0001 and abs(a[-1])<.0001
        assert abs(a.mean())<.001
        assert np.sqrt(np.mean(a*a))>.001
mapping=json.loads((R/'item-map.json').read_text())
ids={r['id'] for r in records}
assert all(x in ids for x in mapping['items'].values())
assert all(x in ids for x in mapping['bubbleEvents'].values())
assert mapping['items']['rotor-fidget-spinner']=='fidget-spinner'
assert all(f'swing-toy-{i}' in mapping['items'] for i in range(13))
assert all(f'bumper-{i}' in mapping['items'] for i in range(13))
print(f'PASS: {len(hashes)} distinct, valid WAVs; levels, fades, DC, maps, POP and spinner checks.')
