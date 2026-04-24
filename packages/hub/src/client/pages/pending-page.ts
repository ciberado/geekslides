import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { apiClient } from '../services/api.ts';

@customElement('hub-pending-page')
export class PendingPage extends LitElement {
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
      max-width: 420px;
      width: 100%;
      text-align: center;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; margin-bottom: 0.75rem; }
    p { color: var(--gs-text-muted); font-size: 0.875rem; line-height: 1.5; }
    .status {
      margin-top: 1.5rem;
      padding: 0.5rem;
      border-radius: var(--gs-radius);
      font-size: 0.8125rem;
      color: var(--gs-warning);
      background: rgba(245, 158, 11, 0.1);
    }
  `;

  @state() private _checking = false;

  private _interval: ReturnType<typeof setInterval> | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this._interval = setInterval(() => void this._checkStatus(), 10_000);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._interval) clearInterval(this._interval);
  }

  private async _checkStatus(): Promise<void> {
    this._checking = true;
    try {
      const user = await apiClient.getMe();
      if (user.status === 'approved') {
        window.location.href = '/hub/';
      }
    } catch {
      // Still pending or error
    } finally {
      this._checking = false;
    }
  }

  override render(): TemplateResult {
    return html`
      <div class="card">
        <div class="icon">⏳</div>
        <h1>Registration Pending</h1>
        <p>Your account has been created and is awaiting admin approval. You'll be redirected automatically once approved.</p>
        <div class="status">
          ${this._checking ? 'Checking status…' : 'Waiting for approval'}
        </div>
      </div>
    `;
  }
}
