import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LoginService, LoginRequest } from '../login.service';
import { jwtDecode } from 'jwt-decode';
import { TokenService } from '../token.service';
import { TokenRefreshService } from '../token-refresh.service';
import { AlertService } from '../../services/alert.service';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent implements OnInit {
  loginRequest: LoginRequest = {
    correo: '',
    contrasena: ''
  };
  recordar: boolean = false;
  verContrasena: boolean = false;
  cargando: boolean = false;

  constructor(
    private loginService: LoginService,
    private router: Router,
    private tokenService: TokenService,
    private alert: AlertService,
    private titleService: Title,
    private tokenRefreshService: TokenRefreshService
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Iniciar Sesión | Closure');
    const correoGuardado = localStorage.getItem('remembered_email');
    if (correoGuardado) {
      this.loginRequest.correo = correoGuardado;
      this.recordar = true;
    }
  }

  togglePassword(): void {
    this.verContrasena = !this.verContrasena;
  }

  onLogin(): void {
    if (this.cargando) return;
    this.cargando = true;
    this.tokenService.removeToken();

    this.loginService.login(this.loginRequest).subscribe({
      next: (response) => {
        if (this.recordar) {
          localStorage.setItem('remembered_email', this.loginRequest.correo);
        } else {
          localStorage.removeItem('remembered_email');
        }

        const token = response.token;
        this.tokenService.setToken(token);

        // Iniciar refresh proactivo del JWT antes de que expire
        this.tokenRefreshService.scheduleNext();

        const decodedToken: any = jwtDecode(token);
        const userRole = decodedToken.rol;

        this.alert.toastSuccess('¡Bienvenido al sistema!', 'Acceso Exitoso');

        // Cada rol entra a su propio menú
        if (userRole === 'ROLE_ADMINISTRADOR') {
          this.router.navigate(['/admin/inicio']);
        } else if (userRole === 'ROLE_VENDEDOR' || userRole === 'ROLE_VENDEDOR_ASOCIADO') {
          this.router.navigate(['/vendedor/inicio']);
        } else {
          this.router.navigate(['/']);
        }
        this.cargando = false;
      },
      error: (err) => {
        console.error('Login fallido:', err);
        this.cargando = false;
        const mensaje = err?.error?.mensaje || 'Correo o contraseña incorrectos';
        this.alert.toastError(mensaje, 'Error de Acceso', {
          timeOut: 3000,
          progressBar: true,
          positionClass: 'toast-top-right'
        });
      }
    });
  }
}
