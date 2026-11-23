import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';
import {
  ComprobanteService,
  ComprobanteListado,
  PagoDisponible,
  ComprobanteCrear
} from '../../services/comprobante.service';
import { IntegracionSunatService, IntegracionSunat } from '../../services/integracion-sunat.service';

interface EmpresaConPagos {
  idEmpresa: number;
  empresaNombre: string;
  total: number;
}

@Component({
  selector: 'app-comprobantes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comprobantes.component.html',
  styleUrl: './comprobantes.component.scss'
})
export class ComprobantesComponent implements OnInit {

  comprobantes: ComprobanteListado[] = [];
  pagosDisponibles: PagoDisponible[] = [];
  cargando = false;

  // ── Emitir ────────────────────────────────────────────────────────────────
  emitirAbierto = false;
  emitiendo = false;
  consultandoPagos = false;
  readonly hoy = new Date().toISOString().substring(0, 10);
  fechaEmision = this.hoy;
  conceptoExtra = '';
  idEmpresaSeleccionada: number | null = null;
  pagoIds: number[] = [];

  // ── Detalle ───────────────────────────────────────────────────────────────
  detalle: ComprobanteListado | null = null;

  // ── Integración SUNAT ─────────────────────────────────────────────────────
  integAbierto = false;
  integ: IntegracionSunat | null = null;
  integOriginal: IntegracionSunat | null = null;
  guardandoInteg = false;
  probando = false;

  constructor(
    private comprobanteService: ComprobanteService,
    private integracionService: IntegracionSunatService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.comprobanteService.listar().subscribe({
      next: (data) => {
        this.comprobantes = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.toastr.error('Error al cargar los comprobantes', 'Error');
      }
    });
  }

  get empresasConPagos(): EmpresaConPagos[] {
    const mapa = new Map<number, EmpresaConPagos>();
    for (const p of this.pagosDisponibles) {
      const actual = mapa.get(p.idEmpresa);
      if (actual) {
        actual.total += p.monto;
      } else {
        mapa.set(p.idEmpresa, {
          idEmpresa: p.idEmpresa,
          empresaNombre: p.empresaNombre,
          total: p.monto
        });
      }
    }
    return Array.from(mapa.values());
  }

  get pagosDeEmpresa(): PagoDisponible[] {
    if (this.idEmpresaSeleccionada == null) return [];
    return this.pagosDisponibles.filter(p => p.idEmpresa === this.idEmpresaSeleccionada);
  }

  get subtotalSeleccionado(): number {
    return this.pagosDeEmpresa
      .filter(p => this.pagoIds.includes(p.idPago))
      .reduce((acc, p) => acc + p.monto, 0);
  }

  get igvSeleccionado(): number {
    return Math.round(this.subtotalSeleccionado * 18) / 100;
  }

  get totalSeleccionado(): number {
    return this.subtotalSeleccionado + this.igvSeleccionado;
  }

  // ── Emitir ─────────────────────────────────────────────────────────────────

  abrirEmitir(): void {
    this.pagoIds = [];
    this.conceptoExtra = '';
    this.fechaEmision = this.hoy;
    this.idEmpresaSeleccionada = null;
    this.emitirAbierto = true;
    this.consultandoPagos = true;
    this.comprobanteService.pagosDisponibles().subscribe({
      next: (pagos) => {
        this.consultandoPagos = false;
        this.pagosDisponibles = pagos;
        const empresas = this.empresasConPagos;
        if (empresas.length === 1) {
          this.idEmpresaSeleccionada = empresas[0].idEmpresa;
        }
        if (empresas.length === 0) {
          this.toastr.info('No hay pagos cobrados sin facturar');
        }
      },
      error: (err) => {
        this.consultandoPagos = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudieron cargar los pagos disponibles', 'Error');
      }
    });
  }

  cerrarEmitir(): void {
    this.emitirAbierto = false;
  }

  seleccionarEmpresa(idEmpresa: number): void {
    if (this.idEmpresaSeleccionada === idEmpresa) return;
    this.idEmpresaSeleccionada = idEmpresa;
    this.pagoIds = [];
  }

  togglePago(idPago: number): void {
    if (this.pagoIds.includes(idPago)) {
      this.pagoIds = this.pagoIds.filter(x => x !== idPago);
    } else {
      this.pagoIds = [...this.pagoIds, idPago];
    }
  }

  emitir(): void {
    if (this.emitiendo) return;
    if (this.idEmpresaSeleccionada == null) {
      this.toastr.warning('Seleccione la empresa a la que se factura');
      return;
    }
    if (this.pagoIds.length === 0) {
      this.toastr.warning('Seleccione al menos un pago cobrado');
      return;
    }
    if (!this.fechaEmision) {
      this.toastr.warning('Indique la fecha de emisión');
      return;
    }

    const dto: ComprobanteCrear = {
      tipo: 'FACTURA',
      idEmpresa: this.idEmpresaSeleccionada,
      pagos: [...this.pagoIds],
      fechaEmision: this.fechaEmision,
      concepto: this.conceptoExtra.trim() || undefined
    };

    this.emitiendo = true;
    this.comprobanteService.emitir(dto).subscribe({
      next: (comprobante) => {
        this.emitiendo = false;
        this.emitirAbierto = false;
        const numero = comprobante.serie && comprobante.correlativo
          ? `${comprobante.serie}-${comprobante.correlativo}`
          : `#${comprobante.id}`;
        this.toastr.success(`Factura ${numero} emitida y enviada a SUNAT`, 'Factura emitida', { timeOut: 5000 });
        this.cargar();
      },
      error: (err) => {
        this.emitiendo = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudo emitir la factura', 'Error de emisión', { timeOut: 6000 });
      }
    });
  }

  // ── Detalle / sincronizar / PDF ───────────────────────────────────────────

  abrirDetalle(c: ComprobanteListado): void {
    this.detalle = c;
  }

  sincronizar(c: ComprobanteListado): void {
    this.comprobanteService.sincronizar(c.id).subscribe({
      next: (actualizado) => {
        const idx = this.comprobantes.findIndex(x => x.id === c.id);
        if (idx >= 0) this.comprobantes[idx] = actualizado;
        this.toastr.info(`Estado: ${this.etiquetaEstado(actualizado.estado)}`, 'Sincronizado con SUNAT');
      },
      error: (err) => {
        this.toastr.error(err?.error?.mensaje || 'No se pudo sincronizar con SUNAT', 'Error');
      }
    });
  }

  descargarPdf(c: ComprobanteListado): void {
    this.comprobanteService.descargarPdf(c.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const nombre = `${c.serie || 'F'}-${c.correlativo || c.id}.pdf`;
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        a.click();
        URL.revokeObjectURL(url);
        this.toastr.success('PDF descargado: ' + nombre);
      },
      error: (err) => {
        this.toastr.error(err?.error?.mensaje || 'No se pudo descargar el PDF', 'Error');
      }
    });
  }

  // ── Integración SUNAT ─────────────────────────────────────────────────────

  abrirIntegracion(): void {
    this.integAbierto = true;
    this.integ = null;
    this.integracionService.obtener().subscribe({
      next: (config) => {
        this.integ = { ...config };
        this.integOriginal = { ...config };
      },
      error: (err) => {
        this.toastr.error(err?.error?.mensaje || 'No se pudo cargar la configuración', 'Error');
        this.integAbierto = false;
      }
    });
  }

  cerrarIntegracion(): void {
    this.integAbierto = false;
    this.integ = null;
    this.integOriginal = null;
  }

  guardarIntegracion(): void {
    if (!this.integ || this.guardandoInteg) return;
    if (!this.integ.serieFactura || !/^F\d{3}|\d{4}$/.test(this.integ.serieFactura)) {
      this.toastr.warning('La serie debe empezar con F (ej: F001)');
      return;
    }
    if (this.integ.aplicarDetraccion && !this.integ.ctaBanco?.trim()) {
      this.toastr.warning('Indique la cuenta bancaria para la detracción o desactívela');
      return;
    }

    this.guardandoInteg = true;
    this.integracionService.guardar(this.integ).subscribe({
      next: (guardado) => {
        this.guardandoInteg = false;
        this.integ = { ...guardado };
        this.integOriginal = { ...guardado };
        this.toastr.success('Configuración de facturación guardada');
        this.cerrarIntegracion();
      },
      error: (err) => {
        this.guardandoInteg = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudo guardar la configuración', 'Error');
      }
    });
  }

  probarConexion(): void {
    if (!this.integ || this.probando) return;
    this.probando = true;
    this.integracionService.probar().subscribe({
      next: (res) => {
        this.probando = false;
        if (res.conectado) {
          this.toastr.success('Conexión exitosa con api-sunat', 'Conectado');
        } else {
          this.toastr.error('api-sunat rechazó las credenciales o no responde', 'Sin conexión');
        }
      },
      error: (err) => {
        this.probando = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudo probar la conexión', 'Error');
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  etiquetaEstado(estado: string): string {
    switch (estado) {
      case 'EMITIDO': return 'Emitido';
      case 'EN_PROCESO': return 'En proceso';
      case 'ACEPTADO': return 'Aceptado';
      case 'RECHAZADO': return 'Rechazado';
      case 'ANULADO': return 'Anulado';
      default: return estado;
    }
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'ACEPTADO': return 'badge-activo';
      case 'RECHAZADO': return 'badge-inactivo';
      case 'ANULADO': return 'badge-inactivo';
      case 'EN_PROCESO': return 'badge-warning';
      default: return 'badge-info';
    }
  }

  formatoNumero(valor: string | undefined): string {
    if (!valor) return '—';
    return valor;
  }
}
