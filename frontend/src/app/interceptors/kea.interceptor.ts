import { Injectable }                                   from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler,
         HttpErrorResponse }                            from '@angular/common/http';
import { catchError }                                   from 'rxjs/operators';
import { throwError }                                   from 'rxjs';
import { AuthService }                                  from '../services/auth.service';

@Injectable()
export class KeaInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    const token = this.auth.getToken();
    if (token) {
      req = req.clone({ setHeaders: { Authorization: `Basic ${token}` } });
    }
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) this.auth.logout();
        return throwError(() => err);
      })
    );
  }
}
