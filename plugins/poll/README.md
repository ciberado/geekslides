# poll

Live audience polling with real-time vote aggregation for GeekSlides.

## Overview

The `poll` plugin enables interactive audience polls during presentations. Attendees vote via a web interface, and results are aggregated in real time using Yjs CRDT sync and displayed as a live bar chart on the presenter's slide.

## Usage

Add the feature to your deck's `config.json`:

```json
{
  "features": ["poll"]
}
```

Mark a slide as a poll by adding the `poll` class:

```markdown
[](#my-poll,.poll)
## Which framework do you prefer?

- React
- Vue
- Svelte
```

Voters visit `/vote` on the presentation URL. The slide updates live as votes arrive.

## Dependencies

- `chart.js` — renders the live vote bar chart
- Yjs sync — aggregates votes across connected clients
