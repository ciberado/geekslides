declare module 'markdown-it-container' {
  import type MarkdownIt from 'markdown-it';

  interface ContainerOptions {
    validate?: (params: string) => boolean;
    render?: (tokens: { nesting: number }[], idx: number) => string;
    marker?: string;
  }

  const plugin: MarkdownIt.PluginWithOptions<ContainerOptions>;
  export default plugin;
}
