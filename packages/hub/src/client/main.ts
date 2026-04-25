import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { apiClient, type UserProfile } from './services/api.ts';
import './pages/login-page.ts';
import './pages/pending-page.ts';
import './pages/dashboard-page.ts';
import './pages/search-page.ts';
import './pages/shared-page.ts';
import './pages/admin-page.ts';

type AppView = 'login' | 'pending' | 'dashboard' | 'search' | 'shared' | 'admin';

@customElement('hub-app')
export class HubApp extends LitElement {
  static override styles = css`
    :host { display: block; min-height: 100dvh; }
    nav {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1.5rem;
      background: var(--gs-surface);
      border-bottom: 1px solid var(--gs-border);
    }
    nav .logo {
      font-weight: 700;
      font-size: 1.125rem;
      color: var(--gs-text);
      margin-right: auto;
    }
    nav button {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: var(--gs-radius);
      background: transparent;
      color: var(--gs-text-muted);
      cursor: pointer;
      font: inherit;
      font-size: 0.875rem;
    }
    nav button:hover, nav button.active {
      color: var(--gs-text);
      background: var(--gs-bg);
    }
    nav button.logout {
      color: var(--gs-danger);
    }
    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }
    main { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
  `;

  @state() private _view: AppView = 'login';
  @state() private _user: UserProfile | null = null;
  @state() private _loading = true;

  override connectedCallback(): void {
    super.connectedCallback();
    void this._checkAuth();
  }

  private async _checkAuth(): Promise<void> {
    try {
      const user = await apiClient.getMe();
      this._user = user;
      if (user.status !== 'approved') {
        this._view = 'pending';
      } else {
        this._resolveRoute();
      }
    } catch {
      this._view = 'login';
    } finally {
      this._loading = false;
    }
  }

  private _resolveRoute(): void {
    const path = window.location.pathname;
    if (path.startsWith('/hub/search')) {
      this._view = 'search';
    } else if (path.startsWith('/hub/shared')) {
      this._view = 'shared';
    } else if (path.startsWith('/hub/admin') && this._user?.role === 'admin') {
      this._view = 'admin';
    } else {
      this._view = 'dashboard';
    }
  }

  private _navigate(view: AppView): void {
    this._view = view;
    const pathMap: Record<AppView, string> = {
      login: '/hub/',
      pending: '/hub/pending',
      dashboard: '/hub/',
      search: '/hub/search',
      shared: '/hub/shared',
      admin: '/hub/admin',
    };
    window.history.pushState(null, '', pathMap[view]);
  }

  private async _logout(): Promise<void> {
    await apiClient.logout();
    this._user = null;
    this._view = 'login';
  }

  override render(): TemplateResult {
    if (this._loading) {
      return html`<main><p>Loading…</p></main>`;
    }

    if (this._view === 'login') {
      return html`<hub-login-page></hub-login-page>`;
    }

    if (this._view === 'pending') {
      return html`<hub-pending-page></hub-pending-page>`;
    }

    return html`
      <nav>
        <span class="logo">GeekSlides Hub</span>
        <button class=${this._view === 'dashboard' ? 'active' : ''} @click=${() => { this._navigate('dashboard'); }}>My Decks</button>
        <button class=${this._view === 'search' ? 'active' : ''} @click=${() => { this._navigate('search'); }}>Explore</button>
        <button class=${this._view === 'shared' ? 'active' : ''} @click=${() => { this._navigate('shared'); }}>Shared with Me</button>
        ${this._user?.role === 'admin'
          ? html`<button class=${this._view === 'admin' ? 'active' : ''} @click=${() => { this._navigate('admin'); }}>Admin</button>`
          : ''}
        ${this._user?.avatarUrl ? html`<img class="avatar" src=${this._user.avatarUrl} alt="">` : ''}
        <button class="logout" @click=${() => void this._logout()}>Sign out</button>
      </nav>
      <main>
        ${this._view === 'dashboard' ? html`<hub-dashboard-page></hub-dashboard-page>` : ''}
        ${this._view === 'search' ? html`<hub-search-page></hub-search-page>` : ''}
        ${this._view === 'shared' ? html`<hub-shared-page></hub-shared-page>` : ''}
        ${this._view === 'admin' ? html`<hub-admin-page></hub-admin-page>` : ''}
      </main>
    `;
  }
}
