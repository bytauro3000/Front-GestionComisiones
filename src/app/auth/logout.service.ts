import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TokenService } from './token.service';
import { LoginService } from './login.service';
import { TokenRefreshService } from './token-refresh.service';

@Injectable({
  providedIn: 'root'
})
export class LogoutService {
  constructor(
    private tokenService: TokenService,
    private router: Router,
    private loginService: LoginService,
    private tokenRefreshService: TokenRefreshService
  ) { }

  logout(): void {
    // Detener el refresh programado
    this.tokenRefreshService.stop();

    // El backend revoca el refresh token (cookie HttpOnly) y cierra la sesión
    this.loginService.logout().subscribe({
      error: () => {}
    });

    this.tokenService.removeToken();
    this.router.navigate(['/login']);
  }
}
