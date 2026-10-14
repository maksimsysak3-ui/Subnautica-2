#!/usr/bin/env python3
"""Pixel-art player frames for the live game (src/ui/field/frames.json).

Every frame is a 16x20 grid facing right, feet on the bottom row, body centred on
column 8. The palette letters match src/ui/field/pixel.ts:
  H helmet  h helmet stripe  M facemask  S skin  J jersey  T trim  N number
  P pants   p far leg (trim)  K socks  B shoe  G glove  F football  W laces
  lower case (other than h/p) = far limb, shaded darker.
Frames are composed from the original model's parts (helmet, torso, legs) so the
players keep the same look; a few poses (dives, falls, front/back views) are drawn whole.

Run `python3 tools/sprites.py` to regenerate the JSON, `--preview out.png` for a sheet.
"""
import json, sys, os

W, Hh = 16, 20

def blank():
    return [['.'] * W for _ in range(Hh)]

def put(g, rows, x, y):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '.':
                continue
            X, Y = x + i, y + j
            if 0 <= X < W and 0 <= Y < Hh:
                g[Y][X] = ch

def rows(g):
    return [''.join(r) for r in g]

# ---- the original model's parts (12 columns wide; placed at x=2) -------------------------
HEL = ['....HHHH....', '...HhhhHH...', '...HHHHHMM..', '....HHSMM...']
HEL_FRONT = ['....HHHH....', '...HHhhHH...', '...HMMMMH...', '...HMSSMH...']
HEL_BACK = ['....HHHH....', '...HHhhHH...', '...HHhhHH...', '....HHHH....']
HEL_DOWN = ['....HHHH....', '...HhhhHH...', '...HHHHHH...', '....HHMMM...']   # head bowed

T = {
    'idle':   ['..TJJJJJT...', '.JJJJJJJJJ..', '.SJJNNNJJS..', '.SJJNNNJJS..', '.GJJJJJJJG..'],
    'runA':   ['..TJJJJJT...', '.JJJJJJJJJS.', 'sJJJNNNJJG..', 'gJJJNNNJJ...', '..JJJJJJJ...'],
    'runB':   ['..TJJJJJT...', 'sJJJJJJJJJ..', 'gJJJNNNJJS..', '..JJNNNJJS..', '..JJJJJJJG..'],
    'carry':  ['..TJJJJJT...', '.JJJJJJJJS..', 'sJJJNNNFFS..', 'gJJJNNNFWG..', '..JJJJJJJ...'],
    'carryB': ['..TJJJJJT...', 'sJJJJJJJJS..', 'gJJJNNNFFS..', '..JJNNNFWG..', '..JJJJJJJ...'],
    'up':     ['..TJJJJJT...', '.JJJJJJJJJ..', '..JJNNNJJ...', '..JJNNNJJ...', '..JJJJJJJ...'],
    'fwd':    ['..TJJJJJTSSG', '.JJJJJJJJJ..', '.JJJNNNJJSSG', '..JJNNNJJ...', '..JJJJJJJ...'],
    'hold':   ['..TJJJJJT...', '.JJJJJJJJS..', '.SJJNNNJFFG.', '.SJJNNNJWG..', '.GJJJJJJJ...'],   # ball at the chest, two hands
    'wind':   ['FG.TJJJJT...', 'SSJJJJJJJ...', '.JJJNNNJJSG.', '.JJJNNNJJ...', '..JJJJJJJ...'],
    'release':['..TJJJJJTSSG', '.JJJJJJJJJ..', 'sJJJNNNJJ...', 'gJJJNNNJJ...', '..JJJJJJJ...'],
    'follow': ['..TJJJJJT...', '.JJJJJJJJS..', 'sJJJNNNJJS..', 'gJJJNNNJJS..', '..JJJJJJJG..'],
    'point':  ['..TJJJJJTSSSG', '.JJJJJJJJJ...', 'sJJJNNNJJ....', 'gJJJNNNJJ....', '..JJJJJJJ....'],
    'stiff':  ['..TJJJJJTSSSG', '.JJJJJJJJJ...', 'sJJJNNNFF....', 'gJJJNNNFW....', '..JJJJJJJ....'],
    'stiffB': ['..TJJJJJT....', 'FFJJJJJJJSSSG', 'WFJJNNNJJ....', '.gJJNNNJJ....', '..JJJJJJJ....'],
    'reach':  ['..TJJJJJTSSSG', '.JJJJJJJJJSSG', '..JJNNNJJ....', '..JJNNNJJ....', '..JJJJJJJ....'],
    'rip':    ['..TJJJJJT.SG.', '.JJJJJJJJS...', '.JJJNNNJJSSG.', '..JJNNNJJ....', '..JJJJJJJ....'],
    'hit':    ['.STJJJJJT...', 'G.JJJJJJJS..', '..JJNNNJJG..', '..JJNNNJJ...', '..JJJJJJJ...'],
    'secure': ['..TJJJJJT...', '.JJJJJJJJS..', '.sJJNNNFFS..', '.gJJNNNFWG..', '..JJJJJJJ...'],
    'spike':  ['..TJJJJJT...', '.JJJJJJJJJ..', 'sJJJNNNJJS..', 'gJJJNNNJJS..', '..JJJJJJJG..'],
}
L = {
    'stand':  ['...PPPPPP...', '...PP..PP...', '...KK..KK...', '...KK..KK...', '...BBB.BBB..'],
    'wide':   ['..PPPPPPPP..', '..PP....PP..', '.KK......KK.', '.KK......KK.', 'BBB......BBB'],
    'crouch': ['..PPPPPPP...', '..PP...PP...', '.KK.....KK..', '.BBB....BBB.', '............'],
    'stride': ['...PPPPPP...', '..pp....PP..', '..pp.....PP.', '.kk.......KK', 'bbb.......BB'],
    'kick':   ['...PPPPPP...', '...pp...PPPK', '...kk.....KB', '...kk.......', '...bbb......'],
    'plant':  ['..PPPPPPP...', '.pp.....PP..', 'kk.......PP.', 'k.........KK', 'b.........BB'],
    # a six-frame sprint: strike, stance, push, flight, then the same with the other leg
    'r0': ['...PPPPPP...', '..pp...PP...', '..pp....PP..', '.kk......KK.', 'bb.......BBB'],
    'r1': ['...PPPPPP...', '...PPpppp...', '...PP..kk...', '...KK..b....', '...BBB......'],
    'r2': ['...PPPPPP...', '..PP....pp..', '..PP.....pp.', '.KK.......kk', 'BB.......bbb'],
    'r3': ['...PPPPPP...', '..pp..PPPP..', '.kk......KK.', '.b.......BB.', '............'],
    'r4': ['...PPPPPP...', '...ppPPPP...', '...pp..KK...', '...kk..B....', '...bbb......'],
    'r5': ['...PPPPPP...', '..PP..pppp..', '.KK......kk.', '.B.......bb.', '............'],
    # backpedal: short choppy steps, weight on the balls of the feet
    'b0': ['...PPPPPP...', '...PP..pp...', '..KK....kk..', '..BB....bb..', '............'],
    'b1': ['...PPPPPP...', '...pp..PP...', '..kk....KK..', '..bb....BB..', '............'],
}

def frame(hel='HEL', torso='idle', legs='stand', hx=0, hy=0, tx=0, ty=0, lift=0, extra=None):
    g = blank()
    base = 15 - lift                     # legs top row
    put(g, L[legs], 2, base)
    put(g, T[torso], 2 + tx, base - 5 + ty)
    put(g, globals()[hel], 2 + hx, base - 9 + hy + ty)
    if extra:
        for rws, x, y in extra:
            put(g, rws, x, y)
    return rows(g)

F = {}
F['stand'] = frame()
F['ready'] = frame(torso='hold', legs='wide', hy=1, ty=1)            # QB in the gun, ball out front
F['crouch'] = frame(legs='crouch', hy=1, ty=1)
F['hands'] = frame(torso='fwd', legs='crouch', hx=1, hy=1, ty=1)     # RB / LB: hands near the knees
# Six-frame sprint with the head forward (lean); flight frames ride a pixel higher.
legs6 = ['r0', 'r1', 'r2', 'r3', 'r4', 'r5']
arms6 = ['runB', 'runB', 'runA', 'runA', 'runA', 'runB']
for i in range(6):
    up = 1 if i in (3, 5) else 0
    F[f'run{i}'] = frame(torso=arms6[i], legs=legs6[i], hx=1, lift=up)
    F[f'carry{i}'] = frame(torso='carry' if i < 3 else 'carryB', legs=legs6[i], hx=1, lift=up)
    F[f'jog{i}'] = frame(torso=arms6[i], legs=legs6[i], lift=up)
F['back0'] = frame(legs='b0', hy=1, ty=1)
F['back1'] = frame(legs='b1', hy=1, ty=1)
F['shuf0'] = frame(legs='wide', torso='idle', hy=1, ty=1)
F['shuf1'] = frame(legs='crouch', torso='idle', hy=1, ty=1)
F['hold'] = frame(torso='hold')
F['wind'] = frame(torso='wind', legs='stride')
F['release'] = frame(torso='release', legs='stride', hx=1)
F['follow'] = frame(torso='follow', legs='r1', hx=1)
F['reach'] = frame(torso='reach', legs='stride', hx=1)
F['secure'] = frame(torso='secure', legs='stand')
F['point'] = frame(torso='point', legs='stand')
F['stiff0'] = frame(torso='stiff', legs='r0', hx=1)
F['stiff1'] = frame(torso='stiff', legs='r2', hx=1)
F['plant'] = frame(torso='carry', legs='plant', hx=-1, hy=1, ty=1)     # the juke: plant and lean away
F['push0'] = frame(torso='fwd', legs='r0', hx=2, hy=1, ty=1)
F['push1'] = frame(torso='fwd', legs='r2', hx=2, hy=1, ty=1)
F['anchor'] = frame(torso='fwd', legs='wide', hx=1, hy=1, ty=1)        # pass pro: sit down and punch
F['rip'] = frame(torso='rip', legs='r0', hx=2, hy=1, ty=1)             # swim/rip move by the rusher
F['hit'] = frame(torso='hit', legs='stride', hx=-1)                  # rocked by contact
F['kick'] = frame(torso='runB', legs='kick')
F['punt'] = frame(torso='up', legs='kick', extra=[(['GS'], 11, 9)])
F['throw0'] = F['hold']; F['throw1'] = F['wind']; F['throw2'] = F['release']; F['throw3'] = F['follow']
F['spike0'] = frame(torso='up', legs='stride', extra=[(['.F.', 'GW.', 'S..', 'S..'], 9, 4)])
F['spike1'] = frame(torso='spike', legs='stride', hx=2, hy=1, ty=1)

# Arms raised: catches, celebrations, signals.
RAISE = ['.G.......G..', '.S.......S..', '.S.......S..', '.S.......S..', '..S.....S...', '..S.....S...']
F['catch'] = frame(torso='up', extra=[(RAISE, 2, 4)])
F['party0'] = F['catch']
F['party1'] = frame(torso='up', legs='crouch', hy=1, ty=1, extra=[(['G.........G.', '.S.......S..', '.S.......S..', '..S.....S...', '..S.....S...'], 2, 6)])
F['signal'] = F['catch']
F['jump0'] = frame(torso='up', legs='r3', lift=3, extra=[(['.........G..', '.........S..', '.........S..', '.........S..', '........S...', '........S...'], 2, 1)])   # fist pump in the air
F['high'] = frame(torso='up', legs='r4', lift=3, extra=[(RAISE, 2, 1)])   # high-point catch
F['highball'] = frame(torso='up', legs='r4', lift=3, extra=[(['.....FF.....', '.G..FWF..G..'] + RAISE[1:], 2, 0)])
F['onehand'] = frame(torso='up', legs='stride', hx=1, extra=[(['...........G', '..........S.', '..........S.', '.........S..', '.........S..'], 2, 5)])
F['toetap'] = frame(torso='reach', legs='stand', hx=-1)   # leaning back, toes down

# Whole poses.
def whole(rws):
    g = blank(); put(g, rws, 0, Hh - len(rws)); return rows(g)

F['three'] = whole([
    '........HHHH....',
    '....TJJJHhhHM...',
    '...JJJJJJJHHSM..',
    '...PJJNNJJJJS...',
    '..PPJJJJJJJJS...',
    '..PP.pp.....SS..',
    '..KK.kk.....G...',
    '..K...kk........',
    '..BB..bbb.......',
])
F['under'] = whole([            # QB under centre: bent at the waist, hands forward
    '.........HHHH...',
    '.....TJJHhhhHM..',
    '....JJJJJHHHSM..',
    '....JJNNNJJSS...',
    '....JJJJJJJ.GG..',
    '....PPPPPP......',
    '....PP..PP......',
    '...KK....KK.....',
    '...KK....KK.....',
    '..BBB....BBB....',
])
F['snap'] = whole([             # the centre over the ball
    '..........HHHH..',
    '......TJJHhhhHM.',
    '...JJJJJJJHHHSM.',
    '..PJJJNNJJJJSS..',
    '.PPJJJJJJJJJ.S..',
    '.PP.pp......GFF.',
    '.KK.kk......WFF.',
    '.K...kk.........',
    '.BB..bbb........',
])
F['dive'] = whole([             # horizontal, arms out: the tackle launch
    '..........HHH...',
    '....BKKPPJJJHHhM',
    '....bkkPPJNNJHSM',
    '.......ppJJJJGSG',
    '................',
    '................',
])
F['divecatch'] = whole([        # layout catch: fully extended, ball in the hands
    '...........HHH..',
    '.BKKPPJJJJHHhM.F',
    '.bkkPPJNNJJHSMGF',
    '....ppJJJJJ..SG.',
    '................',
    '................',
])
F['wrap'] = whole([             # tackler wrapping up, driving low
    '.........HHHH...',
    '.....TJJHhhhHMG.',
    '....JJJJJJHHHSS.',
    '...PJJNNNJJJJSG.',
    '..PPJJJJJJJ.....',
    '..PP..pp........',
    '.KK....kk.......',
    'BB......bb......',
])
F['down'] = whole([             # face down
    '.....SG..HHH....',
    'BKKPPJJJJHhM....',
    'bkkPPJNNJHSM....',
])
F['downback'] = whole([         # on his back
    '....SG..........',
    'BKKPPJJJJJHHH...',
    'bkkPPJNNJJHhM...',
])
F['kneel'] = whole([            # getting up / taking a knee
    '......HHHH......',
    '.....HhhhHH.....',
    '.....HHHHHMM....',
    '......HHSMM.....',
    '....TJJJJJT.....',
    '...JJJJJJJJJ....',
    '...SJJNNNJJS....',
    '...GJJJNNNJS....',
    '.....PPPPPPPG...',
    '.....PP...PP....',
    '....KK....KK....',
    '..BBKK....BBB...',
])
F['pray'] = whole([             # kneel, head bowed, hand on the knee
    '................',
    '......HHHH......',
    '.....HhhhHH.....',
    '.....HHHHHH.....',
    '......HHMMM.....',
    '....TJJJJJT.....',
    '...JJJJJJJJJ....',
    '...SJJNNNJJSS...',
    '...GJJJNNNJJG...',
    '.....PPPPPPP....',
    '.....PP...PP....',
    '....KK....KK....',
    '..BBKK....BBB...',
])
# Front and back views: the spin move, celebrations and the officials' signals.
FRONT_LEGS = ['....PPPPPPP.....', '....PP...PP.....', '....KK...KK.....', '....KK...KK.....', '...BBB...BBB....']
def front(arms_top=None, torso=None, hel=HEL_FRONT, legs=FRONT_LEGS, lift=0):
    # arms_top: rows drawn beside the helmet, ending on the shoulders
    g = blank()
    b = 15 - lift
    put(g, legs, 0, b)
    put(g, torso or ['...TJJJJJJT.....', '..SJJJJJJJJS....', '..SJJNNNNJJS....', '..SJJNNNNJJS....', '..GJJJJJJJJG....'], 0, b - 5)
    put(g, hel, 2, b - 9)
    if arms_top:
        put(g, arms_top, 0, b - 5 - len(arms_top))
    return rows(g)
F['front'] = front()
F['back'] = front(hel=HEL_BACK, torso=['...TJJJJJJT.....', '..SJNNNNNNJS....', '..SJNNNNNNJS....', '..SJJJJJJJJS....', '..GJJJJJJJJG....'])
F['flex'] = front(arms_top=['.G.........G....', '.S.........S....', '.S.........S....', '.SS.......SS....', '..S.......S.....'],
                  torso=['..STJJJJJJTS....', '...JJJJJJJJ.....', '...JJNNNNJJ.....', '...JJNNNNJJ.....', '...JJJJJJJJ.....'])
F['dance0'] = front(arms_top=['.G..............', '.S..............', '.S..............', '..S.............', '..S.............'],
                    torso=['..STJJJJJJT.....', '...JJJJJJJJS....', '...JJNNNNJJS....', '...JJNNNNJJG....', '...JJJJJJJJ.....'],
                    legs=['....PPPPPPP.....', '...PP....PP.....', '..KK.....KK.....', '..KK......KK....', '.BBB......BBB...'])
F['dance1'] = front(arms_top=['...........G....', '...........S....', '...........S....', '..........S.....', '..........S.....'],
                    torso=['...TJJJJJJTS....', '..SJJJJJJJJ.....', '..SJJNNNNJJ.....', '..GJJNNNNJJ.....', '...JJJJJJJJ.....'],
                    legs=['....PPPPPPP.....', '....PP....PP....', '....KK.....KK...', '...KK......KK...', '..BBB......BBB..'])
F['incomp0'] = front(torso=['...TJJJJJJT.....', 'GSSSSJJJJSSSSG..', '...JJNNNNJJ.....', '...JJNNNNJJ.....', '...JJJJJJJJ.....'])
F['incomp1'] = front(torso=['...TJJJJJJT.....', '...SSSSSSSS.....', '..GJJNNNNJJG....', '...JJNNNNJJ.....', '...JJJJJJJJ.....'])
F['tdsig'] = front(arms_top=['.G.........G....', '.S.........S....', '.S.........S....', '.S.........S....', '..S.......S.....', '..S.......S.....'],
                   torso=['..STJJJJJJTS....', '...JJJJJJJJ.....', '...JJNNNNJJ.....', '...JJNNNNJJ.....', '...JJJJJJJJ.....'])
F['frontball'] = front(torso=['...TJJJJJJT.....', '..SJJJJJJJJS....', '..SJJNFFNJJS....', '..GJJNWFNJJG....', '...JJJJJJJJ.....'])
F['holder'] = whole([           # holder on one knee, ball down
    '................',
    '......HHHH......',
    '.....HhhhHH.....',
    '.....HHHHHMM....',
    '......HHSMM.....',
    '....TJJJJJT.....',
    '...JJJJJJJJJS...',
    '...SJJNNNJJ.S...',
    '...GJJJNNNJ.G...',
    '.....PPPPPPPF...',
    '.....PP...PPW...',
    '....KK....KK....',
    '..BBKK....BBB...',
])

# Validate.
for k, v in F.items():
    assert len(v) == Hh and all(len(r) == W for r in v), k

def preview(path, scale=6):
    from PIL import Image
    pal = {'H': (180, 30, 40), 'h': (255, 255, 255), 'M': (150, 155, 165), 'S': (200, 150, 110), 'J': (180, 30, 40), 'T': (255, 255, 255),
           'N': (255, 255, 255), 'P': (230, 230, 230), 'p': (255, 255, 255), 'K': (180, 30, 40), 'B': (20, 20, 20), 'G': (255, 255, 255), 'F': (122, 58, 18), 'W': (255, 255, 255)}
    keys = list(F.keys()); cols = 10
    im = Image.new('RGB', ((W + 2) * cols * scale, (Hh + 4) * ((len(keys) + cols - 1) // cols) * scale), (43, 127, 57))
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    for n, k in enumerate(keys):
        ox, oy = (n % cols) * (W + 2), (n // cols) * (Hh + 4)
        for y, r in enumerate(F[k]):
            for x, ch in enumerate(r):
                if ch == '.': continue
                c = pal.get(ch)
                if c is None:
                    c = tuple(int(v * 0.65) for v in pal[ch.upper()])
                d.rectangle([(ox + x + 1) * scale, (oy + y + 1) * scale, (ox + x + 2) * scale - 1, (oy + y + 2) * scale - 1], fill=c)
        d.text(((ox + 1) * scale, (oy + Hh + 1) * scale + 4), k, fill=(255, 255, 255))
    im.save(path)

out = os.path.join(os.path.dirname(__file__), '..', 'src', 'ui', 'field', 'frames.json')
with open(out, 'w') as f:
    json.dump(F, f, separators=(',', ':'))
if len(sys.argv) > 2 and sys.argv[1] == '--preview':
    preview(sys.argv[2])
print(len(F), 'frames')
