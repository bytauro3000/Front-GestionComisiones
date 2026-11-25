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
import Panzoom from '@panzoom/panzoom';
import type { PanzoomObject } from '@panzoom/panzoom';

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

  private pz?: PanzoomObject;
  private wheelHandler?: (event: WheelEvent) => void;

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
    if (!this.canvas || !this.viewport) return;

    this.pz = Panzoom(this.canvas.nativeElement, {
      maxScale: 8,
      minScale: 1,
      contain: 'outside',
      cursor: 'grab',
      touchAction: 'none'
    });

    this.wheelHandler = (event: WheelEvent) => {
      event.preventDefault();
      this.pz?.zoomWithWheel(event);
    };

    this.viewport.nativeElement.addEventListener(
      'wheel',
      this.wheelHandler,
      { passive: false }
    );
  }

  ngOnDestroy(): void {
    if (this.viewport && this.wheelHandler) {
      this.viewport.nativeElement.removeEventListener('wheel', this.wheelHandler);
    }
    this.pz?.destroy();
  }

  zoomIn(): void {
    this.pz?.zoomIn();
  }

  zoomOut(): void {
    this.pz?.zoomOut();
  }

  resetZoom(): void {
    this.pz?.reset();
  }

  seleccionar(id: string, loteId?: number): void {
    this.loteClick.emit(loteId ?? id);
  }
}

