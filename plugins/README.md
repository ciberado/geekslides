# GeekSlides Plugin Bundles

This directory contains the canonical manifest for each built-in plugin bundle.
Each subdirectory holds a `plugin.json` that describes the bundle's preprocessors,
processors, features, and dependencies.

## Using a bundle

Reference a bundle by name in your deck's `config.json`:

```json
{ "plugins": ["media", "whiteboard"] }
```

Bundles can also be mixed with explicit plugin lists using the object form:

```json
{
  "plugins": {
    "preprocessors": ["header", "youtube-url"],
    "processors": ["iframe"]
  },
  "features": ["whiteboard"]
}
```

## Available bundles

| Name | Description |
|------|-------------|
| `core` | Heading-based slide separators and basic iframe embeds |
| `media` | YouTube, audio, video embeds + cross-client playback sync (depends on `core`) |
| `whiteboard` | Drawing overlay for live annotation |
| `chart` | Chart.js-powered data visualisation |
| `mermaid` | Mermaid diagram rendering |
| `css-doodle` | Generative CSS doodle background patterns |

## Manifest format

```json
{
  "name": "bundle-name",
  "description": "What this bundle provides",
  "dependsOn": ["other-bundle"],
  "preprocessors": ["name1", "name2"],
  "processors": ["name3"],
  "features": ["feature-name"]
}
```

`dependsOn` causes the listed bundles to be loaded first. The engine deduplicates
all lists, so ordering is stable even when two bundles share a dependency.
