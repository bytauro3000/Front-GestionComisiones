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
import { NotificacionBellComponent } from '../../components/notificacion-bell/notificacion-bell.component';
import { ProformaUiService } from '../../services/proforma-ui.service';
import { AnimationService } from '../../services/animation.service';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';
import { RealtimeService } from '../../services/realtime.service';

@Component({
  selector: 'app-vendedor-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, NotificacionBellComponent, ThemeToggleComponent],
  templateUrl: './vendedor-layout.component.html',
  styleUrl: './vendedor-layout.component.scss'
})
export class VendedorLayoutComponent implements AfterViewInit, OnDestroy {

  @ViewChild('contenido') contenido?: ElementRef<HTMLElement>;

  readonly nombreUsuario: string;
  readonly nombreCorto: string;
  readonly esAsociado: boolean;
  readonly esJefe: boolean;

  /** En móvil, el drawer queda abierto hasta cerrarlo. */
  fijado = false;

  /** Mouse sobre la hamburguesa o el sidebar: el menú se muestra mientras dure. */
  hoverAbierto = false;

  private timerHover: ReturnType<typeof setTimeout> | null = null;
  private routerSub?: Subscription;

  /** El botón flotante de proforma solo se muestra en Inicio. */
  mostrarFab = false;

  constructor(
    private tokenService: TokenService,
    private logoutService: LogoutService,
    private proformaUi: ProformaUiService,
    private router: Router,
    private animations: AnimationService,
    private realtime: RealtimeService
  ) {
    this.nombreUsuario = this.tokenService.getNombreCompleto() || 'Vendedor';
    this.nombreCorto = this.tokenService.getNombreCorto() || this.nombreUsuario;
    this.esAsociado = this.tokenService.esAsociado();
    this.esJefe = this.tokenService.esVendedorJefe();
    this.actualizarFab(this.router.url);
    this.realtime.connectInternal();
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.actualizarFab((e as NavigationEnd).urlAfterRedirects);
        this.animations.pageEnter(this.contenido?.nativeElement);
      });
  }

  ngAfterViewInit(): void {
    this.animations.pageEnter(this.contenido?.nativeElement);
  }

  private actualizarFab(url: string): void {
    this.mostrarFab = url.startsWith('/vendedor/inicio');
  }

  /** Abre el modal de nueva proforma desde cualquier página. */
  emitirProforma(): void {
    this.proformaUi.solicitarNueva();
    this.cerrarMenu();
    this.router.navigate(['/vendedor/proformas']);
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
    this.realtime.disconnect();
    this.routerSub?.unsubscribe();
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
