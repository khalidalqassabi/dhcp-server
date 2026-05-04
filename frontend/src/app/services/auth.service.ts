import { Injectable }  from '@angular/core';
import { HttpClient }  from '@angular/common/http';
import { Router }      from '@angular/router';
import { map, tap }    from 'rxjs/operators';
import { Observable }  from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly AUTHED_KEY = 'kea_authed';
  private readonly TOKEN_KEY  = 'kea_token';

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
      }),
      map(() => void 0)
    );
  }

  logout(): void {
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
}
