import { Injectable } from '@angular/core';
import { gsap } from 'gsap';

/**
 * Animaciones de la app con GSAP.
 * - Entrada del login (secuencia).
 * - Transición de página al cambiar de ruta.
 * Respeta prefers-reduced-motion y usa solo transform/opacity.
 */
@Injectable({ providedIn: 'root' })
export class AnimationService {

  get reducedMotion(): boolean {
    return typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  loginEnter(scope: Element): ReturnType<typeof gsap.context> | undefined {
    if (this.reducedMotion) {
      return undefined;
    }
    return gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.branding-top', { y: -10, autoAlpha: 0, duration: 0.5 })
        .from('.branding-hero h1', { y: 18, autoAlpha: 0, duration: 0.7 }, '-=0.25')
        .from('.branding-hero .lede', { y: 12, autoAlpha: 0, duration: 0.5 }, '-=0.45')
        .from('.auth-card', { y: 16, autoAlpha: 0, duration: 0.55 }, '-=0.35');
    }, scope);
  }

  /**
   * Transición de página al cambiar de ruta.
   * Solo anima opacidad: un transform en este contenedor rompería el
   * `position: fixed` de los modales (se centrarían respecto al contenido).
   */
  pageEnter(el?: HTMLElement | null): void {
    if (!el || this.reducedMotion) {
      return;
    }
    gsap.fromTo(el,
      { autoAlpha: 0 },
      {
        autoAlpha: 1,
        duration: 0.3,
        ease: 'power2.out',
        overwrite: 'auto',
        clearProps: 'all'
      });
  }
}
