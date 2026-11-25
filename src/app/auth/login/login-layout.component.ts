import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import Swal from 'sweetalert2';
import { AnimationService } from '../../services/animation.service';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-login-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ThemeToggleComponent],
  templateUrl: './login-layout.component.html',
  styleUrls: ['./login-layout.component.scss']
})
export class LoginLayoutComponent implements AfterViewInit, OnDestroy {

  readonly anioActual = new Date().getFullYear();
  readonly nombreSistema = 'Closure';

  readonly esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  readonly estaInstalada = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;

  puedeInstalar = this.esIOS && !this.estaInstalada;

  private promptInstalacion: {
    prompt: () => void;
    userChoice: Promise<{ outcome: string }>;
  } | null = null;

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

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: Event): void {
    event.preventDefault();
    this.promptInstalacion = event as unknown as {
      prompt: () => void;
      userChoice: Promise<{ outcome: string }>;
    };
    this.puedeInstalar = true;
  }

  @HostListener('window:appinstalled')
  onAppInstalled(): void {
    this.puedeInstalar = false;
    this.promptInstalacion = null;
  }

  async instalar(): Promise<void> {
    if (this.esIOS) {
      await Swal.fire({
        title: 'Instalar Closure en iPhone',
        html: `
          <ol style="text-align:left;line-height:1.7;padding-left:1.2rem;margin:0.5rem 0 0">
            <li>Abre esta página en <b>Safari</b>.</li>
            <li>Toca el botón <b>Compartir</b> (el cuadro con la flecha hacia arriba).</li>
            <li>Elige <b>Agregar a pantalla de inicio</b>.</li>
            <li>Toca <b>Agregar</b>.</li>
          </ol>
        `,
        icon: 'info',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    const prompt = this.promptInstalacion;
    if (prompt) {
      this.promptInstalacion = null;
      prompt.prompt();
      await prompt.userChoice;
      this.puedeInstalar = false;
    }
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
