import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
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
  manzana: string;
  lote: number;
  area: number;
  centro: [number, number];
  puntos: [number, number][];
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
  @Output() loteClick = new EventEmitter<number | string>();

  @ViewChild('viewport') private viewport?: ElementRef<HTMLElement>;

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
      .filter(l => !geo.has(claveLote(l.manzana, l.numero)))
      .map(l => claveLote(l.manzana, l.numero));
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

      const g = geo.get(claveLote(l.manzana, l.numero));
      if (!g) continue;

      salida.push({
        id: g.id,
        loteId: l.id,
        estado,
        color,
        centro: g.centro,
        puntos: g.puntos.map(p => p.join(',')).join(' ')
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

  readonly transformCanvas = computed(() => {
    const { x, y } = this.pan();
    return `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${this.rotado() ? 90 : 0}deg)`;
  });

  private resizeObs?: ResizeObserver;
  private wheelHandler?: (event: WheelEvent) => void;
  private suprimirClick = false;

  private readonly punteros = new Map<number, { x: number; y: number }>();
  private arrastre?: {
    x: number;
    y: number;
    panX: number;
    panY: number;
    movido: boolean;
  };
  private pinch?: { distancia: number; escala: number };

  constructor(private http: HttpClient) {
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
          new Map(j.lotes.map(x => [claveLote(x.manzana, x.lote), x]))
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

    this.viewportSize.set({ w: el.clientWidth, h: el.clientHeight });

    this.resizeObs = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      this.viewportSize.set({ w: rect.width, h: rect.height });
      this.pan.set(this.limitarPan(this.pan().x, this.pan().y));
    });
    this.resizeObs.observe(el);

    this.wheelHandler = (event: WheelEvent) => {
      event.preventDefault();
      this.aplicarZoom(event.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener('wheel', this.wheelHandler, { passive: false });
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    if (this.viewport && this.wheelHandler) {
      this.viewport.nativeElement.removeEventListener('wheel', this.wheelHandler);
    }
  }

  zoomIn(): void {
    this.aplicarZoom(1.25);
  }

  zoomOut(): void {
    this.aplicarZoom(1 / 1.25);
  }

  resetZoom(): void {
    this.escala.set(1);
    this.pan.set({ x: 0, y: 0 });
  }

  rotar(): void {
    this.rotado.update(v => !v);
    this.escala.set(1);
    this.pan.set({ x: 0, y: 0 });
  }

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    this.suprimirClick = false;
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
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.punteros.has(event.pointerId)) return;
    this.punteros.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pinch && this.punteros.size >= 2) {
      const [a, b] = [...this.punteros.values()];
      const distancia = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch.distancia > 0) {
        const nueva = clamp(
          this.pinch.escala * (distancia / this.pinch.distancia),
          1,
          5
        );
        this.escala.set(nueva);
        this.pan.set(this.limitarPan(this.pan().x, this.pan().y));
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
      this.pan.set(
        this.limitarPan(
          this.arrastre.panX + dx,
          this.arrastre.panY + dy
        )
      );
    }
  }

  onPointerUp(event: PointerEvent): void {
    this.punteros.delete(event.pointerId);

    if (this.punteros.size < 2) this.pinch = undefined;

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
  }

  seleccionar(id: string, loteId?: number): void {
    if (this.suprimirClick) {
      this.suprimirClick = false;
      return;
    }
    this.loteClick.emit(loteId ?? id);
  }

  private aplicarZoom(factor: number): void {
    const nueva = clamp(this.escala() * factor, 1, 5);
    this.escala.set(nueva);

    if (nueva === 1) {
      this.pan.set({ x: 0, y: 0 });
    } else {
      this.pan.set(this.limitarPan(this.pan().x, this.pan().y));
    }
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

