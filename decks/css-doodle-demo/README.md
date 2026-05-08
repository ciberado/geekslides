# CSS Doodle Plugin Demo

Welcome to the CSS Doodle plugin demonstration!

[](#.mod-coverbg)

### Geometric Patterns

![css-doodle](#triangles,opacity=0.15,bg)

[](.layout-two-col#triangles)

### Triangles

![css-doodle](#triangles)

#### col

Randomized triangular mosaic using `clip-path`. Each cell picks a random
triangle orientation from the theme palette.

<doodle-controls></doodle-controls>

[](.layout-two-col#squares)

### Squares (Animated)

![css-doodle](#squares,animate,speed=2)

#### col

Rotated and scaled squares that spin continuously. Use `speed` to control
the animation rate.

<doodle-controls></doodle-controls>

[](.layout-two-col#hexagons)

### Hexagons

![css-doodle](#hexagons)

#### col

Honeycomb grid clipped to hexagon shapes. Adjust `grid` to control cell density.

<doodle-controls></doodle-controls>

[](.layout-two-col#diamonds)

### Diamonds

![css-doodle](#diamonds,grid=10)

#### col

Diamond lattice with random orientations and opacity variation.

<doodle-controls></doodle-controls>

[](.layout-two-col#circles)

### Circles

![css-doodle](#circles,grid=12)

#### col

Overlapping circles with radial gradients fading to transparent.

<doodle-controls></doodle-controls>

[](.layout-two-col#quarters)

### Quarters

![css-doodle](#quarters)

#### col

Bauhaus-style quarter-circle tiles. Each cell shows a filled rounded
corner facing a random direction — simple geometry that creates
surprisingly organic-looking composition.

<doodle-controls></doodle-controls>

[](.layout-two-col#waves)

### Waves

![css-doodle](#waves,grid=20x10)

#### col

Sinusoidal wave interference pattern. Use a tall `grid` ratio to emphasise
the horizontal wave bands.

<doodle-controls></doodle-controls>

[](.layout-two-col#bubbles)

### Bubbles (Animated)

![css-doodle](#bubbles,animate,speed=0.5)

#### col

Floating bubble shapes with pulsing scale animation. Slow `speed` values
create a calm, organic feel.

<doodle-controls></doodle-controls>

[](.layout-two-col#petals)

### Petals

![css-doodle](#petals,grid=8)

#### col

Petal shapes rotated at random angles, creating a floral texture.

<doodle-controls></doodle-controls>

[](.layout-two-col#dots)

### Dots

![css-doodle](#dots,grid=30)

#### col

Dot matrix with varying sizes — great as a subtle slide background.

<doodle-controls></doodle-controls>

[](.layout-two-col#crosshatch)

### Crosshatch

![css-doodle](#crosshatch,grid=20)

#### col

Cross-hatched texture built with `linear-gradient` stripes.

<doodle-controls></doodle-controls>

[](.layout-two-col#lines)

### Lines

![css-doodle](#lines,grid=20)

#### col

Diagonal line pattern with random opacity and spacing.

<doodle-controls></doodle-controls>

[](.layout-two-col#noise)

### Noise

![css-doodle](#noise,grid=20)

#### col

Dense micro-texture resembling film grain. Works as a subtle slide
background at low `opacity`.

<doodle-controls></doodle-controls>

[](.layout-two-col#gradient-grid)

### Gradient Grid

![css-doodle](#gradient-grid,grid=8)

#### col

Smooth colour transitions across each cell, creating a shifting
stained-light effect.

<doodle-controls></doodle-controls>

[](.layout-two-col#pixels)

### Pixels

![css-doodle](#pixels,grid=24)

#### col

Retro pixel-art blocks. Dense grids produce a mosaic texture; coarse
grids produce a bold blocky look.

<doodle-controls></doodle-controls>

[](.layout-two-col#binary)

### Binary

![css-doodle](#binary,grid=16x20)

#### col

0s and 1s in random sizes — great for data-science or coding talks.

<doodle-controls></doodle-controls>


[](.layout-two-col#circuit)

### Circuit

![css-doodle](#circuit,grid=14)

#### col

Circuit-board traces with corner connections — ideal for tech slides.

<doodle-controls></doodle-controls>

[](.layout-two-col#matrix)

### Matrix (Animated)

![css-doodle](#matrix,animate,speed=1.5,grid=20x30)

#### col

Digital rain effect with cascading characters. Increase `grid` columns for
a denser stream.

<doodle-controls></doodle-controls>

[](.layout-two-col#confetti)

### Confetti (Animated)

![css-doodle](#confetti,animate,speed=1)

#### col

Scattered confetti shapes in random orientations, floating gently.

<doodle-controls></doodle-controls>

[](.layout-two-col#stars)

### Stars (Animated)

![css-doodle](#stars,animate,grid=16)

#### col

Twinkling star field. Each star pulses independently.

<doodle-controls></doodle-controls>

[](.layout-two-col#mosaic)

### Mosaic

![css-doodle](#mosaic,grid=8)

#### col

Stacked rectangles in random heights — inspired by modernist tile art.

<doodle-controls></doodle-controls>

[](#.mod-coverbg)

### Full-Bleed Background

![css-doodle](#mosaic,cover,opacity=0.3)

[](.layout-two-col#custom-colors)

### Custom Colors

![css-doodle](#triangles,colors=#ff6b6b|#4ecdc4|#45b7d1,grid=12)

#### col

Override theme colors with `colors=#hex1|#hex2|…`. Separate values with `|`.

<doodle-controls></doodle-controls>

[](.layout-two-col#nohole)

### No Holes (`nohole`)

![css-doodle](#triangles,nohole)

#### col

The `nohole` flag replaces the surface color slot with a dark accent
variant. Without it, some cells may pick the slide background color
and look like transparent holes.

<doodle-controls></doodle-controls>

[](.layout-two-col#opacity-demo)

### Opacity Control

![css-doodle](#mosaic,grid=10,opacity=0.35)

#### col

Use `opacity=0…1` to layer a pattern subtly over the slide background.

<doodle-controls></doodle-controls>

[](.layout-two-col#speed-demo)

### Animation Speed

![css-doodle](#confetti,animate,speed=3)

#### col

`speed=3` triples the animation rate. Values below 1 slow it down — `speed=0.3` creates a languid, ambient feel.
Use `animate,speed=N` on any animated pattern: `squares`, `bubbles`, `stars`, `matrix`, `confetti`.

<doodle-controls></doodle-controls>

[](.layout-two-col#seed)

### Reproducible Patterns

![css-doodle](#confetti,seed=42)

#### col

Use `seed=N` for a deterministic pattern — ideal when you need the same
layout on every render.

<doodle-controls></doodle-controls>

[](#.mod-coverbg)

### Thank You!

![css-doodle](#gradient-grid,bg,opacity=0.2)

