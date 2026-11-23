import { Component, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TokenService } from '../../auth/token.service';
import { LogoutService } from '../../auth/logout.service';

@Component({
  selector: 'app-vendedor-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './vendedor-layout.component.html',
  styleUrl: './vendedor-layout.component.scss'
})
export class VendedorLayoutComponent implements OnDestroy {

  readonly nombreUsuario: string;

  /** Click en la hamburguesa: el menú queda abierto hasta cerrarlo. */
  fijado = false;

  /** Mouse sobre la hamburguesa o el sidebar: el menú se muestra mientras dure. */
  hoverAbierto = false;

  private timerHover: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private tokenService: TokenService,
    private logoutService: LogoutService
  ) {
    this.nombreUsuario = this.tokenService.getNombreCompleto() || 'Vendedor';
  }

  get menuAbierto(): boolean {
    return this.fijado || this.hoverAbierto;
  }

  toggleMenu(): void {
    this.fijado = !this.fijado;
    if (this.fijado) {
      this.hoverAbierto = false;
    }
    this.syncBodyScroll();
  }

  cerrarMenu(): void {
    if (!this.menuAbierto) {
      return;
    }
    this.fijado = false;
    this.hoverAbierto = false;
    this.limpiarTimer();
    this.syncBodyScroll();
  }

  // ── Hover (solo escritorio; en móvil el drawer es por click) ──────────────

  entrarHover(): void {
    if (this.esPantallaMovil()) {
      return;
    }
    this.limpiarTimer();
    this.hoverAbierto = true;
    this.syncBodyScroll();
  }

  salirHover(): void {
    if (this.esPantallaMovil()) {
      return;
    }
    this.limpiarTimer();
    // Pequeña espera para que el mouse pueda viajar de la hamburguesa al menú
    this.timerHover = setTimeout(() => {
      this.timerHover = null;
      this.hoverAbierto = false;
      this.syncBodyScroll();
    }, 260);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cerrarMenu();
  }

  ngOnDestroy(): void {
    this.limpiarTimer();
    document.body.style.overflow = '';
  }

  logout(): void {
    this.logoutService.logout();
  }

  private esPantallaMovil(): boolean {
    return window.matchMedia('(max-width: 991px)').matches;
  }

  private limpiarTimer(): void {
    if (this.timerHover) {
      clearTimeout(this.timerHover);
      this.timerHover = null;
    }
  }

  private syncBodyScroll(): void {
    // En escritorio el hover no debe bloquear el scroll del contenido
    if (!this.esPantallaMovil()) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = this.menuAbierto ? 'hidden' : '';
  }
}
