import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { TokenService } from '../../auth/token.service';
import { LogoutService } from '../../auth/logout.service';
import { AnimationService } from '../../services/animation.service';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';
import { RealtimeService } from '../../services/realtime.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ThemeToggleComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent implements AfterViewInit, OnDestroy {

  @ViewChild('contenido') contenido?: ElementRef<HTMLElement>;

  readonly nombreUsuario: string;
  menuAbierto = false;
  private routerSub?: Subscription;

  constructor(
    private tokenService: TokenService,
    private logoutService: LogoutService,
    private router: Router,
    private animations: AnimationService,
    private realtime: RealtimeService
  ) {
    this.nombreUsuario = this.tokenService.getNombreCompleto() || 'Administrador';
    this.realtime.connectInternal();
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.animations.pageEnter(this.contenido?.nativeElement));
  }

  ngAfterViewInit(): void {
    this.animations.pageEnter(this.contenido?.nativeElement);
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
    this.realtime.disconnect();
    this.routerSub?.unsubscribe();
    document.body.style.overflow = '';
  }

  logout(): void {
    this.logoutService.logout();
  }

  private syncBodyScroll(): void {
    document.body.style.overflow = this.menuAbierto ? 'hidden' : '';
  }
}
