import { LitElement, html, css, type TemplateResult, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { apiClient, type UserProfile } from '../services/api.ts';

@customElement('hub-admin-page')
export class AdminPage extends LitElement {
  static override styles = css`
    :host { display: block; }
    .tab-bar {
      display: flex;
      gap: 0;
      margin-bottom: 1.5rem;
    }
    .tab {
      padding: 0.5rem 1.25rem;
      border: 1px solid var(--gs-border);
      background: transparent;
      color: var(--gs-text-muted);
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .tab:first-child { border-radius: var(--gs-radius) 0 0 var(--gs-radius); }
    .tab:last-child { border-radius: 0 var(--gs-radius) var(--gs-radius) 0; }
    .tab.active { background: var(--gs-accent); color: white; border-color: var(--gs-accent); }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    th, td {
      padding: 0.625rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--gs-border);
    }
    th { color: var(--gs-text-muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
    .badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 12px;
      font-size: 0.6875rem;
      font-weight: 600;
    }
    .badge-pending { background: rgba(245,158,11,0.15); color: var(--gs-warning); }
    .badge-approved { background: rgba(34,197,94,0.15); color: var(--gs-success); }
    .badge-rejected { background: rgba(239,68,68,0.15); color: var(--gs-danger); }
    button.action {
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--gs-border);
      border-radius: 4px;
      background: transparent;
      color: var(--gs-text);
      font: inherit;
      font-size: 0.75rem;
      cursor: pointer;
      margin-right: 0.25rem;
    }
    button.action:hover { border-color: var(--gs-accent); }
    button.action.approve:hover { border-color: var(--gs-success); color: var(--gs-success); }
    button.action.reject:hover { border-color: var(--gs-danger); color: var(--gs-danger); }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }
    .stat-card {
      background: var(--gs-surface);
      border: 1px solid var(--gs-border);
      border-radius: var(--gs-radius);
      padding: 1.25rem;
      text-align: center;
    }
    .stat-value { font-size: 2rem; font-weight: 700; }
    .stat-label { font-size: 0.75rem; color: var(--gs-text-muted); margin-top: 0.25rem; }
    .invite-section { margin-top: 1rem; }
    .invite-code {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      background: var(--gs-bg);
      border-radius: var(--gs-radius);
      font-family: monospace;
      font-size: 0.875rem;
      margin-right: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .btn-primary {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: var(--gs-radius);
      background: var(--gs-accent);
      color: white;
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;
    }
  `;

  @state() private _tab: 'users' | 'invites' | 'stats' = 'users';
  @state() private _users: UserProfile[] = [];
  @state() private _invites: Array<{ id: string; code: string; usedBy: string | null; createdAt: string }> = [];
  @state() private _stats = { totalUsers: 0, pendingUsers: 0, totalPresentations: 0, totalStorageBytes: 0 };

  override connectedCallback(): void {
    super.connectedCallback();
    void this._loadTab();
  }

  private async _loadTab(): Promise<void> {
    if (this._tab === 'users') {
      const { items } = await apiClient.listUsers();
      this._users = items;
    } else if (this._tab === 'invites') {
      const { items } = await apiClient.listInviteCodes();
      this._invites = items;
    } else {
      this._stats = await apiClient.getSystemStats();
    }
  }

  private async _approve(id: string): Promise<void> {
    await apiClient.approveUser(id);
    await this._loadTab();
  }

  private async _reject(id: string): Promise<void> {
    await apiClient.rejectUser(id);
    await this._loadTab();
  }

  private async _increaseQuota(user: UserProfile): Promise<void> {
    const input = window.prompt('Increase quota by MB', '50');
    if (input === null) return;

    const increaseMb = Number(input);
    if (!Number.isFinite(increaseMb) || increaseMb <= 0) {
      window.alert('Please enter a positive number of MB.');
      return;
    }

    const nextQuotaBytes = user.quotaBytes + Math.floor(increaseMb * 1024 * 1024);
    await apiClient.setUserQuota(user.id, nextQuotaBytes);
    await this._loadTab();
  }

  private async _generateCode(): Promise<void> {
    await apiClient.generateInviteCode();
    await this._loadTab();
  }

  private async _revokeCode(id: string): Promise<void> {
    await apiClient.revokeInviteCode(id);
    await this._loadTab();
  }

  override render(): TemplateResult {
    return html`
      <div class="tab-bar">
        <button class="tab ${this._tab === 'users' ? 'active' : ''}" @click=${() => { this._tab = 'users'; void this._loadTab(); }}>Users</button>
        <button class="tab ${this._tab === 'invites' ? 'active' : ''}" @click=${() => { this._tab = 'invites'; void this._loadTab(); }}>Invite Codes</button>
        <button class="tab ${this._tab === 'stats' ? 'active' : ''}" @click=${() => { this._tab = 'stats'; void this._loadTab(); }}>Stats</button>
      </div>

      ${this._tab === 'users' ? this._renderUsers() : nothing}
      ${this._tab === 'invites' ? this._renderInvites() : nothing}
      ${this._tab === 'stats' ? this._renderStats() : nothing}
    `;
  }

  private _renderUsers(): TemplateResult {
    return html`
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Role</th><th>Quota</th><th>Actions</th></tr></thead>
        <tbody>
          ${this._users.map((u) => html`
            <tr>
              <td>${u.name}</td>
              <td>${u.email}</td>
              <td><span class="badge badge-${u.status}">${u.status}</span></td>
              <td>${u.role}</td>
              <td>${this._formatSize(u.usedBytes)} / ${this._formatSize(u.quotaBytes)}</td>
              <td>
                ${u.status === 'pending' ? html`
                  <button class="action approve" @click=${() => void this._approve(u.id)}>Approve</button>
                  <button class="action reject" @click=${() => void this._reject(u.id)}>Reject</button>
                ` : nothing}
                <button class="action" @click=${() => void this._increaseQuota(u)}>Increase quota</button>
              </td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }

  private _renderInvites(): TemplateResult {
    return html`
      <button class="btn-primary" @click=${() => void this._generateCode()} style="margin-bottom:1rem">Generate Code</button>
      <div class="invite-section">
        ${this._invites.map((inv) => html`
          <span class="invite-code">
            ${inv.code}
            ${inv.usedBy ? html`<span style="color:var(--gs-text-muted)">(used)</span>` : html`
              <button class="action" @click=${() => void this._revokeCode(inv.id)}>Revoke</button>
            `}
          </span>
        `)}
      </div>
    `;
  }

  private _renderStats(): TemplateResult {
    return html`
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${String(this._stats.totalUsers)}</div>
          <div class="stat-label">Total Users</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${String(this._stats.pendingUsers)}</div>
          <div class="stat-label">Pending Approvals</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${String(this._stats.totalPresentations)}</div>
          <div class="stat-label">Presentations</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${this._formatSize(this._stats.totalStorageBytes)}</div>
          <div class="stat-label">Total Storage</div>
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
