import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';
import {
  ComisionService,
  ComisionListado,
  CobrarPagos,
  PagoComision
} from '../../services/comision.service';

@Component({
  selector: 'app-comisiones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comisiones.component.html',
  styleUrl: './comisiones.component.scss'
})
export class ComisionesComponent implements OnInit {

  comisiones: ComisionListado[] = [];
  cargando = false;
  terminoBusqueda = '';
  filtroEstado = '';
  procesandoId: number | null = null;

  // Detalle / cobro
  detalleAbierto = false;
  cargandoDetalle = false;
  detalle: ComisionListado | null = null;
  pagosSeleccionados: number[] = [];

  // Formulario de cobro
  cobrando = false;
  fechaPago = '';
  formaPago = 'TRANSFERENCIA';
  referencia = '';
  notas = '';

  constructor(
    private comisionService: ComisionService,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.cargar();
    this.fechaPago = this.hoy();
  }

  cargar(): void {
    this.cargando = true;
    this.comisionService.listar().subscribe({
      next: (data) => {
        this.comisiones = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.toastr.error('Error al cargar las comisiones', 'Error');
      }
    });
  }

  get comisionesFiltradas(): ComisionListado[] {
    let lista = this.comisiones;

    if (this.filtroEstado) {
      lista = lista.filter((c) => c.estado === this.filtroEstado);
    }

    const t = this.terminoBusqueda.trim().toLowerCase();
    if (t) {
      lista = lista.filter((c) =>
        (c.loteEtiqueta || '').toLowerCase().includes(t) ||
        (c.clienteNombre || '').toLowerCase().includes(t) ||
        (c.empresaNombre || '').toLowerCase().includes(t)
      );
    }

    return lista;
  }

  // ── Detalle ───────────────────────────────────────────────────────────────

  abrirDetalle(c: ComisionListado): void {
    this.detalleAbierto = true;
    this.detalle = null;
    this.pagosSeleccionados = [];
    this.fechaPago = this.hoy();
    this.formaPago = 'TRANSFERENCIA';
    this.referencia = '';
    this.notas = '';
    this.cargarDetalle(c.id);
  }

  cerrarDetalle(): void {
    this.detalleAbierto = false;
    this.detalle = null;
    this.pagosSeleccionados = [];
  }

  private cargarDetalle(id: number): void {
    this.cargandoDetalle = true;
    this.comisionService.obtener(id).subscribe({
      next: (data) => {
        this.detalle = data;
        this.cargandoDetalle = false;
      },
      error: (err) => {
        this.cargandoDetalle = false;
        this.detalleAbierto = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudo cargar el detalle de la comisión', 'Error');
      }
    });
  }

  private recargarDetalle(id: number): void {
    this.comisionService.obtener(id).subscribe({
      next: (data) => (this.detalle = data),
      error: () => undefined
    });
  }

  // ── Selección de pagos ────────────────────────────────────────────────────

  togglePago(idPago: number, marcado: boolean): void {
    if (marcado) {
      if (!this.pagosSeleccionados.includes(idPago)) {
        this.pagosSeleccionados = [...this.pagosSeleccionados, idPago];
      }
    } else {
      this.pagosSeleccionados = this.pagosSeleccionados.filter((id) => id !== idPago);
    }
  }

  get pagosDetalle(): PagoComision[] {
    return this.detalle?.pagos ?? [];
  }

  get montoSeleccionado(): number {
    return this.pagosDetalle
      .filter((p) => p.estado === 'PENDIENTE' && this.pagosSeleccionados.includes(p.id))
      .reduce((acc, p) => acc + p.monto, 0);
  }

  get mostrarZonaCobro(): boolean {
    return this.pagosSeleccionados.length > 0 || (this.detalle?.pagosPendientes ?? 0) > 0;
  }

  // ── Cobrar ────────────────────────────────────────────────────────────────

  cobrar(): void {
    const det = this.detalle;
    if (this.cobrando || !det) return;

    if (this.pagosSeleccionados.length === 0) {
      this.toastr.warning('Seleccione al menos un pago pendiente');
      return;
    }
    if (!this.fechaPago) {
      this.toastr.warning('Indique la fecha de pago');
      return;
    }

    const dto: CobrarPagos = {
      pagos: [...this.pagosSeleccionados],
      fechaPago: this.fechaPago,
      formaPago: this.formaPago,
      referencia: this.referencia.trim() || undefined,
      notas: this.notas.trim() || undefined
    };

    const idComision = det.id;
    this.cobrando = true;
    this.comisionService.cobrar(idComision, dto).subscribe({
      next: () => {
        this.cobrando = false;
        this.toastr.success('Cobro registrado');
        this.pagosSeleccionados = [];
        this.fechaPago = this.hoy();
        this.formaPago = 'TRANSFERENCIA';
        this.referencia = '';
        this.notas = '';
        this.cargar();
        this.recargarDetalle(idComision);
      },
      error: (err) => {
        this.cobrando = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudo registrar el cobro', 'Error');
      }
    });
  }

  // ── Revertir ──────────────────────────────────────────────────────────────

  revertir(p: PagoComision): void {
    if (!this.detalle) return;
    const idComision = this.detalle.id;

    Swal.fire({
      title: 'Revertir pago',
      html: `¿Revertir el pago de <strong>${this.etiquetaTipoPago(p)}</strong> por <strong>USD ${p.monto.toFixed(2)}</strong>?<br><small>El pago volverá a estado pendiente.</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, revertir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = p.id;
      this.comisionService.revertir(idComision, p.id).subscribe({
        next: () => {
          this.procesandoId = null;
          this.toastr.info('Pago revertido');
          this.pagosSeleccionados = this.pagosSeleccionados.filter((id) => id !== p.id);
          this.cargar();
          this.recargarDetalle(idComision);
        },
        error: (err) => {
          this.procesandoId = null;
          this.toastr.error(err?.error?.mensaje || 'No se pudo revertir el pago', 'Error');
        }
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  hoy(): string {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'PAGADA':
        return 'badge-activo';
      case 'PAGADA_PARCIAL':
        return 'badge-info';
      default:
        return 'badge-warning';
    }
  }

  etiquetaEstado(estado: string): string {
    switch (estado) {
      case 'PAGADA':
        return 'Pagada';
      case 'PAGADA_PARCIAL':
        return 'Pagada parcial';
      default:
        return 'Pendiente';
    }
  }

  etiquetaTipoPago(p: PagoComision): string {
    switch (p.tipo) {
      case 'ANTICIPO':
        return 'Anticipo';
      case 'TOTAL':
        return 'Total';
      default:
        return p.numeroCuota != null ? `Cuota #${p.numeroCuota}` : 'Cuota';
    }
  }
}
