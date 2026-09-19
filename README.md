# Farm Coil

A browser Snake game with a lighthearted farm aesthetic — rolled-paper coil, leafy snacks, soft field colors. Built as a fun portfolio piece with **original** art and sound (canvas/CSS + Web Audio). No third-party IP, characters, logos, or copyrighted audio.

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

## Controls

| Input | Action |
|--------|--------|
| Arrow keys / WASD | Move |
| Enter / Space | Start / resume |
| P / Escape | Pause |
| R | Restart (back to title) |
| M | Mute / unmute |
| On-screen buttons | Pause, Restart, Mute |
| Touch D-pad | Mobile / coarse pointer |

Score and high score persist in `localStorage` (`farmCoilHighScore`).

## Theme note

The look is an **original parody-inspired farm vibe** (fields, leaves, a geometric “rolled paper” coil drawn on canvas). It does **not** use names, quotes, logos, sprites, or audio from any TV show or studio. Sounds are generated live with the Web Audio API.

## Files

- `index.html` — page shell
- `style.css` — layout & farm UI
- `game.js` — grid gameplay + canvas drawing
- `audio.js` — eat / death / chiptune-ish loop

## License

Do what you want with this for personal / portfolio use. Don’t claim affiliation with any network or franchise.
