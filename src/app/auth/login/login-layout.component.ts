import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-login-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './login-layout.component.html',
  styleUrls: ['./login-layout.component.scss']
})
export class LoginLayoutComponent {

  readonly anioActual = new Date().getFullYear();
  readonly nombreSistema = 'Vende Lote';

  constructor(private router: Router) {}

  /** true cuando se muestra el auto-registro público. */
  get esRegistro(): boolean {
    return this.router.url.startsWith('/registro');
  }

  get titulo(): string {
    return this.esRegistro ? 'Crear tu cuenta' : 'Iniciar sesión';
  }

  get subtitulo(): string {
    return this.esRegistro
      ? 'Regístrate como vendedor; el administrador aprobará tu cuenta'
      : 'Ingresa tus credenciales para acceder al sistema';
  }
}
