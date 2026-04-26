import { LitElement, html, css, type TemplateResult, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { apiClient, type Presentation, type LaunchResult, type GitHubCheckResult } from '../services/api.ts';
import { fuzzyMatch } from '../utils/fuzzy.ts';

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
    .toolbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .search-input {
      flex: 1;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--gs-border);
      border-radius: var(--gs-radius);
      background: var(--gs-bg);
      color: var(--gs-text);
      font: inherit;
      font-size: 0.875rem;
    }
    .search-input:focus { outline: none; border-color: var(--gs-accent); }
    .view-toggle { display: flex; }
    .view-toggle button {
      padding: 0.375rem 0.625rem;
      border: 1px solid var(--gs-border);
      background: transparent;
      color: var(--gs-text-muted);
      font: inherit;
      font-size: 1rem;
      cursor: pointer;
      line-height: 1;
    }
    .view-toggle button:first-child { border-radius: var(--gs-radius) 0 0 var(--gs-radius); }
    .view-toggle button:last-child { border-radius: 0 var(--gs-radius) var(--gs-radius) 0; border-left: none; }
    .view-toggle button.active { background: var(--gs-accent); color: white; border-color: var(--gs-accent); }
    .list { display: flex; flex-direction: column; gap: 0.5rem; }
    .list-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: var(--gs-surface);
      border: 1px solid var(--gs-border);
      border-radius: var(--gs-radius);
      padding: 0.625rem 1rem;
    }
    .list-row-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.625rem; }
    .list-row-title {
      font-size: 0.9375rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .list-row-meta {
      font-size: 0.75rem;
      color: var(--gs-text-muted);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
      white-space: nowrap;
    }
    .list-row-actions { display: flex; gap: 0.375rem; flex-shrink: 0; flex-wrap: wrap; }
    .list-row-actions button {
      padding: 0.25rem 0.625rem;
      border: 1px solid var(--gs-border);
      border-radius: var(--gs-radius);
      background: transparent;
      color: var(--gs-text);
      font: inherit;
      font-size: 0.75rem;
      cursor: pointer;
      white-space: nowrap;
    }
    .list-row-actions button:hover { border-color: var(--gs-accent); color: var(--gs-accent); }
    .list-row-actions button.danger:hover { border-color: var(--gs-danger); color: var(--gs-danger); }
    .list-row-actions button.present {
      background: var(--gs-accent);
      border-color: var(--gs-accent);
      color: white;
    }
    .list-row-actions button.present:hover { background: var(--gs-accent-hover); }
    .no-results { text-align: center; padding: 2rem; color: var(--gs-text-muted); }
  `;

  @state() private _presentations: Presentation[] = [];
  @state() private _showUpload = false;
  @state() private _uploadTab: 'files' | 'zip' | 'github' = 'files';
  @state() private _uploadTitle = '';
  @state() private _titleManuallyEdited = false;
  @state() private _githubUrl = '';
  @state() private _uploading = false;
  @state() private _error = '';
  @state() private _launchResult: LaunchResult | null = null;
  @state() private _replaceTarget: Presentation | null = null;
  @state() private _editTarget: Presentation | null = null;
  @state() private _editTitle = '';
  @state() private _editDescription = '';
  @state() private _editVisibility: 'private' | 'public' = 'private';
  @state() private _githubStatus: Map<string, GitHubCheckResult | 'checking' | 'refreshing' | 'error'> = new Map();
  @state() private _layout: 'cards' | 'list' = 'cards';
  @state() private _filter = '';

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
      this._titleManuallyEdited = false;
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
    const items = this._filtered;
    return html`
      <div class="header">
        <h1>My Presentations</h1>
        <button class="btn-primary" @click=${() => { this._showUpload = true; }}>New Presentation</button>
      </div>

      ${this._presentations.length > 0 ? html`
        <div class="toolbar">
          <input class="search-input" type="search" placeholder="Filter presentations…"
            .value=${this._filter}
            @input=${(e: Event) => { this._filter = (e.target as HTMLInputElement).value; }}>
          <div class="view-toggle">
            <button class=${this._layout === 'cards' ? 'active' : ''} title="Card view"
              @click=${() => { this._layout = 'cards'; }}>⊞</button>
            <button class=${this._layout === 'list' ? 'active' : ''} title="List view"
              @click=${() => { this._layout = 'list'; }}>☰</button>
          </div>
        </div>
      ` : nothing}

      ${items.length === 0 && this._filter
        ? html`<div class="no-results">No presentations match "<strong>${this._filter}</strong>"</div>`
        : items.length === 0
        ? html`<div class="empty"><p>No presentations yet. Create your first one!</p></div>`
        : this._layout === 'list'
        ? html`<div class="list">${items.map((p) => this._renderListRow(p))}</div>`
        : html`
          <div class="grid">
            ${items.map((p) => html`
              <div class="card">
                <div class="card-title">${p.title}</div>
                <div class="card-meta">
                  <span class="badge ${p.visibility === 'public' ? 'badge-public' : 'badge-private'}">${p.visibility}</span>
                  · ${this._formatSize(p.sizeBytes)}
                </div>
                <div class="card-actions">
                  <button class="present" @click=${() => void this._launch(p.id)}>Present</button>
                  <button @click=${() => { this._openEdit(p); }}>Edit</button>
                  <button @click=${() => { this._replaceFiles(p); }}>Replace Files</button>
                  ${p.githubUrl ? this._renderGitHubAction(p) : nothing}
                  <button class="danger" @click=${() => void this._delete(p.id)}>Delete</button>
                </div>
              </div>
            `)}
          </div>
        `}

      ${this._showUpload ? this._renderUploadModal() : nothing}
      ${this._replaceTarget ? this._renderReplaceModal() : nothing}
      ${this._editTarget ? this._renderEditModal() : nothing}
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
            @input=${(e: Event) => { this._uploadTitle = (e.target as HTMLInputElement).value; this._titleManuallyEdited = true; }}>

          <div class="tab-bar">
            <button class="tab ${this._uploadTab === 'files' ? 'active' : ''}" @click=${() => { this._uploadTab = 'files'; }}>Files</button>
            <button class="tab ${this._uploadTab === 'zip' ? 'active' : ''}" @click=${() => { this._uploadTab = 'zip'; }}>Zip</button>
            <button class="tab ${this._uploadTab === 'github' ? 'active' : ''}" @click=${() => { this._uploadTab = 'github'; }}>GitHub</button>
          </div>

          ${this._uploadTab === 'files' ? html`
            <label>Select the deck folder (must contain config.json)</label>
            <input type="file" id="files-input" webkitdirectory
              @change=${(e: Event) => { const input = e.target as HTMLInputElement; if (input.files?.length) void this._extractTitleFromFiles(input.files); }}>
          ` : nothing}

          ${this._uploadTab === 'zip' ? html`
            <label>Select zip archive</label>
            <input type="file" id="zip-input" accept=".zip"
              @change=${(e: Event) => {
                const input = e.target as HTMLInputElement;
                const file = input.files?.[0];
                if (file && !this._titleManuallyEdited) {
                  this._uploadTitle = file.name.replace(/\.zip$/i, '');
                }
              }}>
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

  private _renderGitHubAction(p: Presentation): TemplateResult {
    const status = this._githubStatus.get(p.id);
    if (!status) {
      return html`<button @click=${() => void this._checkGitHub(p)}>Check GitHub</button>`;
    }
    if (status === 'checking') return html`<button disabled>Checking…</button>`;
    if (status === 'refreshing') return html`<button disabled>Refreshing…</button>`;
    if (status === 'error') {
      return html`<button @click=${() => void this._checkGitHub(p)}>Retry</button>`;
    }
    if (status.hasUpdate) {
      return html`<button @click=${() => void this._refreshGitHub(p)} title="New commit: ${status.latestSha?.slice(0, 7) ?? ''}">↑ Update</button>`;
    }
    return html`<button @click=${() => void this._checkGitHub(p)} title="Up to date (${status.currentSha?.slice(0, 7) ?? ''})">✓ Up to date</button>`;
  }

  private _renderEditModal(): TemplateResult {
    return html`
      <div class="modal-overlay" @click=${(e: Event) => { if (e.target === e.currentTarget) this._editTarget = null; }}>
        <div class="modal">
          <h2>Edit — ${this._editTarget?.title}</h2>
          ${this._error ? html`<div class="error">${this._error}</div>` : nothing}

          <label>Title</label>
          <input type="text" .value=${this._editTitle}
            @input=${(e: Event) => { this._editTitle = (e.target as HTMLInputElement).value; }}>

          <label>Description</label>
          <input type="text" .value=${this._editDescription}
            @input=${(e: Event) => { this._editDescription = (e.target as HTMLInputElement).value; }}>

          <label>Visibility</label>
          <select .value=${this._editVisibility}
            @change=${(e: Event) => { this._editVisibility = (e.target as HTMLSelectElement).value as 'private' | 'public'; }}>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>

          <div class="modal-actions">
            <button class="tab" @click=${() => { this._editTarget = null; }}>Cancel</button>
            <button class="btn-primary" @click=${(e: Event) => void this._saveEdit(e)}>Save</button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderReplaceModal(): TemplateResult {    return html`
      <div class="modal-overlay" @click=${(e: Event) => { if (e.target === e.currentTarget) this._replaceTarget = null; }}>
        <div class="modal">
          <h2>Replace Files — ${this._replaceTarget?.title}</h2>
          ${this._error ? html`<div class="error">${this._error}</div>` : nothing}

          <label>Select the updated deck folder</label>
          <input type="file" id="replace-files-input" webkitdirectory>

          <div class="modal-actions">
            <button class="tab" @click=${() => { this._replaceTarget = null; }}>Cancel</button>
            <button class="btn-primary" ?disabled=${this._uploading} @click=${(e: Event) => void this._doReplace(e)}>
              ${this._uploading ? 'Uploading…' : 'Replace'}
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

  private async _extractTitleFromFiles(files: FileList): Promise<void> {
    if (this._titleManuallyEdited) return;
    for (const file of Array.from(files)) {
      const rel = file.webkitRelativePath || file.name;
      if (rel.split('/').some((s) => s.startsWith('.'))) continue;
      const name = rel.split('/').pop() ?? '';
      if (!name.endsWith('.md')) continue;
      try {
        const text = await file.text();
        const match = /^#\s+(.+)$/m.exec(text);
        if (match?.[1]) { this._uploadTitle = match[1].trim(); return; }
      } catch { /* ignore read errors */ }
    }
  }

  private _replaceFiles(p: Presentation): void {
    this._replaceTarget = p;
  }

  private async _doReplace(e: Event): Promise<void> {
    e.preventDefault();
    if (!this._replaceTarget) return;
    this._error = '';
    this._uploading = true;
    try {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>('#replace-files-input');
      const files = input?.files;
      if (!files?.length) { this._error = 'Select files'; this._uploading = false; return; }
      await apiClient.reuploadPresentationFiles(this._replaceTarget.id, files);
      this._replaceTarget = null;
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Replace failed';
    } finally {
      this._uploading = false;
    }
  }

  private async _toggleVisibility(p: Presentation): Promise<void> {
    await apiClient.updatePresentation(p.id, {
      visibility: p.visibility === 'public' ? 'private' : 'public',
    });
    await this._load();
  }

  private _openEdit(p: Presentation): void {
    this._editTarget = p;
    this._editTitle = p.title;
    this._editDescription = p.description;
    this._editVisibility = p.visibility;
    this._error = '';
  }

  private async _saveEdit(e: Event): Promise<void> {
    e.preventDefault();
    if (!this._editTarget) return;
    this._error = '';
    try {
      await apiClient.updatePresentation(this._editTarget.id, {
        title: this._editTitle,
        description: this._editDescription,
        visibility: this._editVisibility,
      });
      this._editTarget = null;
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Update failed';
    }
  }

  private async _checkGitHub(p: Presentation): Promise<void> {
    this._githubStatus = new Map(this._githubStatus).set(p.id, 'checking');
    try {
      const result = await apiClient.checkGitHubUpdate(p.id);
      this._githubStatus = new Map(this._githubStatus).set(p.id, result);
    } catch {
      this._githubStatus = new Map(this._githubStatus).set(p.id, 'error');
    }
  }

  private async _refreshGitHub(p: Presentation): Promise<void> {
    this._githubStatus = new Map(this._githubStatus).set(p.id, 'refreshing');
    try {
      await apiClient.refreshFromGitHub(p.id);
      this._githubStatus = new Map(this._githubStatus).set(p.id, 'checking');
      await this._load();
      // Re-check after refresh to confirm up-to-date
      const result = await apiClient.checkGitHubUpdate(p.id);
      this._githubStatus = new Map(this._githubStatus).set(p.id, result);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Refresh failed';
      this._githubStatus = new Map(this._githubStatus).set(p.id, 'error');
    }
  }

  private get _filtered(): Presentation[] {
    const q = this._filter.trim().toLowerCase();
    if (!q) return this._presentations;
    return this._presentations.filter((p) => fuzzyMatch(p.title, q));
  }

  private _renderListRow(p: Presentation): TemplateResult {
    return html`
      <div class="list-row">
        <div class="list-row-info">
          <div class="list-row-title">${p.title}</div>
          <div class="list-row-meta">
            <span class="badge ${p.visibility === 'public' ? 'badge-public' : 'badge-private'}">${p.visibility}</span>
            <span>${this._formatSize(p.sizeBytes)}</span>
            ${p.githubUrl ? html`<span title=${p.githubUrl}>⎇ GitHub</span>` : nothing}
          </div>
        </div>
        <div class="list-row-actions">
          <button class="present" @click=${() => void this._launch(p.id)}>Present</button>
          <button @click=${() => { this._openEdit(p); }}>Edit</button>
          <button @click=${() => { this._replaceFiles(p); }}>Replace</button>
          ${p.githubUrl ? this._renderGitHubAction(p) : nothing}
          <button class="danger" @click=${() => void this._delete(p.id)}>Delete</button>
        </div>
      </div>
    `;
  }

  private _formatSize(bytes: number): string {
    if (bytes < 1024) return `${String(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
