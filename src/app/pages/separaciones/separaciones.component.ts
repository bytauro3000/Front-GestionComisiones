import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { LoteService, Lote } from '../../services/lote.service';
import { EmpresaService, Empresa } from '../../services/empresa.service';
import { ProyectoService, Proyecto } from '../../services/proyecto.service';
import { CurrencyFormatterDirective } from '../../directives/currency-formatter';
import { AlertService } from '../../services/alert.service';

interface SeparacionForm {
  idEmpresa: number | null;
  idProyecto: number | null;
  idLote: number | null;
  fechaVence: string;
  monto: number | null;
  ajena: boolean;
  cliente: string;
  nota: string;
}

@Component({
  selector: 'app-separaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyFormatterDirective],
  templateUrl: './separaciones.component.html',
  styleUrl: './separaciones.component.scss'
})
export class SeparacionesComponent implements OnInit {

  separaciones: Lote[] = [];
  cargando = false;
  procesandoId: number | null = null;
  filtroTipo: '' | 'PROPIA' | 'AJENA' = '';

  empresas: Empresa[] = [];
  proyectos: Proyecto[] = [];
  lotesDisponibles: Lote[] = [];

  modalAbierto = false;
  guardando = false;
  form: SeparacionForm = this.formVacio();

  /** Aviso: separaciones propias que vencen en ≤3 días. */
  readonly diasAviso = 3;

  readonly presets = [
    { dias: 15, etiqueta: '15 días' },
    { dias: 30, etiqueta: '1 mes' },
    { dias: 60, etiqueta: '2 meses' }
  ];

  constructor(
    private loteService: LoteService,
    private empresaService: EmpresaService,
    private proyectoService: ProyectoService,
    private alert: AlertService
  ) { }

  ngOnInit(): void {
    this.cargar();
    this.cargarCatalogos();
  }

  cargar(): void {
    this.cargando = true;
    this.loteService.listarSeparaciones().subscribe({
      next: (data) => {
        this.separaciones = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.alert.toastError('Error al cargar las separaciones', 'Error');
      }
    });
  }

  private cargarCatalogos(): void {
    this.empresaService.listar().subscribe({ next: (d) => (this.empresas = d), error: () => undefined });
    this.proyectoService.listar().subscribe({ next: (d) => (this.proyectos = d), error: () => undefined });
  }

  get xFiltradas(): Lote[] {
    if (!this.filtroTipo) return this.separaciones;
    return this.separaciones.filter(l => this.filtroTipo === 'AJENA' ? !!l.separacionAjena : !l.separacionAjena);
  }

  get proyectosDisponibles(): Proyecto[] {
    if (this.form.idEmpresa == null) return [];
    return this.proyectos.filter(p => p.idEmpresa === this.form.idEmpresa && p.estado !== 'INACTIVO');
  }

  /** Días que faltan para que venza (negativo = vencida). */
  diasRestantes(l: Lote): number {
    if (!l.fechaVinceSeparacion) return 0;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fin = new Date(l.fechaVinceSeparacion + 'T00:00:00');
    return Math.round((fin.getTime() - hoy.getTime()) / 86400000);
  }

  porVencer(l: Lote): boolean {
    const d = this.diasRestantes(l);
    return !l.separacionAjena && d >= 0 && d <= this.diasAviso;
  }

  vencida(l: Lote): boolean {
    return this.diasRestantes(l) < 0;
  }

  get alertas(): Lote[] {
    return this.separaciones.filter(l => this.porVencer(l));
  }

  // ── Nueva separación ──────────────────────────────────────────────────────

  abrirNueva(): void {
    this.form = this.formVacio();
    this.lotesDisponibles = [];
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  onEmpresaChange(): void {
    this.form.idProyecto = null;
    this.form.idLote = null;
    this.lotesDisponibles = [];
  }

  onProyectoChange(): void {
    this.form.idLote = null;
    this.lotesDisponibles = [];
    if (this.form.idProyecto == null) return;
    this.loteService.listar({ idProyecto: this.form.idProyecto }).subscribe({
      next: (lotes) => {
        this.lotesDisponibles = lotes.filter(l => l.estado !== 'VENDIDO' && !l.ventaActiva);
      },
      error: () => this.alert.toastError('No se pudieron cargar los lotes', 'Error')
    });
  }

  aplicarPreset(p: { dias: number }): void {
    this.form.fechaVence = this.fechaDesde(p.dias);
  }

  confirmar(): void {
    if (this.guardando) return;
    if (this.form.idLote == null) {
      this.alert.toastWarning('Seleccione el lote a separar');
      return;
    }
    if (!this.form.fechaVence) {
      this.alert.toastWarning('Indique la fecha de vencimiento');
      return;
    }
    const hoy = this.hoy();
    if (this.form.fechaVence < hoy) {
      this.alert.toastWarning('La fecha de vencimiento no puede ser pasada');
      return;
    }

    this.guardando = true;
    this.loteService.separar(this.form.idLote, {
      fechaVence: this.form.fechaVence,
      monto: this.form.monto ?? undefined,
      ajena: this.form.ajena,
      cliente: this.form.cliente?.trim() || undefined,
      nota: this.form.nota?.trim() || undefined
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.modalAbierto = false;
        this.alert.success('Separación registrada');
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.alert.toastError(err?.error?.mensaje || 'No se pudo registrar la separación', 'Error');
      }
    });
  }

  liberar(l: Lote): void {
    Swal.fire({
      title: 'Liberar separación',
      html: `¿Liberar el lote <strong>${l.proyecto} Mz.${l.manzana} Lt.${l.numero}</strong>?<br>` +
            `<small>Volverá a estar disponible.</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, liberar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = l.id ?? null;
      this.loteService.liberarSeparacion(l.id!).subscribe({
        next: () => {
          this.procesandoId = null;
          this.alert.success('Separación liberada');
          this.cargar();
        },
        error: (err) => {
          this.procesandoId = null;
          this.alert.toastError(err?.error?.mensaje || 'No se pudo liberar la separación', 'Error');
        }
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatearMoneda(v?: number): string {
    return '$ ' + new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(v || 0);
  }

  formatearFecha(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  etiquetaLote(l: Lote): string {
    return `${l.proyecto} Mz.${l.manzana} Lt.${l.numero}`;
  }

  hoy(): string {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  private fechaDesde(dias: number): string {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  private formVacio(): SeparacionForm {
    return {
      idEmpresa: null,
      idProyecto: null,
      idLote: null,
      fechaVence: '',
      monto: null,
      ajena: false,
      cliente: '',
      nota: ''
    };
  }
}
