import { Injectable } from '@angular/core';
import { TokenService } from './token.service';
import { Router } from '@angular/router';
import { LoginService } from './login.service';
import { IdleTimeoutService } from './idle-timeout.service';
import { WebSocketService } from '../services/websocket.service';

@Injectable({
  providedIn: 'root'
})
export class LogoutService {
  constructor(
    private tokenService: TokenService,
    private router: Router,
    private loginService: LoginService,
    private idleTimeoutService: IdleTimeoutService,
    private wsService: WebSocketService
  ) { }

  logout(): void {
    // Detener el control de inactividad
    this.idleTimeoutService.stopWatching();

    // Cerrar la conexión STOMP compartida (chat + actualizaciones)
    this.wsService.desconectar();

    // El backend invalida la cookie HttpOnly del refresh token
    this.loginService.logout().subscribe({
      error: () => {}
    });
    this.tokenService.removeToken();
    this.router.navigate(['/login']);
  }
}