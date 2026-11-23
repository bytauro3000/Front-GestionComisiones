import { Component, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TokenService } from '../../auth/token.service';
import { LogoutService } from '../../auth/logout.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent implements OnDestroy {

  readonly nombreUsuario: string;
  menuAbierto = false;

  constructor(
    private tokenService: TokenService,
    private logoutService: LogoutService
  ) {
    this.nombreUsuario = this.tokenService.getNombreCompleto() || 'Administrador';
  }

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
    this.syncBodyScroll();
  }

  cerrarMenu(): void {
    if (!this.menuAbierto) {
      return;
    }
    this.menuAbierto = false;
    this.syncBodyScroll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cerrarMenu();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  logout(): void {
    this.logoutService.logout();
  }

  private syncBodyScroll(): void {
    document.body.style.overflow = this.menuAbierto ? 'hidden' : '';
  }
}
