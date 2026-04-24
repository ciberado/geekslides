import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';

interface DevUser {
  readonly name: string;
  readonly email: string;
  readonly role: 'user' | 'admin';
  readonly avatarUrl: string;
}

@customElement('hub-login-page')
export class LoginPage extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
    }
    .card {
      background: var(--gs-surface);
      border: 1px solid var(--gs-border);
      border-radius: 12px;
      padding: 2.5rem;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    p {
      color: var(--gs-text-muted);
      margin-bottom: 2rem;
      font-size: 0.875rem;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--gs-border);
      border-radius: var(--gs-radius);
      background: var(--gs-bg);
      color: var(--gs-text);
      font: inherit;
      font-size: 0.9375rem;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .btn:hover { border-color: var(--gs-accent); }
    .btn + .btn { margin-top: 0.75rem; }
    .dev-section {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--gs-border);
    }
    .dev-section h2 {
      font-size: 0.875rem;
      color: var(--gs-text-muted);
      margin-bottom: 0.75rem;
      font-weight: 500;
    }
    .dev-btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.6rem 0.75rem;
      border: 1px dashed var(--gs-border);
      border-radius: var(--gs-radius);
      background: var(--gs-bg);
      color: var(--gs-text);
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      text-align: left;
    }
    .dev-btn:hover { border-color: var(--gs-accent); background: var(--gs-surface); }
    .dev-btn + .dev-btn { margin-top: 0.5rem; }
    .dev-btn img {
      width: 28px;
      height: 28px;
      border-radius: 50%;
    }
    .dev-btn .info { flex: 1; }
    .dev-btn .name { font-weight: 600; }
    .dev-btn .role {
      font-size: 0.75rem;
      color: var(--gs-text-muted);
    }
    .invite-section {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--gs-border);
    }
    .invite-section label {
      display: block;
      font-size: 0.8125rem;
      color: var(--gs-text-muted);
      margin-bottom: 0.5rem;
    }
    input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--gs-border);
      border-radius: var(--gs-radius);
      background: var(--gs-bg);
      color: var(--gs-text);
      font: inherit;
      font-size: 0.875rem;
      text-align: center;
      letter-spacing: 0.1em;
    }
    input:focus { outline: none; border-color: var(--gs-accent); }
    svg { width: 20px; height: 20px; fill: var(--gs-text); }
  `;

  @state() private _inviteCode = '';
  @state() private _devUsers: DevUser[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
    void this._loadDevUsers();
  }

  private async _loadDevUsers(): Promise<void> {
    try {
      const res = await fetch('/hub/api/auth/dev-users');
      if (res.ok) {
        this._devUsers = (await res.json()) as DevUser[];
      }
    } catch {
      // Not in dev mode — OAuth only
    }
  }

  private _login(provider: 'github' | 'google'): void {
    const params = this._inviteCode ? `?invite=${encodeURIComponent(this._inviteCode)}` : '';
    window.location.href = `/hub/api/auth/${provider}${params}`;
  }

  private async _devLogin(user: DevUser): Promise<void> {
    const res = await fetch('/hub/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: user.email }),
    });
    if (res.ok) {
      window.location.href = '/hub/';
    }
  }

  override render(): TemplateResult {
    return html`
      <div class="card">
        <h1>GeekSlides Hub</h1>
        <p>Sign in to manage and share your presentations</p>

        ${this._devUsers.length > 0 ? this._renderDevUsers() : nothing}

        <button class="btn" @click=${() => { this._login('github'); }}>
          <svg viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          Continue with GitHub
        </button>

        <button class="btn" @click=${() => { this._login('google'); }}>
          <svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>

        <div class="invite-section">
          <label>Have an invite code?</label>
          <input
            type="text"
            placeholder="Enter code"
            maxlength="8"
            .value=${this._inviteCode}
            @input=${(e: Event) => { this._inviteCode = (e.target as HTMLInputElement).value; }}
          >
        </div>
      </div>
    `;
  }

  private _renderDevUsers(): TemplateResult {
    return html`
      <div class="dev-section">
        <h2>Dev Mode — Quick Login</h2>
        ${this._devUsers.map((user) => html`
          <button class="dev-btn" @click=${() => void this._devLogin(user)}>
            <img src=${user.avatarUrl} alt="">
            <span class="info">
              <span class="name">${user.name}</span>
              <span class="role">${user.role}</span>
            </span>
          </button>
        `)}
      </div>
    `;
  }
}
