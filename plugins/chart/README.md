# chart

Renders data tables as Chart.js visualisations inside slides. Add the `.chart` class (and optionally a chart-type class) to a slide marker, then write a standard Markdown table — it is replaced at render time with an interactive chart.

## What it provides

| Part | Name | Role |
|------|------|------|
| Processor | `chart` | Replaces `<table>` elements in `.chart` slides with `<geek-chart>` components |

## Usage

```json
{ "plugins": ["chart"] }
```

## Markdown syntax

### Bar chart (default)

```markdown
[](#sales,.chart)

## Q1 Sales

| Product | Units |
|---------|-------|
| Alpha   | 120   |
| Beta    | 95    |
| Gamma   | 210   |
```

### Line chart

```markdown
[](#trend,.chart.line)

## Monthly Visitors

| Month | Visitors |
|-------|----------|
| Jan   | 4200     |
| Feb   | 5100     |
| Mar   | 4800     |
```

### Supported chart types

| CSS class | Chart.js type |
|-----------|--------------|
| `.chart` (no extra class) | `bar` |
| `.chart.line` | `line` |
| `.chart.pie` | `pie` |
| `.chart.doughnut` | `doughnut` |
| `.chart.radar` | `radar` |

## Table format

- **First column**: labels (x-axis categories or pie/doughnut segments).
- **Remaining columns**: one dataset each; column headers become dataset labels.
- Numeric cells are parsed automatically; non-numeric values are treated as 0.

## Notes

- The `chart` plugin does not pull in `core`. If you also want heading-based slide separators, use `plugins: ["core", "chart"]` or add `core` explicitly.
- Chart.js is bundled with the engine and loaded lazily — no CDN dependency.
