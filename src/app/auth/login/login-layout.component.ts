import { AfterViewInit, Component, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AnimationService } from '../../services/animation.service';

@Component({
  selector: 'app-login-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './login-layout.component.html',
  styleUrls: ['./login-layout.component.scss']
})
export class LoginLayoutComponent implements AfterViewInit, OnDestroy {

  readonly anioActual = new Date().getFullYear();
  readonly nombreSistema = 'Vende Lote';

  private animCtx?: { revert: () => void };

  constructor(
    private router: Router,
    private el: ElementRef<HTMLElement>,
    private animations: AnimationService
  ) {}

  ngAfterViewInit(): void {
    this.animCtx = this.animations.loginEnter(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.animCtx?.revert();
  }

  /** true cuando se muestra el auto-registro público. */
  get esRegistro(): boolean {
    return this.router.url.startsWith('/registro');
  }

  get titulo(): string {
    return this.esRegistro ? 'Crea tu cuenta' : 'Bienvenido de vuelta';
  }

  get subtitulo(): string {
    return this.esRegistro
      ? 'Solicita acceso; el administrador aprobará tu cuenta.'
      : 'Ingresa a tu panel de comisiones.';
  }
}
