import { Injectable }  from '@angular/core';
import { HttpClient }  from '@angular/common/http';
import { Router }      from '@angular/router';
import { map, tap }    from 'rxjs/operators';
import { Observable }  from 'rxjs';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly AUTHED_KEY = 'kea_authed';
  private readonly TOKEN_KEY  = 'kea_token';

  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  login(password: string): Observable<void> {
    const token = btoa(`kea-api:${password}`);
    return this.http.post<unknown[]>(
      '/api/',
      { command: 'status-get', service: ['dhcp4'] },
      { headers: { Authorization: `Basic ${token}` } }
    ).pipe(
      tap(() => {
        sessionStorage.setItem(this.TOKEN_KEY,  token);
        sessionStorage.setItem(this.AUTHED_KEY, 'true');
        this.startIdleTimer();
      }),
      map(() => void 0)
    );
  }

  logout(): void {
    this.stopIdleTimer();
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.AUTHED_KEY);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return sessionStorage.getItem(this.AUTHED_KEY) === 'true';
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
