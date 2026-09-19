# Farm Coil

A browser **classic Snake** game with a lighthearted farm aesthetic — rolled-paper coil, original cannabis-style leaf snacks (multi-leaflet, serrated, canvas-drawn), soft field colors. Built as a fun portfolio piece with **original** art and sound (canvas/CSS + Web Audio). No third-party IP, characters, logos, or copyrighted audio.

## Run

Open the file directly:

```bash
# from this folder
xdg-open index.html   # Linux
# or open index.html in any modern browser
```

Or serve locally (recommended if the browser restricts `file://` quirks):

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

No build step, no frameworks — just static files.

## Gameplay

Classic Snake rules on a 20×20 grid:

- Move one cell per tick (speed ramps slightly as you grow)
- Eat a leaf → grow by 1, score up, new leaf spawns
- Hit a wall or yourself → game over (no wrap)
- Cannot reverse 180° into yourself in one tick

## Controls

| Input | Action |
|--------|--------|
| Enter / Space | Start / resume |
| Arrow keys / WASD | Move |
| P / Escape | Pause |
| R | Restart (back to title) |
| M | Mute / unmute |
| On-screen buttons | Pause, Restart, Mute |
| Touch D-pad | Mobile / coarse pointer |

Score and high score persist in `localStorage` (`farmCoilHighScore`).

## Theme note

The look is an **original farm vibe** (fields, medical-marijuana-style leaves drawn as original multi-fingered cannabis leaves on canvas, a geometric “rolled paper” coil). It does **not** use names, quotes, logos, sprites, or audio from any TV show or studio. Sounds are generated live with the Web Audio API.

## Files

- `index.html` — page shell
- `style.css` — layout & farm UI
- `game.js` — grid gameplay + canvas drawing
- `audio.js` — eat / death / chiptune-ish loop

## License

Do what you want with this for personal / portfolio use. Don’t claim affiliation with any network or franchise.
