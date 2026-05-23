export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly role: 'user' | 'admin';
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly quotaBytes: number;
  readonly usedBytes: number;
}

export interface Presentation {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly description: string;
  readonly slug: string;
  readonly visibility: 'private' | 'public';
  readonly sizeBytes: number;
  readonly githubUrl: string | null;
  readonly githubSha: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly access?: string;
}

export interface GitHubCheckResult {
  readonly currentSha: string | null;
  readonly latestSha: string | null;
  readonly hasUpdate: boolean;
}

export interface SharedPresentation {
  readonly id: string;
  readonly presentationId: string;
  readonly userId: string;
  readonly role: 'viewer' | 'copresenter';
  readonly status: 'pending' | 'accepted' | 'rejected';
  readonly createdAt: string;
  readonly presentation: { id: string; title: string; slug: string };
}

export interface LaunchResult {
  readonly url: string;
  readonly shareUrl: string;
  readonly room: string;
  readonly role: string;
}

export interface ShareInfo {
  readonly id: string;
  readonly presentationId: string;
  readonly userId: string;
  readonly role: string;
  readonly status: string;
  readonly createdAt: string;
}

class ApiClient {
  private readonly base = '/hub/api';

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${this.base}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers,
    });

    if (res.status === 401) {
      // Try refresh
      const refreshRes = await fetch(`${this.base}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (refreshRes.ok) {
        const retryRes = await fetch(`${this.base}${path}`, {
          ...init,
          credentials: 'same-origin',
          headers,
        });
        if (!retryRes.ok) throw new Error(`API error: ${String(retryRes.status)}`);
        if (retryRes.status === 204) return undefined as T;
        return retryRes.json() as Promise<T>;
      }
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      throw new Error(body.error ?? `API error: ${String(res.status)}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  // Auth
  getMe(): Promise<UserProfile> {
    return this.request('/auth/me');
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  // Presentations
  listPresentations(limit = 20, offset = 0): Promise<{ items: Presentation[] }> {
    return this.request(`/presentations?limit=${String(limit)}&offset=${String(offset)}`);
  }

  getPresentation(id: string): Promise<Presentation> {
    return this.request(`/presentations/${id}`);
  }

  createPresentationFromFiles(title: string, files: FileList | File[]): Promise<Presentation> {
    const form = new FormData();
    form.append('title', title);
    for (const file of files) {
      // Encode the full relative path so @fastify/multipart (busboy) does not
      // strip directory components via path.basename().
      const relativePath = file.webkitRelativePath || file.name;
      // Skip dotfiles and directories starting with a dot (.git, .DS_Store, etc.)
      if (relativePath.split('/').some((seg) => seg.startsWith('.'))) continue;
      form.append('files', file, encodeURIComponent(relativePath));
    }
    return this.request('/presentations', { method: 'POST', body: form });
  }

  createPresentationFromZip(title: string, zipFile: File): Promise<Presentation> {
    const form = new FormData();
    form.append('title', title);
    form.append('files', zipFile, zipFile.name);
    return this.request('/presentations', { method: 'POST', body: form });
  }

  createPresentationFromPptx(title: string, pptxFile: File): Promise<Presentation> {
    const form = new FormData();
    form.append('title', title);
    form.append('files', pptxFile, pptxFile.name);
    return this.request('/presentations', { method: 'POST', body: form });
  }

  createPresentationFromGitHub(title: string, githubUrl: string): Promise<Presentation> {
    return this.request('/presentations', {
      method: 'POST',
      body: JSON.stringify({ title, githubUrl }),
    });
  }

  reuploadPresentationFiles(id: string, files: FileList | File[]): Promise<Presentation> {
    const form = new FormData();
    for (const file of files) {
      const relativePath = file.webkitRelativePath || file.name;
      if (relativePath.split('/').some((seg) => seg.startsWith('.'))) continue;
      form.append('files', file, encodeURIComponent(relativePath));
    }
    return this.request(`/presentations/${id}/files`, { method: 'PUT', body: form });
  }

  updatePresentation(id: string, data: Partial<Pick<Presentation, 'title' | 'description' | 'visibility'>>): Promise<Presentation> {
    return this.request(`/presentations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  deletePresentation(id: string): Promise<void> {
    return this.request(`/presentations/${id}`, { method: 'DELETE' });
  }

  // Launch
  launchPresentation(id: string): Promise<LaunchResult> {
    return this.request(`/presentations/${id}/launch`, { method: 'POST' });
  }

  // Shares
  createShare(presentationId: string, email: string, role: 'viewer' | 'copresenter' = 'viewer'): Promise<ShareInfo> {
    return this.request(`/presentations/${presentationId}/shares`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  listShares(presentationId: string): Promise<{ items: ShareInfo[] }> {
    return this.request(`/presentations/${presentationId}/shares`);
  }

  revokeShare(shareId: string): Promise<void> {
    return this.request(`/shares/${shareId}`, { method: 'DELETE' });
  }

  // Search
  search(q: string): Promise<{ items: Array<Presentation & { ownerName: string; ownerAvatarUrl: string | null }> }> {
    return this.request(`/search?q=${encodeURIComponent(q)}`);
  }

  // Analytics
  getPresentationAnalytics(id: string): Promise<{ launches: number }> {
    return this.request(`/presentations/${id}/analytics`);
  }

  getMyStats(): Promise<{ totalLaunches: number }> {
    return this.request('/analytics/me');
  }

  // Admin
  listUsers(status?: string): Promise<{ items: UserProfile[] }> {
    const qs = status ? `?status=${status}` : '';
    return this.request(`/admin/users${qs}`);
  }

  approveUser(id: string): Promise<void> {
    return this.request(`/admin/users/${id}/approve`, { method: 'POST' });
  }

  rejectUser(id: string): Promise<void> {
    return this.request(`/admin/users/${id}/reject`, { method: 'POST' });
  }

  setUserQuota(id: string, quotaBytes: number): Promise<void> {
    return this.request(`/admin/users/${id}/quota`, {
      method: 'PATCH',
      body: JSON.stringify({ quotaBytes }),
    });
  }

  generateInviteCode(): Promise<{ code: string }> {
    return this.request('/admin/invite-codes', { method: 'POST' });
  }

  listInviteCodes(): Promise<{ items: Array<{ id: string; code: string; usedBy: string | null; createdAt: string }> }> {
    return this.request('/admin/invite-codes');
  }

  revokeInviteCode(id: string): Promise<void> {
    return this.request(`/admin/invite-codes/${id}`, { method: 'DELETE' });
  }

  getSystemStats(): Promise<{ totalUsers: number; pendingUsers: number; totalPresentations: number; totalStorageBytes: number }> {
    return this.request('/admin/stats');
  }

  // GitHub import helpers
  checkGitHubUpdate(id: string): Promise<GitHubCheckResult> {
    return this.request(`/presentations/${id}/github-check`);
  }

  refreshFromGitHub(id: string): Promise<Presentation> {
    return this.request(`/presentations/${id}/github-refresh`, { method: 'POST' });
  }

  // Shared with me
  listSharedWithMe(): Promise<{ items: SharedPresentation[] }> {
    return this.request('/shared-with-me');
  }

  acceptShare(shareId: string): Promise<void> {
    return this.request(`/shares/${shareId}/accept`, { method: 'POST' });
  }

  rejectShare(shareId: string): Promise<void> {
    return this.request(`/shares/${shareId}/reject`, { method: 'POST' });
  }
}

export const apiClient = new ApiClient();

