"""Original rubber friction and launch thwack, 3 deterministic takes. No voice recording."""
from pathlib import Path
import numpy as np
import wave,json
R=Path(__file__).resolve().parent;SR=48000
out=R/'ready';out.mkdir(exist_ok=True)
stats=[]
for key,duration in [('rubber-pull',.18),('rubber-release',.25)]:
    for take in range(1,4):
        rng=np.random.default_rng(8400+take+(100 if key=='rubber-release' else 0))
        t=np.arange(round(duration*SR))/SR;u=t/duration
        n=rng.normal(size=len(t))
        f=np.fft.rfftfreq(len(t),1/SR)
        noise=np.fft.irfft(np.fft.rfft(n)*(1-np.exp(-(f/600)**4))*np.exp(-(f/4200)**4),n=len(t))
        if key=='rubber-pull':
            # Stick-slip rubber chatter: irregular friction, moving formants, brief and dry.
            freq=390+210*u+35*np.sin(2*np.pi*29*t)
            phase=2*np.pi*np.cumsum(freq)/SR
            chatter=.6+.4*np.sin(2*np.pi*(48*t+24*t*t))**2
            sig=(.12*np.sin(phase)+.07*np.sin(phase*2.08)+.12*noise)*chatter
            sig*=np.sin(np.pi*u)**.8
        else:
            # Broad smack + short low rubber/body resonance; no rising launch laser.
            phase=2*np.pi*np.cumsum(280*np.exp(-t/.024)+85)/SR
            sig=.34*np.sin(phase)*np.exp(-t/.032)+.32*noise*np.exp(-t/.010)
            sig+=.085*np.sin(2*np.pi*740*t)*np.exp(-t/.020)
            sig+=.025*noise*np.exp(-((t-.035)/.023)**2)
        sig*=rng.uniform(.94,1.03);sig-=sig.mean()
        fade=round(.003*SR);sig[:fade]*=np.linspace(0,1,fade);sig[-fade:]*=np.linspace(1,0,fade)
        assert max(abs(sig))<.85
        pcm=np.round(sig*32767).astype('<i2').tobytes();path=out/f'{key}-{take}.wav'
        if path.exists():
            with wave.open(str(path),'rb') as w: assert w.readframes(w.getnframes())==pcm
        else:
            with wave.open(str(path),'wb') as w:
                w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm)
        stats.append({'file':path.name,'seconds':duration,'peakDb':float(20*np.log10(max(abs(sig))))})
(R/'manifest.json').write_text(json.dumps(stats,indent=2)+'\n')
print('6 rubber gesture takes generated and checked; no vocal cheer.')
