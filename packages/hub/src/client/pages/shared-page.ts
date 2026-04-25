import { LitElement, html, css, type TemplateResult, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { apiClient, type SharedPresentation, type LaunchResult } from '../services/api.ts';

@customElement('hub-shared-page')
export class SharedPage extends LitElement {
  static override styles = css`
    :host { display: block; }
    h1 { font-size: 1.5rem; margin-bottom: 1.5rem; }
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
    .card-meta {
      font-size: 0.75rem;
      color: var(--gs-text-muted);
      margin-bottom: 0.75rem;
    }
    .badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 12px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-pending { background: rgba(234,179,8,0.15); color: #ca8a04; }
    .badge-accepted { background: rgba(34,197,94,0.15); color: var(--gs-success); }
    .badge-copresenter { background: rgba(99,102,241,0.15); color: #6366f1; }
    .card-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
    .card-actions button {
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--gs-border);
      border-radius: var(--gs-radius);
      background: transparent;
      color: var(--gs-text);
      font: inherit;
      font-size: 0.8125rem;
      cursor: pointer;
    }
    .card-actions button:hover { border-color: var(--gs-accent); color: var(--gs-accent); }
    .card-actions button.present {
      background: var(--gs-accent);
      border-color: var(--gs-accent);
      color: white;
    }
    .card-actions button.present:hover { background: var(--gs-accent-hover); }
    .card-actions button.danger:hover { border-color: var(--gs-danger); color: var(--gs-danger); }
    .empty {
      text-align: center;
      padding: 3rem;
      color: var(--gs-text-muted);
    }
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: var(--gs-surface);
      border: 1px solid var(--gs-border);
      border-radius: 12px;
      padding: 2rem;
      max-width: 480px;
      width: 100%;
    }
    .modal h2 { font-size: 1.25rem; margin-bottom: 1rem; }
    .share-url {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-top: 1rem;
      padding: 0.75rem;
      background: var(--gs-bg);
      border-radius: var(--gs-radius);
      font-size: 0.75rem;
      word-break: break-all;
    }
    .share-url button {
      white-space: nowrap;
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--gs-border);
      border-radius: var(--gs-radius);
      background: transparent;
      color: var(--gs-text);
      font: inherit;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; }
    .btn-primary {
      padding: 0.5rem 1.25rem;
      border: none;
      border-radius: var(--gs-radius);
      background: var(--gs-accent);
      color: white;
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .btn-primary:hover { background: var(--gs-accent-hover); }
  `;

  @state() private _shares: SharedPresentation[] = [];
  @state() private _loading = true;
  @state() private _launchResult: LaunchResult | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    try {
      const { items } = await apiClient.listSharedWithMe();
      this._shares = items;
    } finally {
      this._loading = false;
    }
  }

  private async _accept(shareId: string): Promise<void> {
    await apiClient.acceptShare(shareId);
    await this._load();
  }

  private async _reject(shareId: string): Promise<void> {
    await apiClient.rejectShare(shareId);
    await this._load();
  }

  private async _launch(presentationId: string): Promise<void> {
    const result = await apiClient.launchPresentation(presentationId);
    this._launchResult = result;
    window.open(result.url, '_blank');
  }

  private _copyShareUrl(): void {
    if (this._launchResult) {
      const full = new URL(this._launchResult.shareUrl, window.location.origin).href;
      void navigator.clipboard.writeText(full);
    }
  }

  override render(): TemplateResult {
    if (this._loading) return html`<p>Loading…</p>`;

    const pending = this._shares.filter((s) => s.status === 'pending');
    const accepted = this._shares.filter((s) => s.status === 'accepted');

    return html`
      <h1>Shared with Me</h1>

      ${pending.length > 0 ? html`
        <h2 style="font-size:1rem;margin-bottom:0.75rem;color:var(--gs-text-muted)">Pending Invitations</h2>
        <div class="grid" style="margin-bottom:2rem">
          ${pending.map((s) => html`
            <div class="card">
              <div class="card-title">${s.presentation.title}</div>
              <div class="card-meta">
                <span class="badge badge-pending">Pending</span>
                · <span class="badge ${s.role === 'copresenter' ? 'badge-copresenter' : ''}">${s.role}</span>
              </div>
              <div class="card-actions">
                <button @click=${() => void this._accept(s.id)}>Accept</button>
                <button class="danger" @click=${() => void this._reject(s.id)}>Decline</button>
              </div>
            </div>
          `)}
        </div>
      ` : nothing}

      ${accepted.length === 0 && pending.length === 0
        ? html`<div class="empty"><p>No presentations shared with you yet.</p></div>`
        : nothing}

      ${accepted.length > 0 ? html`
        ${pending.length > 0 ? html`<h2 style="font-size:1rem;margin-bottom:0.75rem;color:var(--gs-text-muted)">Accepted</h2>` : nothing}
        <div class="grid">
          ${accepted.map((s) => html`
            <div class="card">
              <div class="card-title">${s.presentation.title}</div>
              <div class="card-meta">
                <span class="badge badge-accepted">Accepted</span>
                · <span class="badge ${s.role === 'copresenter' ? 'badge-copresenter' : ''}">${s.role}</span>
              </div>
              <div class="card-actions">
                <button class="present" @click=${() => void this._launch(s.presentation.id)}>Present</button>
              </div>
            </div>
          `)}
        </div>
      ` : nothing}

      ${this._launchResult ? html`
        <div class="modal-overlay" @click=${(e: Event) => { if (e.target === e.currentTarget) this._launchResult = null; }}>
          <div class="modal">
            <h2>Presentation Launched</h2>
            <p style="font-size:0.875rem;color:var(--gs-text-muted)">Share this URL with your audience:</p>
            <div class="share-url">
              <span>${this._launchResult.shareUrl}</span>
              <button @click=${() => { this._copyShareUrl(); }}>Copy</button>
            </div>
            <div class="modal-actions">
              <button class="btn-primary" @click=${() => { this._launchResult = null; }}>Done</button>
            </div>
          </div>
        </div>
      ` : nothing}
    `;
  }
}
