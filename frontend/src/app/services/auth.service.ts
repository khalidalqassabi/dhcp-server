import { Injectable }  from '@angular/core';
import { HttpClient }  from '@angular/common/http';
import { Router }      from '@angular/router';
import { map, tap }    from 'rxjs/operators';
import { Observable }  from 'rxjs';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly AUTHED_KEY = 'kea_authed';

  // Token lives in memory only — never written to any storage
  private token: string | null = null;

  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private http: HttpClient, private router: Router) {
    // If the page was refreshed while a session flag exists but we have no
    // in-memory token, clear the stale flag and force re-login.
    if (sessionStorage.getItem(this.AUTHED_KEY) === 'true' && !this.token) {
      sessionStorage.removeItem(this.AUTHED_KEY);
    }
  }

  login(password: string): Observable<void> {
    const token = btoa(`kea-api:${password}`);
    return this.http.post<unknown[]>(
      '/api/',
      { command: 'status-get', service: ['dhcp4'] },
      { headers: { Authorization: `Basic ${token}` } }
    ).pipe(
      tap(() => {
        this.token = token;                                  // memory only
        sessionStorage.setItem(this.AUTHED_KEY, 'true');    // UI flag only
        this.startIdleTimer();
      }),
      map(() => void 0)
    );
  }

  logout(): void {
    this.token = null;
    this.stopIdleTimer();
    sessionStorage.removeItem(this.AUTHED_KEY);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.token;
  }

  isLoggedIn(): boolean {
    // Both the flag AND the in-memory token must be present
    return this.token !== null && sessionStorage.getItem(this.AUTHED_KEY) === 'true';
  }

  resetIdleTimer(): void {
    if (!this.isLoggedIn()) return;
    this.stopIdleTimer();
    this.startIdleTimer();
  }

  private startIdleTimer(): void {
    this.idleTimer = setTimeout(() => this.logout(), IDLE_TIMEOUT_MS);
  }

  private stopIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
