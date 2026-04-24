import { LitElement, html, css, type TemplateResult, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { apiClient, type Presentation, type LaunchResult } from '../services/api.ts';

@customElement('hub-dashboard-page')
export class DashboardPage extends LitElement {
  static override styles = css`
    :host { display: block; }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    h1 { font-size: 1.5rem; }
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
    .card-title {
      font-size: 1.0625rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
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
    .badge-public { background: rgba(34,197,94,0.15); color: var(--gs-success); }
    .badge-private { background: rgba(148,163,184,0.15); color: var(--gs-text-muted); }
    .card-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
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
    .card-actions button.danger:hover { border-color: var(--gs-danger); color: var(--gs-danger); }
    .card-actions button.present {
      background: var(--gs-accent);
      border-color: var(--gs-accent);
      color: white;
    }
    .card-actions button.present:hover { background: var(--gs-accent-hover); }
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
    .modal label { display: block; font-size: 0.8125rem; color: var(--gs-text-muted); margin-bottom: 0.25rem; }
    .modal input, .modal select {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--gs-border);
      border-radius: var(--gs-radius);
      background: var(--gs-bg);
      color: var(--gs-text);
      font: inherit;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }
    .modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
    .tab-bar { display: flex; gap: 0; margin-bottom: 1rem; }
    .tab {
      padding: 0.5rem 1rem;
      border: 1px solid var(--gs-border);
      background: transparent;
      color: var(--gs-text-muted);
      font: inherit;
      font-size: 0.8125rem;
      cursor: pointer;
    }
    .tab:first-child { border-radius: var(--gs-radius) 0 0 var(--gs-radius); }
    .tab:last-child { border-radius: 0 var(--gs-radius) var(--gs-radius) 0; }
    .tab.active { background: var(--gs-accent); color: white; border-color: var(--gs-accent); }
    .error { color: var(--gs-danger); font-size: 0.8125rem; margin-bottom: 0.75rem; }
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
  `;

  @state() private _presentations: Presentation[] = [];
  @state() private _showUpload = false;
  @state() private _uploadTab: 'files' | 'zip' | 'github' = 'files';
  @state() private _uploadTitle = '';
  @state() private _githubUrl = '';
  @state() private _uploading = false;
  @state() private _error = '';
  @state() private _launchResult: LaunchResult | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  private async _load(): Promise<void> {
    const { items } = await apiClient.listPresentations();
    this._presentations = items;
  }

  private async _upload(e: Event): Promise<void> {
    e.preventDefault();
    this._error = '';
    this._uploading = true;

    try {
      if (this._uploadTab === 'github') {
        await apiClient.createPresentationFromGitHub(this._uploadTitle, this._githubUrl);
      } else if (this._uploadTab === 'zip') {
        const input = this.shadowRoot?.querySelector<HTMLInputElement>('#zip-input');
        const file = input?.files?.[0];
        if (!file) { this._error = 'Select a zip file'; this._uploading = false; return; }
        await apiClient.createPresentationFromZip(this._uploadTitle, file);
      } else {
        const input = this.shadowRoot?.querySelector<HTMLInputElement>('#files-input');
        const files = input?.files;
        if (!files?.length) { this._error = 'Select files'; this._uploading = false; return; }
        await apiClient.createPresentationFromFiles(this._uploadTitle, files);
      }
      this._showUpload = false;
      this._uploadTitle = '';
      this._githubUrl = '';
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Upload failed';
    } finally {
      this._uploading = false;
    }
  }

  private async _launch(id: string): Promise<void> {
    try {
      const result = await apiClient.launchPresentation(id);
      this._launchResult = result;
      window.open(result.url, '_blank');
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Launch failed';
    }
  }

  private async _delete(id: string): Promise<void> {
    if (!confirm('Delete this presentation? This cannot be undone.')) return;
    await apiClient.deletePresentation(id);
    await this._load();
  }

  private _copyShareUrl(): void {
    if (this._launchResult) {
      const full = new URL(this._launchResult.shareUrl, window.location.origin).href;
      void navigator.clipboard.writeText(full);
    }
  }

  override render(): TemplateResult {
    return html`
      <div class="header">
        <h1>My Presentations</h1>
        <button class="btn-primary" @click=${() => { this._showUpload = true; }}>New Presentation</button>
      </div>

      ${this._presentations.length === 0
        ? html`<div class="empty"><p>No presentations yet. Create your first one!</p></div>`
        : html`
          <div class="grid">
            ${this._presentations.map((p) => html`
              <div class="card">
                <div class="card-title">${p.title}</div>
                <div class="card-meta">
                  <span class="badge ${p.visibility === 'public' ? 'badge-public' : 'badge-private'}">${p.visibility}</span>
                  · ${this._formatSize(p.sizeBytes)}
                </div>
                <div class="card-actions">
                  <button class="present" @click=${() => void this._launch(p.id)}>Present</button>
                  <button @click=${() => void this._toggleVisibility(p)}>
                    ${p.visibility === 'public' ? 'Make Private' : 'Make Public'}
                  </button>
                  <button class="danger" @click=${() => void this._delete(p.id)}>Delete</button>
                </div>
              </div>
            `)}
          </div>
        `}

      ${this._showUpload ? this._renderUploadModal() : nothing}
      ${this._launchResult ? this._renderShareModal() : nothing}
    `;
  }

  private _renderUploadModal(): TemplateResult {
    return html`
      <div class="modal-overlay" @click=${(e: Event) => { if (e.target === e.currentTarget) this._showUpload = false; }}>
        <div class="modal">
          <h2>New Presentation</h2>
          ${this._error ? html`<div class="error">${this._error}</div>` : nothing}

          <label>Title</label>
          <input type="text" .value=${this._uploadTitle}
            @input=${(e: Event) => { this._uploadTitle = (e.target as HTMLInputElement).value; }}>

          <div class="tab-bar">
            <button class="tab ${this._uploadTab === 'files' ? 'active' : ''}" @click=${() => { this._uploadTab = 'files'; }}>Files</button>
            <button class="tab ${this._uploadTab === 'zip' ? 'active' : ''}" @click=${() => { this._uploadTab = 'zip'; }}>Zip</button>
            <button class="tab ${this._uploadTab === 'github' ? 'active' : ''}" @click=${() => { this._uploadTab = 'github'; }}>GitHub</button>
          </div>

          ${this._uploadTab === 'files' ? html`
            <label>Select the deck folder (must contain config.json)</label>
            <input type="file" id="files-input" webkitdirectory>
          ` : nothing}

          ${this._uploadTab === 'zip' ? html`
            <label>Select zip archive</label>
            <input type="file" id="zip-input" accept=".zip">
          ` : nothing}

          ${this._uploadTab === 'github' ? html`
            <label>GitHub repository URL</label>
            <input type="url" placeholder="https://github.com/user/repo"
              .value=${this._githubUrl}
              @input=${(e: Event) => { this._githubUrl = (e.target as HTMLInputElement).value; }}>
          ` : nothing}

          <div class="modal-actions">
            <button class="tab" @click=${() => { this._showUpload = false; }}>Cancel</button>
            <button class="btn-primary" ?disabled=${this._uploading} @click=${(e: Event) => void this._upload(e)}>
              ${this._uploading ? 'Uploading…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderShareModal(): TemplateResult {
    return html`
      <div class="modal-overlay" @click=${(e: Event) => { if (e.target === e.currentTarget) this._launchResult = null; }}>
        <div class="modal">
          <h2>Presentation Launched</h2>
          <p style="font-size:0.875rem;color:var(--gs-text-muted)">Share this URL with your audience:</p>
          <div class="share-url">
            <span>${this._launchResult?.shareUrl}</span>
            <button @click=${() => { this._copyShareUrl(); }}>Copy</button>
          </div>
          <div class="modal-actions" style="margin-top:1rem">
            <button class="btn-primary" @click=${() => { this._launchResult = null; }}>Done</button>
          </div>
        </div>
      </div>
    `;
  }

  private async _toggleVisibility(p: Presentation): Promise<void> {
    await apiClient.updatePresentation(p.id, {
      visibility: p.visibility === 'public' ? 'private' : 'public',
    });
    await this._load();
  }

  private _formatSize(bytes: number): string {
    if (bytes < 1024) return `${String(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
