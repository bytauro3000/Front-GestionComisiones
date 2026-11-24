import { Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TokenRefreshService } from './auth/token-refresh.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {

  private readonly tokenRefreshService = inject(TokenRefreshService);
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly win = this.doc.defaultView;

  private campoActivo: HTMLElement | null = null;
  private tarjetaActiva: HTMLElement | null = null;
  private shiftActual = 0;
  private timers: number[] = [];
  private alturaViewport = 0;

  ngOnInit(): void {
    // Reanuda el refresco automático del token al cargar la app (tras un F5
    // el temporizador se perdía y el token se vencía a los 30 minutos).
    this.tokenRefreshService.scheduleNext();

    const win = this.win;
    if (!win) return;

    this.alturaViewport = win.visualViewport?.height ?? win.innerHeight;

    this.zone.runOutsideAngular(() => {
      this.doc.addEventListener('focusin', this.onFocusIn);
      win.visualViewport?.addEventListener('resize', this.onViewportChange);
      win.visualViewport?.addEventListener('scroll', this.onViewportChange);
      win.addEventListener('resize', this.onWindowResize);
    });
  }

  ngOnDestroy(): void {
    this.limpiarTimers();
    this.doc.removeEventListener('focusin', this.onFocusIn);
    this.win?.visualViewport?.removeEventListener('resize', this.onViewportChange);
    this.win?.visualViewport?.removeEventListener('scroll', this.onViewportChange);
    this.win?.removeEventListener('resize', this.onWindowResize);
  }

  // Al enfocar un campo dentro de un modal, el teclado móvil se superpone al
  // modal (interactive-widget=overlays-content). Aquí desplazamos el cuerpo del
  // modal —y si hace falta la tarjeta— para que el campo quede visible.
  private readonly onFocusIn = (event: Event): void => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    if (!this.esCampoEditable(el)) {
      this.campoActivo = null;
      this.tarjetaActiva = null;
      this.resetTransform();
      return;
    }

    const card = el.closest('.modal-card') as HTMLElement | null;
    if (!card) return;

    this.campoActivo = el;
    const mismaTarjeta = this.tarjetaActiva === card;
    if (!mismaTarjeta) {
      this.resetTransform();
    }
    this.tarjetaActiva = card;
    this.limpiarTimers();

    // Reajustar mientras termina la animación del teclado.
    [80, 320, 620].forEach(ms => {
      this.timers.push(this.win!.setTimeout(() => this.ajustar(), ms));
    });
  };

  private readonly onViewportChange = (): void => {
    if (this.campoActivo) {
      this.ajustar();
    } else {
      this.resetTransform();
    }
  };

  private readonly onWindowResize = (): void => {
    const vv = this.win?.visualViewport;
    if (vv && !this.campoActivo) {
      this.alturaViewport = vv.height;
    }
  };

  private ajustar(): void {
    const el = this.campoActivo;
    const card = this.tarjetaActiva;
    const win = this.win;
    const vv = win?.visualViewport;
    if (!el || !card || !win || !vv) return;

    // El layout no cambia con el teclado (resizes-visual). Comparamos contra la
    // altura del viewport visual sin teclado para saber cuánto se superpone.
    const alturaLayout = this.doc.documentElement.clientHeight;
    const porOffset = alturaLayout - (vv.offsetTop + vv.height);
    const porAltura = this.alturaViewport - vv.height;
    const altoTeclado = Math.max(porOffset, porAltura);
    if (altoTeclado < 120) {
      if (vv.height > this.alturaViewport) {
        this.alturaViewport = vv.height;
      }
      this.resetTransform();
      return;
    }

    const body = el.closest('.modal-body') as HTMLElement | null;
    if (!body) return;

    const margen = 16;
    const limiteInferior = vv.offsetTop + vv.height - margen;
    const limiteSuperior = Math.max(vv.offsetTop, body.getBoundingClientRect().top) + margen;

    // Si el campo pertenece a un select con búsqueda y su lista está abierta,
    // también hay que dejar visible la lista (no solo el input).
    const lista = this.listaActiva();

    const medir = (): { top: number; bottom: number } => {
      const rEl = el.getBoundingClientRect();
      const rLista = lista?.getBoundingClientRect();
      return {
        top: rLista ? Math.min(rEl.top, rLista.top) : rEl.top,
        bottom: rLista ? Math.max(rEl.bottom, rLista.bottom) : rEl.bottom
      };
    };

    let medida = medir();

    if (medida.bottom > limiteInferior) {
      const maxScroll = body.scrollHeight - body.clientHeight - body.scrollTop;
      const espacioArriba = Math.max(0, medida.top - limiteSuperior);
      const delta = medida.bottom - limiteInferior;
      const scroll = Math.min(delta, Math.max(0, maxScroll), espacioArriba);
      if (scroll > 0) {
        body.scrollTop += scroll;
        medida = medir();
      }
    } else if (medida.top < limiteSuperior && body.scrollTop > 0) {
      body.scrollTop = Math.max(0, body.scrollTop - (limiteSuperior - medida.top));
      medida = medir();
    }

    // Si el cuerpo ya no puede desplazarse más, mover la tarjeta hacia arriba
    // solo lo necesario (sin ocultar el campo ni el encabezado).
    if (medida.bottom > limiteInferior) {
      const restante = medida.bottom - limiteInferior;
      const cardRect = card.getBoundingClientRect();
      const espacioTarjeta = Math.max(0, cardRect.top - margen - vv.offsetTop);
      const espacioArriba = Math.max(0, medida.top - limiteSuperior);
      const extra = Math.min(restante, espacioTarjeta, espacioArriba);
      if (extra > 0) {
        this.shiftActual += extra;
        card.style.transform = `translateY(-${this.shiftActual}px)`;
        medida = medir();
      }
    }

    // Último recurso: si la lista aún sobresale, limitar su alto para que se
    // vea completa y el resto se consulte desplazándola internamente.
    if (lista) {
      const rLista = lista.getBoundingClientRect();
      const disponible = limiteInferior - rLista.top;
      if (rLista.bottom > limiteInferior && disponible > 0) {
        lista.style.maxHeight = `${Math.max(72, disponible)}px`;
      }
    }
  }

  private listaActiva(): HTMLElement | null {
    const host = this.campoActivo?.closest('app-searchable-select');
    return (host?.querySelector('.ss-list') as HTMLElement | null) ?? null;
  }

  private resetTransform(): void {
    if (this.tarjetaActiva) {
      this.tarjetaActiva.style.transform = '';
    }
    const lista = this.listaActiva();
    if (lista) {
      lista.style.maxHeight = '';
    }
    this.shiftActual = 0;
  }

  private limpiarTimers(): void {
    this.timers.forEach(id => this.win?.clearTimeout(id));
    this.timers = [];
  }

  private esCampoEditable(el: HTMLElement): boolean {
    const win = this.win;
    if (!win) return false;

    if (el instanceof win.HTMLTextAreaElement) return true;
    if (el instanceof win.HTMLInputElement) {
      return ![
        'checkbox', 'radio', 'button', 'submit', 'reset',
        'file', 'range', 'color', 'date', 'time',
        'datetime-local', 'month', 'week'
      ].includes(el.type);
    }
    return false;
  }
}
