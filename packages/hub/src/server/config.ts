export interface HubServerOptions {
  readonly port: number;
  readonly host: string;
  readonly dbPath: string;
  readonly repoDir: string;
  readonly serverBaseUrl: string;
  readonly viewerBaseUrl: string;
  readonly githubClientId: string;
  readonly githubClientSecret: string;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly adminEmail: string;
  readonly jwtSecret: string;
  readonly cookieDomain: string;
  /** Enable dev-mode login with mock users (no OAuth required). */
  readonly devMode: boolean;
}

export const defaultOptions: HubServerOptions = {
  port: 3000,
  host: '0.0.0.0',
  dbPath: './data/hub.db',
  repoDir: './data/repos',
  serverBaseUrl: 'http://localhost:1234',
  viewerBaseUrl: 'http://localhost:5173',
  githubClientId: '',
  githubClientSecret: '',
  googleClientId: '',
  googleClientSecret: '',
  adminEmail: '',
  jwtSecret: '',
  cookieDomain: 'localhost',
  devMode: false,
};
