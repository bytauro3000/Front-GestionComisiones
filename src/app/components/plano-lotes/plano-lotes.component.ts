import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  computed,
  effect,
  signal
} from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface LotePoligono {
  id: string;
  programa?: string;
  manzana: string;
  lote: number;
  area: number;
  centro: [number, number];
  puntos?: string | [number, number][];
  coordenadas?: [number, number][];
}

interface PlanoJson {
  proyecto: string;
  viewBox: [number, number, number, number];
  lotes: LotePoligono[];
  parques?: unknown[];
}

type EstadoPlano = 'DISPONIBLE' | 'RESERVADO' | 'VENDIDO' | 'SEPARADO';

export interface LoteEstado {
  id?: number;
  programa?: string;
  manzana: string;
  numero: string | number;
  estado?: EstadoPlano | string;
  ventaActiva?: boolean;
}

interface Marca {
  id: string;
  loteId?: number;
  estado: string;
  color: { fill: string; stroke: string };
  centro: [number, number];
  puntos: string;
}

const COLORES: Record<string, { fill: string; stroke: string }> = {
  VENDIDO: { fill: 'rgba(220,38,38,0.45)', stroke: '#b91c1c' },
  RESERVADO: { fill: 'rgba(249,115,22,0.50)', stroke: '#ea580c' }
};

const sinAcentos = (v: string) =>
  (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const normManzana = (m: string) =>
  sinAcentos(String(m ?? ''))
    .toUpperCase()
    .replace(/^\s*(MANZANA|MZ|MZA|MZ\.|LOTE|LT)\s*[.\-_ ]*/, '')
    .trim();

export const normNumero = (n: string | number) => {
  const digitos = String(n ?? '').replace(/\D/g, '');
  return digitos ? String(parseInt(digitos, 10)) : '';
};

export const claveLote = (manzana: string, numero: string | number) =>
  `${normManzana(manzana)}-${normNumero(numero)}`;

export const claveLotePrograma = (
  programa: string,
  manzana: string,
  numero: string | number
) => `${(programa || '').trim().toUpperCase()}-${claveLote(manzana, numero)}`;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

@Component({
  selector: 'app-plano-lotes',
  standalone: true,
  templateUrl: './plano-lotes.component.html',
  styleUrl: './plano-lotes.component.scss'
})
export class PlanoLotesComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) svgUrl!: string;
  @Input() jsonUrl = 'planos/villa-familia.json';
  @Input() modoPunto = false;
  @Input() interactivo = true;
  @Output() loteClick = new EventEmitter<number | string>();

  private readonly programaActual = signal('');

  @Input()
  set programa(v: string | undefined) {
    this.programaActual.set((v || '').trim().toUpperCase());
  }

  @ViewChild('viewport') private viewport?: ElementRef<HTMLElement>;
  @ViewChild('canvas') private canvas?: ElementRef<HTMLElement>;

  private readonly _lotes = signal<LoteEstado[]>([]);

  @Input({ required: true })
  set lotes(v: LoteEstado[]) {
    this._lotes.set(v ?? []);
  }

  private readonly geo = signal(new Map<string, LotePoligono>());
  readonly vb = signal<[number, number, number, number] | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly escala = signal(1);
  readonly rotado = signal(
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );
  readonly pan = signal({ x: 0, y: 0 });
  private readonly viewportSize = signal({ w: 0, h: 0 });

  readonly faltantes = computed(() => {
    const geo = this.geo();
    return this._lotes()
      .filter(l => !geo.has(this.claveDe(l.manzana, l.numero, l.programa)))
      .map(l => this.claveDe(l.manzana, l.numero, l.programa));
  });

  readonly marcas = computed<Marca[]>(() => {
    const geo = this.geo();
    const salida: Marca[] = [];

    for (const l of this._lotes()) {
      const raw = String(l.estado || '').toUpperCase();
      const estado = l.ventaActiva || raw === 'VENDIDO'
        ? 'VENDIDO'
        : raw === 'SEPARADO'
          ? 'RESERVADO'
          : raw;

      const color = COLORES[estado];
      if (!color) continue;

      const g = geo.get(this.claveDe(l.manzana, l.numero, l.programa));
      if (!g) continue;

      const puntos = Array.isArray(g.puntos)
        ? g.puntos
        : (g.coordenadas ?? []);
      if (!puntos.length) continue;

      salida.push({
        id: g.id,
        loteId: l.id,
        estado,
        color,
        centro: g.centro,
        puntos: puntos.map(p => p.join(',')).join(' ')
      });
    }

    return salida;
  });

  readonly aspecto = computed(() => {
    const v = this.vb();
    return v && v[3] ? v[2] / v[3] : 935.3 / 1558.8;
  });

  readonly base = computed(() => {
    const { w, h } = this.viewportSize();
    const p = this.aspecto();
    if (!w || !h) return { w: 0, h: 0 };

    const bw = this.rotado()
      ? Math.min(h, w * p)
      : Math.min(w, h * p);

    return { w: bw, h: bw / p };
  });

  readonly contenido = computed(() => {
    const b = this.base();
    const s = this.escala();
    return { w: b.w * s, h: b.h * s };
  });

  private resizeObs?: ResizeObserver;
  private suprimirClick = false;
  private panPendiente = { x: 0, y: 0 };
  private ultimoPan = { x: 0, y: 0 };
  private rafPan: number | null = null;

  private zoomTemporal = 1;
  private zoomPendiente = 1;
  private rafZoom: number | null = null;
  private zoomTimer: number | null = null;

  private readonly punteros = new Map<number, { x: number; y: number }>();
  private arrastre?: {
    x: number;
    y: number;
    panX: number;
    panY: number;
    movido: boolean;
  };
  private pinch?: { distancia: number; escala: number };

  private readonly wheelHandler = (event: WheelEvent): void => {
    event.preventDefault();
    this.previewZoom(event.deltaY < 0 ? 1.15 : 1 / 1.15);
  };

  constructor(
    private http: HttpClient,
    private zone: NgZone
  ) {
    effect(() => {
      if (this.cargando() || this.error()) return;
      const faltantes = this.faltantes();
      if (faltantes.length) {
        console.warn('[Plano] Lotes sin polígono:', faltantes);
      }
    });
  }

  ngOnInit(): void {
    this.http.get<PlanoJson>(this.jsonUrl).subscribe({
      next: (j) => {
        if (!j.viewBox || j.viewBox.length !== 4) {
          this.error.set('El JSON del plano no tiene un viewBox válido.');
          this.cargando.set(false);
          return;
        }

        this.vb.set(j.viewBox);
        this.geo.set(
          new Map(j.lotes.map(x => [
            x.programa
              ? claveLotePrograma(x.programa, x.manzana, x.lote)
              : claveLote(x.manzana, x.lote),
            x
          ]))
        );
        this.cargando.set(false);
      },
      error: (e) => {
        console.error(e);
        this.error.set('No se pudo cargar la geometría del plano.');
        this.cargando.set(false);
      }
    });
  }

  ngAfterViewInit(): void {
    const el = this.viewport?.nativeElement;
    if (!el) return;

    const canvas = this.canvas?.nativeElement;
    if (canvas) {
      canvas.style.setProperty('--rot', this.rotado() ? '90deg' : '0deg');
      canvas.style.setProperty('--pan-x', '0px');
      canvas.style.setProperty('--pan-y', '0px');
      canvas.style.setProperty('--zoom-preview', '1');
    }

    this.viewportSize.set({ w: el.clientWidth, h: el.clientHeight });

    this.resizeObs = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      this.zone.run(() => {
        this.viewportSize.set({ w: rect.width, h: rect.height });
        const p = this.limitarPan(this.pan().x, this.pan().y);
        this.pan.set(p);
        this.ultimoPan = p;
        this.panDom(p.x, p.y);
      });
    });
    this.resizeObs.observe(el);

    this.zone.runOutsideAngular(() => {
      el.addEventListener('pointerdown', this.onPointerDown);
      el.addEventListener('pointermove', this.onPointerMove);
      el.addEventListener('pointerup', this.onPointerUp);
      el.addEventListener('pointercancel', this.onPointerUp);
      el.addEventListener('wheel', this.wheelHandler, { passive: false });
    });
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();

    if (this.rafPan !== null) {
      cancelAnimationFrame(this.rafPan);
      this.rafPan = null;
    }

    if (this.rafZoom !== null) {
      cancelAnimationFrame(this.rafZoom);
      this.rafZoom = null;
    }

    if (this.zoomTimer !== null) {
      clearTimeout(this.zoomTimer);
      this.zoomTimer = null;
    }

    const el = this.viewport?.nativeElement;
    if (el) {
      el.removeEventListener('pointerdown', this.onPointerDown);
      el.removeEventListener('pointermove', this.onPointerMove);
      el.removeEventListener('pointerup', this.onPointerUp);
      el.removeEventListener('pointercancel', this.onPointerUp);
      el.removeEventListener('wheel', this.wheelHandler);
    }
  }

  zoomIn(): void {
    this.aplicarZoom(1.25);
  }

  zoomOut(): void {
    this.aplicarZoom(1 / 1.25);
  }

  resetZoom(): void {
    this.zoomTemporal = 1;
    this.zoomPendiente = 1;
    this.zoomDom(1);
    this.zone.run(() => {
      this.escala.set(1);
      this.pan.set({ x: 0, y: 0 });
      this.ultimoPan = { x: 0, y: 0 };
      this.panDom(0, 0);
    });
  }

  rotar(): void {
    this.zoomTemporal = 1;
    this.zoomPendiente = 1;
    this.zoomDom(1);
    this.rotado.update(v => !v);
    this.escala.set(1);
    this.pan.set({ x: 0, y: 0 });
    this.ultimoPan = { x: 0, y: 0 };

    const canvas = this.canvas?.nativeElement;
    canvas?.style.setProperty('--rot', this.rotado() ? '90deg' : '0deg');
    this.panDom(0, 0);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    if (this.zoomTemporal !== 1 || this.zoomTimer !== null) {
      this.commitZoomPreview();
    }

    this.suprimirClick = false;
    this.ultimoPan = { x: this.pan().x, y: this.pan().y };
    this.punteros.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const sobreLote = (event.target as Element | null)?.closest('polygon,circle');
    if (!sobreLote) {
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        // El navegador puede no soportar captura en este contexto.
      }
    }

    if (this.punteros.size === 1) {
      this.arrastre = {
        x: event.clientX,
        y: event.clientY,
        panX: this.pan().x,
        panY: this.pan().y,
        movido: false
      };
    } else if (this.punteros.size === 2) {
      const [a, b] = [...this.punteros.values()];
      this.pinch = {
        distancia: Math.hypot(a.x - b.x, a.y - b.y),
        escala: this.escala()
      };
      this.arrastre = undefined;
      this.suprimirClick = true;
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.punteros.has(event.pointerId)) return;
    this.punteros.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pinch && this.punteros.size >= 2) {
      const [a, b] = [...this.punteros.values()];
      const distancia = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch.distancia > 0) {
        const total = clamp(
          this.pinch.escala * (distancia / this.pinch.distancia),
          1,
          5
        );
        this.zoomTemporal = total / this.escala();
        this.zoomDom(this.zoomTemporal);
      }
      this.suprimirClick = true;
      return;
    }

    if (!this.arrastre || this.punteros.size !== 1) return;

    const dx = event.clientX - this.arrastre.x;
    const dy = event.clientY - this.arrastre.y;

    if (!this.arrastre.movido && Math.hypot(dx, dy) > 4) {
      this.arrastre.movido = true;
      this.suprimirClick = true;
    }

    if (this.arrastre.movido) {
      const p = this.limitarPan(
        this.arrastre.panX + dx,
        this.arrastre.panY + dy
      );
      this.ultimoPan = p;
      this.panDom(p.x, p.y);
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const movido = this.arrastre?.movido ?? false;
    const eraPinch = !!this.pinch;
    const final = { ...this.ultimoPan };

    this.punteros.delete(event.pointerId);

    if (this.punteros.size < 2) this.pinch = undefined;

    if (eraPinch && this.punteros.size < 2) {
      this.commitZoomPreview();
    }

    if (this.punteros.size === 1) {
      const [p] = [...this.punteros.values()];
      this.arrastre = {
        x: p.x,
        y: p.y,
        panX: this.pan().x,
        panY: this.pan().y,
        movido: false
      };
    } else if (this.punteros.size === 0) {
      this.arrastre = undefined;
    }

    if (movido) {
      this.zone.run(() => {
        this.pan.set(final);
        this.panDom(final.x, final.y);
      });
    }
  };

  seleccionar(id: string, loteId?: number): void {
    if (!this.interactivo) return;
    if (this.suprimirClick) {
      this.suprimirClick = false;
      return;
    }
    this.loteClick.emit(loteId ?? id);
  }

  private claveDe(
    manzana: string,
    numero: string | number,
    programa = this.programaActual()
  ): string {
    const prog = (programa || '').trim().toUpperCase();
    return prog
      ? claveLotePrograma(prog, manzana, numero)
      : claveLote(manzana, numero);
  }

  private aplicarZoom(factor: number): void {
    if (this.zoomTemporal !== 1) {
      this.commitZoomPreview();
    }

    const nueva = clamp(this.escala() * factor, 1, 5);

    this.zoomTemporal = 1;
    this.zoomPendiente = 1;
    this.zoomDom(1);

    this.zone.run(() => {
      this.escala.set(nueva);

      const p = nueva === 1
        ? { x: 0, y: 0 }
        : this.limitarPan(this.pan().x, this.pan().y);

      this.pan.set(p);
      this.ultimoPan = p;
      this.panDom(p.x, p.y);
    });
  }

  private previewZoom(factor: number): void {
    if (this.zoomTimer !== null) {
      clearTimeout(this.zoomTimer);
      this.zoomTimer = null;
    }

    const totalActual = this.escala() * this.zoomTemporal;
    const totalNuevo = clamp(totalActual * factor, 1, 5);
    this.zoomTemporal = totalNuevo / this.escala();
    this.zoomDom(this.zoomTemporal);

    this.zoomTimer = window.setTimeout(() => this.commitZoomPreview(), 160);
  }

  private commitZoomPreview(): void {
    if (this.zoomTimer !== null) {
      clearTimeout(this.zoomTimer);
      this.zoomTimer = null;
    }

    const nueva = clamp(this.escala() * this.zoomTemporal, 1, 5);
    const base = this.base();
    const canvas = this.canvas?.nativeElement;

    this.zoomTemporal = 1;
    this.zoomPendiente = 1;

    if (canvas) {
      canvas.style.width = `${base.w * nueva}px`;
      canvas.style.height = `${base.h * nueva}px`;
      canvas.style.setProperty('--zoom-preview', '1');
    }

    this.zone.run(() => {
      this.escala.set(nueva);

      const p = nueva === 1
        ? { x: 0, y: 0 }
        : this.limitarPan(this.pan().x, this.pan().y);

      this.pan.set(p);
      this.ultimoPan = p;
      this.panDom(p.x, p.y);
    });
  }

  private zoomDom(preview: number): void {
    this.zoomPendiente = preview;
    if (!this.canvas || this.rafZoom !== null) return;

    this.rafZoom = requestAnimationFrame(() => {
      this.rafZoom = null;
      this.canvas?.nativeElement.style.setProperty(
        '--zoom-preview',
        String(this.zoomPendiente)
      );
    });
  }

  private panDom(x: number, y: number): void {
    this.panPendiente = { x, y };
    if (!this.canvas || this.rafPan !== null) return;

    this.rafPan = requestAnimationFrame(() => {
      this.rafPan = null;
      const canvas = this.canvas?.nativeElement;
      if (!canvas) return;

      canvas.style.setProperty('--pan-x', `${this.panPendiente.x}px`);
      canvas.style.setProperty('--pan-y', `${this.panPendiente.y}px`);
    });
  }

  private limitarPan(x: number, y: number): { x: number; y: number } {
    const { w: vw, h: vh } = this.viewportSize();
    const { w: bw, h: bh } = this.base();
    const s = this.escala();
    const cw = bw * s;
    const ch = bh * s;
    const visW = this.rotado() ? ch : cw;
    const visH = this.rotado() ? cw : ch;
    const maxX = Math.max(0, (visW - vw) / 2 + 40);
    const maxY = Math.max(0, (visH - vh) / 2 + 40);

    return {
      x: clamp(x, -maxX, maxX),
      y: clamp(y, -maxY, maxY)
    };
  }
}

