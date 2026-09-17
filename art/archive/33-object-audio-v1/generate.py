"""Original deterministic procedural foley. No recordings, downloads or API calls.
Run from any cwd. Exports mono 48 kHz PCM16, three variations per object.
Never changes game audio. Review and Claude integration only.
"""
from pathlib import Path
import hashlib, json, wave
import numpy as np

ROOT = Path(__file__).resolve().parent
SR = 48000
SPECS = [
    ('keys','House keys + fob','Irregular brass key jangle with a dull plastic fob tap.','metal',2600,.32),
    ('bottle-opener','Bottle opener','Short low steel clank, followed by a small chain tick.','metal',1300,.23),
    ('disco-ball','Disco ball','Light glassy tile tinks and a tiny mounting-chain rattle; no melody.','glass',3400,.24),
    ('rubber-duck','Rubber duck','Air-driven toy squeaker: nasal squeeze and release.','duck',820,.32),
    ('bead-lanyard','Wooden bead lanyard','Dry uneven wooden beads, with a light badge slap.','wood',760,.24),
    ('carabiner-whistle','Carabiner + whistle','Hollow metal whistle body clack and spring-gate tick, not a blown whistle.','metal',1800,.19),
    ('wind-chime','Three-tube wind chime','Three irregular tube strikes with long inharmonic decay; no scale run.','chime',980,1.25),
    ('baby-shoe','Baby shoe on ribbon','Soft rubber-sole tap and cloth/ribbon shuffle, not a bell.','cloth',420,.20),
    ('scissors','Scissors','Loose steel blades chatter against each other, with a short pivot scrape.','scissors',2200,.28),
    ('measuring-spoons','Measuring spoons','Several hollow stainless cups collide and settle at different pitches.','spoons',1650,.42),
    ('souvenir-spoon','Souvenir spoon','One fine silver spoon ting with a faint chain tick.','metal',3100,.35),
    ('fishing-lure','Fishing lure','Tiny internal pellets rattle against a hard lure body; small hook tick.','lure',2400,.28),
    ('lemon','Lemon charm','Resin lemon tock with a small split-ring jingle; no wet fruit sound.','resin',680,.18),
    ('trail','Trail keyring','Boot charm knocks against the metal compass; dry mixed-material rattle.','trail',1000,.25),
    ('star','Glitter star keyring','Light hard-acrylic tick with split-ring chatter; no magic chime.','resin',1700,.16),
    ('donut','Donut toy','Soft hollow vinyl squeeze/tap, not a bell or eating sound.','rubber',520,.20),
    ('robot','Robot toy','Tiny mechanical servo chirrup with a hard body click.','robot',650,.31),
    ('dino','Dinosaur toy','Small raspy toy growl with a rubber body tap.','dino',160,.40),
    ('penguin','COOL penguin toy','Short rubber squeaker chirp with a soft body knock.','penguin',1050,.19),
    ('taxi','Taxi toy','Small two-tone car horn over a toy body click; no musical two-note jingle.','taxi',410,.27),
    ('race-car','Race-car toy','Brief raspy toy-engine rev, rises then drops.','engine',150,.42),
    ('banana','Banana toy','Dull flexible rubber flap and thump, no spring boing.','rubber',360,.20),
    ('space-shuttle','Space shuttle toy','Compact air/rocket burst with a hard plastic body tap.','rocket',600,.35),
    ('letter-block','Wooden letter block','Solid dry wood-on-wood clonk.','wood',560,.15),
    ('plastic-brick','Plastic brick','Hollow ABS clack with a brief higher tick.','plastic',1300,.14),
    ('gummy-bear','Gummy bear toy','Short tacky rubber squish and release, not a cartoon boing.','rubber',720,.23),
    ('pop-out','POP bubble outward','Crisp silicone snap as a bubble pops outward.','pop',760,.11),
    ('pop-in','POP bubble inward','Lower hollow silicone plop as a bubble pushes inward.','pop',450,.13),
    ('fidget-spinner','Fidget spinner','Dry rolling ball bearings, fast irregular ticks and friction, slowing to a stop.','bearing',1700,1.45),
    ('pinwheel','Paper pinwheel','Light fluttering paper and air, slowing as it coasts.','flutter',2200,.66),
    ('alphabet-rotor','Plastic alphabet magnets','Short moulded-plastic click, no motor noise.','plastic',950,.14),
    ('clock','Clock magnet','Small rigid case rattle and glass-front tap, no alarm.','glass',2500,.18),
    ('thermometer','Dial thermometer','Tin casing tick with a little face-plate rattle.','metal',2300,.19),
]

def render(spec, variant):
    key,label,description,kind,base,duration=spec
    seed=int.from_bytes(hashlib.sha256(f'{key}/{variant}'.encode()).digest()[:8],'little')
    rng=np.random.default_rng(seed)
    length=duration+.18
    out=np.zeros(round(length*SR), dtype=np.float64)
    variation=rng.uniform(.965,1.035)

    def add(signal, at=0, gain=1):
        offset=round(at*SR); count=min(len(signal),len(out)-offset)
        if count>0: out[offset:offset+count]+=signal[:count]*gain

    def filtered_noise(n,low,high):
        raw=rng.normal(0,1,n)
        freqs=np.fft.rfftfreq(n,1/SR)
        # Smooth band limits prevent brick-wall ringing.
        lo=1-np.exp(-(freqs/max(1,low))**4)
        hi=np.exp(-(freqs/high)**4)
        data=np.fft.irfft(np.fft.rfft(raw)*lo*hi,n=n)
        return data/(np.sqrt(np.mean(data*data))+1e-9)

    def burst(at,dur,low,high,gain):
        t=np.arange(round(dur*SR))/SR
        env=(1-np.exp(-t/.001))*np.exp(-t/(dur/5))
        add(filtered_noise(len(t),low,high)*env,at,gain)

    def strike(at,freq,decay,gain,material='metal'):
        t=np.arange(round(min(decay*6,length-at)*SR))/SR
        ratios={'metal':[1,1.47,2.09,2.71,3.91], 'wood':[1,2.71,4.12],
                'glass':[1,2.32,3.87,5.23], 'plastic':[1,1.91,3.17]}[material]
        sig=np.zeros_like(t)
        for i,ratio in enumerate(ratios):
            f=freq*ratio*variation*rng.uniform(.989,1.011)
            if f>16000: continue
            sig+=np.sin(2*np.pi*f*t)*np.exp(-t/(decay/(1+i*.48)))/(1+i*.85)
        sig*=1-np.exp(-t/.0008)
        add(sig,at,gain)
        burst(at,.018,1100,9000,gain*.16)

    def voiced(at,dur,f0,f1,gain,nasal=False,rasp=0):
        t=np.arange(round(dur*SR))/SR; u=t/dur
        freq=(f0+(f1-f0)*np.sin(np.pi*u))*variation
        phase=2*np.pi*np.cumsum(freq)/SR
        signal=np.sin(phase)+(.38 if nasal else .12)*np.sin(phase*2)+(.2 if nasal else .06)*np.sin(phase*3)
        if rasp: signal=(signal+filtered_noise(len(t),150,3500)*rasp)*( .75+.25*np.sin(2*np.pi*47*t))
        env=np.minimum(1,t/.009)*np.minimum(1,(dur-t)/.035)*np.sin(np.pi*u)**.6
        add(signal*env,at,gain)

    if kind in ('metal','glass','chime','spoons'):
        count={'metal':4 if key=='keys' else 2,'glass':3,'chime':3,'spoons':6}[kind]
        times=np.cumsum(np.r_[0,rng.uniform(.029,.085,count-1)])
        for i,at in enumerate(times):
            freq=base*rng.uniform(.72,1.5)
            decay=.22 if kind=='chime' else (.07 if kind in ('metal','spoons') else .055)
            if kind=='spoons': freq=base*[.71,1.0,1.28,.83,1.62,1.08][i]
            strike(at,freq,decay,.18*(.80**i),'glass' if kind=='glass' else 'metal')
        if key=='keys': strike(.015,510,.023,.1,'plastic')
    elif kind in ('wood','plastic','resin','trail','lure','scissors'):
        count={'wood':5 if key=='bead-lanyard' else 2,'plastic':2,'resin':2,'trail':4,'lure':8,'scissors':3}[kind]
        for i in range(count):
            at=i*rng.uniform(.018,.032)
            material='wood' if kind=='wood' else ('metal' if kind=='scissors' else 'plastic')
            strike(at,base*rng.uniform(.7,1.45),.015 if kind!='scissors' else .028,.16*.77**i,material)
        if kind in ('trail','resin','lure'): strike(.035,3800,.025,.023)
        if kind=='scissors': burst(.04,.09,1200,6800,.065)
    elif kind=='cloth':
        strike(0,base,.019,.12,'plastic');burst(.028,.15,600,5000,.075)
    elif kind in ('duck','penguin'):
        voiced(0,duration,base,base*1.42,.17,True,.035)
        burst(.007,.045,1800,6400,.045)
    elif kind=='robot':
        strike(0,1300,.012,.10,'plastic')
        voiced(.03,.09,660,1040,.11,True)
        voiced(.16,.11,860,610,.10,True)
        burst(.02,.19,1300,3500,.025)
    elif kind=='dino':
        voiced(.015,.36,base,base*1.35,.20,True,.42)
        strike(0,440,.02,.08,'plastic')
    elif kind=='taxi':
        strike(0,720,.016,.07,'plastic')
        for at,dur in [(0,.09),(.125,.135)]:
            voiced(at,dur,base,base*1.005,.12,True)
            voiced(at,dur,base*1.235,base*1.24,.075,True)
    elif kind=='engine':
        voiced(0,duration,base,base*2.3,.18,True,.18)
        burst(.015,.32,500,4800,.065)
    elif kind=='rocket':
        burst(.015,.32,350,7000,.16);strike(0,950,.018,.09,'plastic')
    elif kind=='rubber':
        strike(0,base,.026,.13,'plastic')
        burst(.02,.12,500,2200,.09)
        strike(.10,base*.8,.014,.05,'plastic')
    elif kind=='pop':
        t=np.arange(round(duration*SR))/SR
        phase=2*np.pi*np.cumsum(base*np.exp(-t/.025))/SR
        add(np.sin(phase)*np.exp(-t/.019)*(1-np.exp(-t/.0007)),gain=.28)
        burst(0,.02,1400,6000,.075)
    elif kind=='bearing':
        t=np.arange(round(duration*SR))/SR; u=t/duration
        # No swept musical oscillator: wide dry friction + uneven ball-pass contacts.
        envelope=np.minimum(1,t/.025)*(1-u)**1.3
        speed=105*(1-u)**1.6+7
        rotation=np.cumsum(speed)/SR
        chatter=.48+.30*np.cos(2*np.pi*rotation)+.13*np.cos(2*np.pi*rotation*1.073)
        add(filtered_noise(len(t),700,5200)*envelope*chatter,gain=.14)
        at=.01
        while at<duration-.10:
            strike(at,rng.uniform(1800,3600),.0035,.038*(1-at/duration),'metal')
            at+=rng.uniform(.009,.017)/(max(.13,1-at/duration))
        strike(duration-.08,1150,.011,.022,'plastic')
    elif kind=='flutter':
        t=np.arange(round(duration*SR))/SR; u=t/duration
        pulses=(.5+.5*np.sin(2*np.pi*np.cumsum(27*(1-u)+4)/SR))**3
        add(filtered_noise(len(t),500,7000)*pulses*(1-u)*np.minimum(1,t/.012),gain=.12)
    # Every file shares one gain, preserving material loudness relationships.
    # No per-file peak normalization (it would amplify cloth to match a horn).
    out-=out.mean()
    out*=.8
    fade=min(round(.006*SR),len(out)//2)
    out[:fade]*=np.linspace(0,1,fade);out[-fade:]*=np.linspace(1,0,fade)
    if np.max(np.abs(out))>.9: raise ValueError(f'Unsafe peak: {key}')
    return out

def main():
    dest=ROOT/'ready';dest.mkdir(exist_ok=True)
    records=[]
    for spec in SPECS:
        key,label,description,kind,base,duration=spec
        files=[]
        for variant in range(1,4):
            samples=render(spec,variant)
            path=dest/f'{key}-{variant}.wav'
            # Immutable: reruns verify instead of silently overwriting.
            pcm=np.round(samples*32767).astype('<i2').tobytes()
            if path.exists():
                with wave.open(str(path),'rb') as f: assert f.readframes(f.getnframes())==pcm, path
            else:
                with wave.open(str(path),'wb') as f:
                    f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR);f.writeframes(pcm)
            files.append({'file':f'ready/{path.name}','seconds':len(samples)/SR,
                          'peakDb':round(float(20*np.log10(max(abs(samples)))),2),
                          'rmsDb':round(float(20*np.log10(np.sqrt(np.mean(samples*samples)))),2),
                          'sha256':hashlib.sha256(pcm).hexdigest()})
        records.append({'id':key,'label':label,'description':description,'variants':files})
    (ROOT/'manifest.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf-8')
    print(f'{len(records)} sound identities; {len(records)*3} PCM WAV files. No clipped peaks.')

if __name__=='__main__': main()
