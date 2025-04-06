# geekslides

TODO: Write an actual README ;-)

## Installation on Ubuntu

* Setup the `node` runtime and tooling

```
curl -L https://git.io/n-install | bash
. $HOME/.bashrc 

node --version
npm --version
```

* Get the code and the dependencies

```bash
git clone https://github.com/ciberado/geekslides
cd geekslides
npm run install
```

## Quick overview

* Start the communications [broker](https://github.com/ciberado/geekslides/tree/main/broker), the [slides server](https://github.com/ciberado/geekslides/tree/main/slides) and the [demo presentation](https://github.com/ciberado/geekslides/tree/main/demo).

```bash
npm run start
```

### Simple local synchronization

* Point your browser to the slides engine address on `http://localhost:1234`
* Press the `o` (open) key and type `http://localhost:8080` (where the presentation demo resides)
* Press the `c` (clone) key and accept the popup window 
* Press the `s` (speaker view) **once** to toggle the presenation notes
* Use the arrow keys or `h`/`l` to move through the slides on both windows

Now you should see two copies of the same show, in sync.

### Whiteboard

* Use the left button of the mouse or the pencil of a Surface to draw on top of the slides
* Use the right button of the mouse or the control bar appearing in the top margin to clean the strokes
* Press `w` to show the whiteboard, and press it again to hide it

### Simple remote synchronization

TBD

### Book view

TBD

### Extras

* Focus on mouse: https://codepen.io/wakana-k/pen/QWYyXXW

