# CSS Doodle Plugin Demo

Welcome to the CSS Doodle plugin demonstration!

::: Notes
The CSS Doodle plugin generates procedural geometric patterns using CSS Grid and
clip-path. Patterns are defined by name (e.g., `triangles`, `hexagons`) and
configured with parameters like `grid`, `animate`, `speed`, `opacity`, and `colors`.
:::

[](#.mod-coverbg)

### Geometric Patterns

![css-doodle](#triangles,opacity=0.15,bg)

::: Notes
This slide shows a CSS Doodle pattern used as a full-slide background. The `bg`
flag makes the doodle fill the slide behind other content. Combined with low
`opacity`, it creates a subtle decorative background.
:::

[](.layout-two-col#triangles)

### Triangles

![css-doodle](#triangles)

#### col

Randomized triangular mosaic using `clip-path`. Each cell picks a random
triangle orientation from the theme palette.

<doodle-controls></doodle-controls>

::: Notes
The `triangles` pattern uses CSS `clip-path: polygon()` to cut each grid cell
into a random triangle orientation. The theme palette provides colours. The
`<doodle-controls>` component lets presenters interactively adjust parameters.
:::

[](.layout-two-col#squares)

### Squares (Animated)

![css-doodle](#squares,animate,speed=2)

#### col

Rotated and scaled squares that spin continuously. Use `speed` to control
the animation rate.

<doodle-controls></doodle-controls>

::: Notes
The `squares` pattern with `animate` and `speed=2` creates continuously rotating
squares. The `animate` flag enables CSS animations on each cell; `speed` is a
multiplier for the animation duration (higher = faster).
:::

[](.layout-two-col#hexagons)

### Hexagons

![css-doodle](#hexagons)

#### col

Honeycomb grid clipped to hexagon shapes. Adjust `grid` to control cell density.

<doodle-controls></doodle-controls>

::: Notes
The `hexagons` pattern clips cells to hexagonal shapes and arranges them in a
honeycomb layout. The `grid` parameter controls cell density — higher values
produce a finer honeycomb texture.
:::

[](.layout-two-col#diamonds)

### Diamonds

![css-doodle](#diamonds,grid=10)

#### col

Diamond lattice with random orientations and opacity variation.

<doodle-controls></doodle-controls>

::: Notes
The `diamonds` pattern creates a lattice of diamond shapes with random orientations
and opacity variation. The explicit `grid=10` parameter sets a 10×10 cell grid
for a balanced density.
:::

[](.layout-two-col#circles)

### Circles

![css-doodle](#circles,grid=12)

#### col

Overlapping circles with radial gradients fading to transparent.

<doodle-controls></doodle-controls>

::: Notes
The `circles` pattern renders overlapping circles with radial gradients that fade
to transparent. The `grid=12` parameter creates a dense 12×12 grid, producing
a bubbly organic texture.
:::

[](.layout-two-col#quarters)

### Quarters

![css-doodle](#quarters)

#### col

Bauhaus-style quarter-circle tiles. Each cell shows a filled rounded
corner facing a random direction — simple geometry that creates
surprisingly organic-looking composition.

<doodle-controls></doodle-controls>

::: Notes
The `quarters` pattern creates Bauhaus-inspired quarter-circle tiles. Each cell
shows a filled rounded corner facing a random direction. Simple geometry that
produces surprisingly organic-looking compositions through randomization.
:::

[](.layout-two-col#waves)

### Waves

![css-doodle](#waves,grid=20x10)

#### col

Sinusoidal wave interference pattern. Use a tall `grid` ratio to emphasise
the horizontal wave bands.

<doodle-controls></doodle-controls>

::: Notes
The `waves` pattern creates sinusoidal interference bands. The `grid=20x10`
parameter specifies a non-square grid (20 columns × 10 rows), which emphasises
horizontal wave bands. Adjust the aspect ratio for different wave effects.
:::

[](.layout-two-col#bubbles)

### Bubbles (Animated)

![css-doodle](#bubbles,animate,speed=0.5)

#### col

Floating bubble shapes with pulsing scale animation. Slow `speed` values
create a calm, organic feel.

<doodle-controls></doodle-controls>

::: Notes
The `bubbles` pattern with `animate,speed=0.5` creates floating shapes with a
slow pulsing scale animation. Low speed values (below 1) produce a calm, ambient
feel suitable for background decoration during quiet moments.
:::

[](.layout-two-col#petals)

### Petals

![css-doodle](#petals,grid=8)

#### col

Petal shapes rotated at random angles, creating a floral texture.

<doodle-controls></doodle-controls>

::: Notes
The `petals` pattern creates flower-like petal shapes rotated at random angles.
The `grid=8` parameter keeps the density moderate so individual petals remain
visually distinct, creating a floral texture.
:::

[](.layout-two-col#dots)

### Dots

![css-doodle](#dots,grid=30)

#### col

Dot matrix with varying sizes — great as a subtle slide background.

<doodle-controls></doodle-controls>

::: Notes
The `dots` pattern creates a dot matrix with varying sizes — a classic halftone
effect. With `grid=30` it produces a dense, fine-grained dot field that works
well as a subtle slide background.
:::

[](.layout-two-col#crosshatch)

### Crosshatch

![css-doodle](#crosshatch,grid=20)

#### col

Cross-hatched texture built with `linear-gradient` stripes.

<doodle-controls></doodle-controls>

::: Notes
The `crosshatch` pattern builds a cross-hatched texture using `linear-gradient`
stripes in each cell. The `grid=20` parameter creates a dense mesh that resembles
hand-drawn hatching.
:::

[](.layout-two-col#lines)

### Lines

![css-doodle](#lines,grid=20)

#### col

Diagonal line pattern with random opacity and spacing.

<doodle-controls></doodle-controls>

::: Notes
The `lines` pattern produces diagonal line segments with random opacity and
spacing. Each cell contains a single line at a random angle, creating an
abstract ruled texture.
:::

[](.layout-two-col#noise)

### Noise

![css-doodle](#noise,grid=20)

#### col

Dense micro-texture resembling film grain. Works as a subtle slide
background at low `opacity`.

<doodle-controls></doodle-controls>

::: Notes
The `noise` pattern generates a dense micro-texture resembling film grain. With
`grid=20` and low `opacity` it works as a subtle background texture that adds
visual depth without distracting from content.
:::

[](.layout-two-col#gradient-grid)

### Gradient Grid

![css-doodle](#gradient-grid,grid=8)

#### col

Smooth colour transitions across each cell, creating a shifting
stained-light effect.

<doodle-controls></doodle-controls>

::: Notes
The `gradient-grid` pattern fills each cell with a smooth colour gradient,
creating a shifting stained-glass effect. The `grid=8` keeps cells large enough
to see the gradient transitions clearly.
:::

[](.layout-two-col#pixels)

### Pixels

![css-doodle](#pixels,grid=24)

#### col

Retro pixel-art blocks. Dense grids produce a mosaic texture; coarse
grids produce a bold blocky look.

<doodle-controls></doodle-controls>

::: Notes
The `pixels` pattern creates retro pixel-art blocks with random colours. Dense
grids (`grid=24`) produce a mosaic texture; coarse grids produce a bold blocky
look suitable for 8-bit nostalgia themes.
:::

[](.layout-two-col#binary)

### Binary

![css-doodle](#binary,grid=16x20)

#### col

0s and 1s in random sizes — great for data-science or coding talks.

<doodle-controls></doodle-controls>

::: Notes
The `binary` pattern renders random 0s and 1s in varying sizes. The `grid=16x20`
uses a tall non-square grid for a column-of-data feel. Perfect for data-science,
cryptography, or programming-themed presentations.
:::


[](.layout-two-col#circuit)

### Circuit

![css-doodle](#circuit,grid=14)

#### col

Circuit-board traces with corner connections — ideal for tech slides.

<doodle-controls></doodle-controls>

::: Notes
The `circuit` pattern draws traces with corner connections resembling a printed
circuit board. With `grid=14` it achieves a balanced density — ideal for
technology, hardware, or engineering-themed slide backgrounds.
:::

[](.layout-two-col#matrix)

### Matrix (Animated)

![css-doodle](#matrix,animate,speed=1.5,grid=20x30)

#### col

Digital rain effect with cascading characters. Increase `grid` columns for
a denser stream.

<doodle-controls></doodle-controls>

::: Notes
The `matrix` pattern with `animate,speed=1.5` creates a digital rain effect with
cascading characters. Increase `grid` columns for a denser stream. This animated
pattern is eye-catching — use sparingly as a background.
:::

[](.layout-two-col#confetti)

### Confetti (Animated)

![css-doodle](#confetti,animate,speed=1)

#### col

Scattered confetti shapes in random orientations, floating gently.

<doodle-controls></doodle-controls>

::: Notes
The `confetti` pattern with `animate,speed=1` scatters confetti shapes in random
orientations that float gently. Great for celebratory slides, announcements,
or achievement milestones.
:::

[](.layout-two-col#stars)

### Stars (Animated)

![css-doodle](#stars,animate,grid=16)

#### col

Twinkling star field. Each star pulses independently.

<doodle-controls></doodle-controls>

::: Notes
The `stars` pattern with `animate` creates a twinkling star field where each star
pulses independently. The `grid=16` parameter controls star density. Works well
for space, astronomy, or aspirational themes.
:::

[](.layout-two-col#mosaic)

### Mosaic

![css-doodle](#mosaic,grid=8)

#### col

Stacked rectangles in random heights — inspired by modernist tile art.

<doodle-controls></doodle-controls>

::: Notes
The `mosaic` pattern generates stacked rectangles of random heights inspired by
modernist tile art. With `grid=8` the tiles are large enough to see the height
variation clearly.
:::

[](#.mod-coverbg)

### Full-Bleed Background

![css-doodle](#mosaic,cover,opacity=0.3)

::: Notes
The `cover` flag (similar to `bg`) makes the doodle fill the entire slide as a
background. Combined with `opacity=0.3` and `.mod-coverbg`, this creates a
subtle decorative background behind any slide content.
:::

[](.layout-two-col#custom-colors)

### Custom Colors

![css-doodle](#triangles,colors=#ff6b6b|#4ecdc4|#45b7d1,grid=12)

#### col

Override theme colors with `colors=#hex1|#hex2|…`. Separate values with `|`.

<doodle-controls></doodle-controls>

::: Notes
The `colors` parameter overrides the theme palette with custom hex values
separated by `|`. This lets you match patterns to specific brand colours or
create high-contrast effects independent of the deck theme.
:::

[](.layout-two-col#nohole)

### No Holes (`nohole`)

![css-doodle](#triangles,nohole)

#### col

The `nohole` flag replaces the surface color slot with a dark accent
variant. Without it, some cells may pick the slide background color
and look like transparent holes.

<doodle-controls></doodle-controls>

::: Notes
The `nohole` flag replaces the surface colour slot (which normally picks the
slide background colour) with a dark accent variant. Without it, some cells may
appear transparent — `nohole` ensures every cell is visibly filled.
:::

[](.layout-two-col#opacity-demo)

### Opacity Control

![css-doodle](#mosaic,grid=10,opacity=0.35)

#### col

Use `opacity=0…1` to layer a pattern subtly over the slide background.

<doodle-controls></doodle-controls>

::: Notes
The `opacity` parameter (0 to 1) controls the overall transparency of the doodle.
Low values (0.1–0.3) create subtle textures suitable for backgrounds; higher
values make the pattern more prominent as primary visual content.
:::

[](.layout-two-col#speed-demo)

### Animation Speed

![css-doodle](#confetti,animate,speed=3)

#### col

`speed=3` triples the animation rate. Values below 1 slow it down — `speed=0.3` creates a languid, ambient feel.
Use `animate,speed=N` on any animated pattern: `squares`, `bubbles`, `stars`, `matrix`, `confetti`.

<doodle-controls></doodle-controls>

::: Notes
The `speed` parameter is a multiplier for animation duration. Values above 1
speed up animations; values below 1 slow them down. It works with any animated
pattern: `squares`, `bubbles`, `stars`, `matrix`, `confetti`.
:::

[](.layout-two-col#seed)

### Reproducible Patterns

![css-doodle](#confetti,seed=42)

#### col

Use `seed=N` for a deterministic pattern — ideal when you need the same
layout on every render.

<doodle-controls></doodle-controls>

::: Notes
The `seed` parameter makes patterns deterministic — the same seed always produces
the same random layout. This is essential for reproducible slides in version
control or when you need consistent visuals across renders.
:::

[](#.mod-coverbg)

### Thank You!

![css-doodle](#gradient-grid,bg,opacity=0.2)

::: Notes
This closing slide uses `gradient-grid` as a full background with low opacity.
The CSS Doodle plugin demonstrates how procedural art can enhance presentations
without requiring any image assets — everything is generated with pure CSS.
:::
