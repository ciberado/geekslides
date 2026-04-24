import { LitElement, html, css, type TemplateResult, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { apiClient, type Presentation } from '../services/api.ts';

@customElement('hub-search-page')
export class SearchPage extends LitElement {
  static override styles = css`
    :host { display: block; }
    .search-bar {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    input {
      flex: 1;
      padding: 0.625rem 1rem;
      border: 1px solid var(--gs-border);
      border-radius: var(--gs-radius);
      background: var(--gs-surface);
      color: var(--gs-text);
      font: inherit;
      font-size: 0.9375rem;
    }
    input:focus { outline: none; border-color: var(--gs-accent); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }
    .card {
      background: var(--gs-surface);
      border: 1px solid var(--gs-border);
      border-radius: var(--gs-radius);
      padding: 1.25rem;
    }
    .card-title { font-weight: 600; margin-bottom: 0.25rem; }
    .card-desc {
      font-size: 0.8125rem;
      color: var(--gs-text-muted);
      margin-bottom: 0.5rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-author {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--gs-text-muted);
    }
    .card-author img {
      width: 20px;
      height: 20px;
      border-radius: 50%;
    }
    .btn-present {
      margin-top: 0.75rem;
      padding: 0.375rem 0.75rem;
      border: none;
      border-radius: var(--gs-radius);
      background: var(--gs-accent);
      color: white;
      font: inherit;
      font-size: 0.8125rem;
      cursor: pointer;
    }
    .btn-present:hover { background: var(--gs-accent-hover); }
    .empty { text-align: center; padding: 3rem; color: var(--gs-text-muted); }
  `;

  @state() private _query = '';
  @state() private _results: Array<Presentation & { ownerName: string; ownerAvatarUrl: string | null }> = [];
  @state() private _searched = false;

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private _onInput(e: Event): void {
    this._query = (e.target as HTMLInputElement).value;
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => { void this._search(); }, 300);
  }

  private async _search(): Promise<void> {
    if (!this._query.trim()) {
      this._results = [];
      this._searched = false;
      return;
    }
    const { items } = await apiClient.search(this._query);
    this._results = items;
    this._searched = true;
  }

  private async _launch(id: string): Promise<void> {
    const result = await apiClient.launchPresentation(id);
    window.open(result.url, '_blank');
  }

  override render(): TemplateResult {
    return html`
      <div class="search-bar">
        <input
          type="search"
          placeholder="Search public presentations…"
          .value=${this._query}
          @input=${(e: Event) => { this._onInput(e); }}
        >
      </div>

      ${this._searched && this._results.length === 0
        ? html`<div class="empty">No results found</div>`
        : nothing}

      <div class="grid">
        ${this._results.map((r) => html`
          <div class="card">
            <div class="card-title">${r.title}</div>
            <div class="card-desc">${r.description}</div>
            <div class="card-author">
              ${r.ownerAvatarUrl ? html`<img src=${r.ownerAvatarUrl} alt="">` : nothing}
              <span>${r.ownerName}</span>
            </div>
            <button class="btn-present" @click=${() => void this._launch(r.id)}>Present</button>
          </div>
        `)}
      </div>
    `;
  }
}
