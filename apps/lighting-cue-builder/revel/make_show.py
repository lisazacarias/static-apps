# Turns a cue list (a CSV) into ShowXpress scenes and a timeline, for a show
# set up with the Revel starter. Quit ShowXpress first, then:
#   python3 make_show.py "Show name" cues.csv
# The song must already be in the show at Live/music.wav.
#
# cues.csv has one row per cue:
#   time    seconds into the song (4.3)
#   lights  light numbers, space-separated (1 2 4)
#   color   hex colour (#ffd9a0)
#   level   brightness, 0-100
#   fade    seconds to fade in; 0 snaps
#   name    optional: a few words for the scene's file and step names
#           ("floor lavender"), so the files read well in Finder and ShowXpress
# Each cue changes only the lights it names. The others keep what they had,
# so turn a light off with a row at level 0. Two cues at the same time can't
# name the same light.
import csv, math, os, re, sys, wave
from xml.sax.saxutils import escape

# Revel's lights only respond to red, green and blue (Quan: "only the RGB
# works, there's no dimmer or any other channel"), so brightness goes out
# as the colour scaled down, with the dimmer held at full. Set this to
# 'dimmer' for full colour with brightness on the dimmer instead, if the
# starter's "Dimmer test" timeline shows the dimmer working.
BRIGHTNESS = 'rgb'

# Seconds of blackout on the timeline before the song and lights start.
# Revel wants 5 (Quan). Cue times in the CSV stay song times.
LEAD = 5

if len(sys.argv) != 3:
    sys.exit('Usage: python3 make_show.py "Show name" cues.csv')
NAME, CUES = sys.argv[1], sys.argv[2]
SHOW = os.path.expanduser(f'~/TheLightingController/LightShows/{NAME}')
with wave.open(f'{SHOW}/Live/music.wav') as w:
    SONG_LENGTH = w.getnframes() / w.getframerate()

def stamp(sec):  # timeline times are h:mm:ss.t, in tenths
    t = round(sec * 10)
    return f'{t // 36000}:{t // 600 % 60:02}:{t // 10 % 60:02}.{t % 10}'

# Light number -> its id, name and model, from the show's patch
FX, cur = {}, None
for line in open(f'{SHOW}/fixtures.ini', encoding='utf-8-sig'):
    line = line.strip()
    if line.startswith('[Fixture'):
        cur = {}
    elif cur is not None and ' = ' in line:
        key, value = line.split(' = ', 1)
        cur[key] = value
        if key == 'name':  # "CH7: SlimPAR 56 (7CH) #7" is light 7
            FX[int(value.split(':')[0][2:])] = cur

CHANNEL_NAMES = ['red', 'green', 'blue', 'color_macro', 'shutter', 'mode', 'dimmer']

def scene(lights, steps):
    """steps: [(step name, length in hundredths, fade?, {channel index: value})]"""
    out = ['<?xml version="1.0" encoding="UTF-8"?>', '', '<Scene>', '  <Fixtures>']
    for l in lights:
        f = FX[l]
        out.append(f'    <Fixture id="{f["id"]}" name="{f["name"]}" model="{f["model"]}"/>')
    out += ['  </Fixtures>', '  <Steps>']
    for step_name, length, fade, values in steps:
        out.append(f'    <Step name="{escape(step_name, {chr(34): "&quot;"})}" length="{length}">')
        for l in lights:
            out.append(f'      <Fixture id="{FX[l]["id"]}">')
            for ch, v in sorted(values.items()):
                out.append(f'        <Channel index="{ch}" name="{CHANNEL_NAMES[ch]}" value="{v}" fade="{int(fade)}"/>')
            out.append('      </Fixture>')
        out.append('    </Step>')
    out += ['  </Steps>', '</Scene>', '']
    return '\r\n'.join(out)

def write(path, text):
    with open(path, 'w', newline='') as f:  # newline='' keeps the \r\n
        f.write(text)

rows = sorted(csv.DictReader(open(CUES, encoding='utf-8-sig')), key=lambda r: float(r['time']))
# Cues at the same moment go on separate light rows (layers), one per cue.
# Each block lasts until the next cue on its own row.
for i, r in enumerate(rows):
    r['row'] = sum(1 for q in rows[:i] if float(q['time']) == float(r['time']))
row_count = max(r['row'] for r in rows) + 1
events = ['[Event_0]', 'TimeLineIndex = 2', f'StartTime = {stamp(LEAD)}', 'Path = Live/music.wav',
          f'Length = {stamp(SONG_LENGTH)}']
if LEAD:
    dark = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 255}
    write(f'{SHOW}/scenes/000 blackout before the show.scex', scene(sorted(FX), [('blackout before the show', 60000, False, dark)]))
    events += ['[Event_1]', 'TimeLineIndex = 3', 'StartTime = 0:00:00.0', 'Path = 000 blackout before the show.scex',
               f'Length = {stamp(LEAD)}', 'Speed = 100', 'SpeedType = 2']
for i, r in enumerate(rows, 1):
    start = float(r['time'])
    lights = [int(x) for x in r['lights'].split()]
    hexc = r['color'].strip().lstrip('#')
    red, green, blue = (int(hexc[k:k + 2], 16) for k in (0, 2, 4))
    level = float(r['level']) / 100
    if BRIGHTNESS == 'rgb':
        red, green, blue, dimmer = round(red * level), round(green * level), round(blue * level), 255
    else:
        dimmer = round(level * 255)
    # SlimPAR 56 (7CH): 0 red, 1 green, 2 blue, 3 colour macro, 4 shutter, 5 mode, 6 dimmer
    look = {0: red, 1: green, 2: blue, 3: 0, 4: 0, 5: 0, 6: dimmer}
    fade = round(float(r['fade']) * 20) * 5  # hundredths, kept on the 0.05 s tick
    label = (r.get('name') or '').strip() or f"lights {r['lights'].strip()}"
    # fade in (if any), then hold for 10 minutes so the scene never loops
    steps = ([(f'{label}: fade in', fade, True, look)] if fade else []) + [(f'{label}: hold', 60000, False, look)]
    # "003 floor lavender 27.5s.scex"; Finder and ShowXpress don't like / or :
    name = f"{i:03} {re.sub(r'[^A-Za-z0-9 ._()%+-]+', '', label).strip()} {start:.1f}s.scex"
    write(f'{SHOW}/scenes/{name}', scene(lights, steps))
    later = [float(q['time']) for q in rows[i:] if q['row'] == r['row'] and float(q['time']) > start]
    end = later[0] if later else SONG_LENGTH
    # rows 1 and 2 are video and music, so light row k is TimeLineIndex k + 3
    events += [f'[Event_{i + (1 if LEAD else 0)}]', f'TimeLineIndex = {r["row"] + 3}', f'StartTime = {stamp(start + LEAD)}', f'Path = {name}',
               f'Length = {stamp(end - start)}', 'Speed = 100', 'SpeedType = 2']

params = ['[Params]', 'Version = 0.2', 'CommentTimeLine = 0', f'LightTimeLines = {row_count}', 'MediaTimeLines = 1',
          'ShowWaveForm = 1', 'Zoom = 1', f'MaxTime = {stamp(math.ceil(SONG_LENGTH + LEAD))[:-2]}',
          'TimeLine_1 = V I D E O   P I C T U R E   T I M E L I N E', 'TimeLine_2 = music',
          *(f'TimeLine_{k + 3} = lights {k + 1}' for k in range(row_count))]
os.makedirs(f'{SHOW}/Live/TimeLine/timelines', exist_ok=True)
write(f'{SHOW}/Live/TimeLine/timelines/{NAME}.tml', '\r\n'.join(['', *params, *events, '']))
print(f'{len(rows)} cues written. In ShowXpress: Live > TimeLine > Open > {NAME}.')
