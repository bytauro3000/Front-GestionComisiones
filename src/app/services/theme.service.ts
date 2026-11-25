import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  readonly mode = signal<ThemeMode>('system');
  readonly dark = signal(false);

  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private timerCambio: number | null = null;

  constructor() {
    this.mode.set(this.leerModo());
    this.aplicar(false);
    this.media.addEventListener('change', this.onSystemChange);
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);

    try {
      localStorage.setItem('theme', mode);
    } catch {
      // Sin persistencia: se mantiene durante la sesión.
    }

    this.aplicar(true);
  }

  toggle(): void {
    this.setMode(this.dark() ? 'light' : 'dark');
  }

  private readonly onSystemChange = (): void => {
    if (this.mode() === 'system') {
      this.aplicar(true);
    }
  };

  private leerModo(): ThemeMode {
    try {
      const guardado = localStorage.getItem('theme');
      return guardado === 'light' || guardado === 'dark' || guardado === 'system'
        ? guardado
        : 'system';
    } catch {
      return 'system';
    }
  }

  private aplicar(animar: boolean): void {
    const oscuro = this.mode() === 'dark'
      || (this.mode() === 'system' && this.media.matches);

    const root = document.documentElement;

    if (animar) {
      root.classList.add('theme-changing');
      window.clearTimeout(this.timerCambio ?? undefined);
      this.timerCambio = window.setTimeout(() => {
        root.classList.remove('theme-changing');
        this.timerCambio = null;
      }, 280);
    }

    root.classList.toggle('dark', oscuro);
    root.dataset['theme'] = oscuro ? 'dark' : 'light';
    this.dark.set(oscuro);

    document
      .getElementById('theme-color-meta')
      ?.setAttribute('content', oscuro ? '#0b1220' : '#4338ca');
  }
}
