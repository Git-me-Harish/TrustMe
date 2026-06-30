/**
 * Auth-specific API calls, split from kyc-api-client.ts so auth concerns
 * (token storage, login/register) don't get tangled with KYC session logic.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class AuthApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export const authApi = {
  async register(email: string, password: string, fullName?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName ?? null }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new AuthApiError(res.status, body.detail ?? "Registration failed");
    }
  },

  async login(email: string, password: string): Promise<void> {
    // Backend now uses OAuth2PasswordRequestForm — a standard
    // application/x-www-form-urlencoded body with `username`/`password`
    // fields (the spec calls it `username` even though we're using email).
    const body = new URLSearchParams({ username: email, password });
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: res.statusText }));
      throw new AuthApiError(res.status, errBody.detail ?? "Login failed");
    }
    const tokens: TokenPair = await res.json();
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
  },

  logout(): void {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  },

  isLoggedIn(): boolean {
    return typeof window !== "undefined" && !!localStorage.getItem("access_token");
  },
};
