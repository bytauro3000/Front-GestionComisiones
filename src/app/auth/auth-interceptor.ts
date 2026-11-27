import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { TokenService } from './token.service';
import { TokenRefreshService } from './token-refresh.service';

export const AuthInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const tokenService = inject(TokenService);
  const refreshService = inject(TokenRefreshService);
  const router = inject(Router);

  const reqWithCredentials = req.clone({ withCredentials: true });

  if (req.url.includes('/auth/refresh') || req.url.includes('/auth/login')
      || req.url.includes('/api/public/')) {
    return next(reqWithCredentials);
  }

  /** Envía la petición con el token dado y, si responde 401, refresca y reintenta. */
  const enviar = (token: string | null) => {
    const request = token
      ? reqWithCredentials.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : reqWithCredentials;

    return next(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status !== 401) {
          return throwError(() => error);
        }

        return refreshService.refreshToken().pipe(
          switchMap((newToken) => {
            const retryRequest = reqWithCredentials.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` }
            });
            return next(retryRequest);
          }),
          catchError(() => {
            // Refresh fallido (sesión expirada o revocada) → volver al login
            tokenService.removeToken();
            router.navigate(['/login']);
            return throwError(() => error);
          })
        );
      })
    );
  };

  const token = tokenService.getToken();

  // Token ya vencido: se refresca ANTES de enviar, para no generar un 401
  // visible en la consola (el token de acceso dura 30 minutos).
  if (token && tokenService.isTokenExpired()) {
    return refreshService.refreshToken().pipe(
      // Si el refresh falla, se envía igual y el 401 de arriba cierra la sesión.
      catchError(() => of(token)),
      switchMap((newToken) => enviar(newToken))
    );
  }

  return enviar(token);
};
