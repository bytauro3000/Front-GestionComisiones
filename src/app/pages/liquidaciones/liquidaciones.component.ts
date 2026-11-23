import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  LiquidacionSocioService,
  SaldoSocio,
  LiquidacionResumen,
  LiquidacionSocio
} from '../../services/liquidacion-socio.service';
import { CurrencyFormatterDirective } from '../../directives/currency-formatter';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-liquidaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyFormatterDirective],
  templateUrl: './liquidaciones.component.html',
  styleUrl: './liquidaciones.component.scss'
})
export class LiquidacionesComponent implements OnInit {

  saldos: SaldoSocio[] = [];
  liquidaciones: LiquidacionSocio[] = [];
  cargando = false;
  cargandoHistorial = false;
  procesandoId: number | null = null;

  modalAbierto = false;
  guardando = false;
  cargandoSugerencia = false;
  sugerencia: LiquidacionResumen | null = null;

  form = this.formVacio();

  constructor(
    private liquidacionService: LiquidacionSocioService,
    private alert: AlertService
  ) { }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.liquidacionService.saldos().subscribe({
      next: (data) => {
        this.saldos = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.alert.toastError('Error al cargar los saldos de socios', 'Error');
      }
    });
    this.cargarHistorial();
  }

  cargarHistorial(): void {
    this.cargandoHistorial = true;
    this.liquidacionService.listar().subscribe({
      next: (data) => {
        this.liquidaciones = data;
        this.cargandoHistorial = false;
      },
      error: () => {
        this.cargandoHistorial = false;
      }
    });
  }

  get neto(): number {
    const bruto = this.form.montoBruto || 0;
    const igv = this.form.descuentoIgv || 0;
    const detraccion = this.form.descuentoDetraccion || 0;
    return Math.round((bruto - igv - detraccion) * 100) / 100;
  }

  abrirLiquidar(s: SaldoSocio): void {
    this.form = {
      idSocio: s.idSocio,
      socioNombre: s.socioNombre,
      fecha: this.hoy(),
      montoBruto: s.montoPendiente > 0 ? s.montoPendiente : 0,
      descuentoIgv: 0,
      descuentoDetraccion: 0,
      referencia: '',
      notas: ''
    };
    this.sugerencia = null;
    this.modalAbierto = true;
    this.cargandoSugerencia = true;
    this.liquidacionService.sugerir(s.idSocio).subscribe({
      next: (r) => {
        this.sugerencia = r;
        if (r.montoPendiente > 0) {
          this.form.montoBruto = r.montoPendiente;
        }
        this.form.descuentoIgv = r.descuentoIgv;
        this.form.descuentoDetraccion = r.descuentoDetraccion;
        this.cargandoSugerencia = false;
      },
      error: () => {
        this.cargandoSugerencia = false;
        this.alert.toastWarning('No se pudo calcular la sugerencia; puede ingresar los montos a mano');
      }
    });
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  guardar(): void {
    if (this.guardando) return;
    if (!this.form.idSocio) {
      this.alert.toastWarning('Seleccione un socio');
      return;
    }
    if ((this.form.montoBruto || 0) < 0) {
      this.alert.toastWarning('El monto bruto no puede ser negativo');
      return;
    }
    if (this.neto < 0) {
      this.alert.toastWarning('Los descuentos superan el monto bruto');
      return;
    }

    const dto: LiquidacionSocio = {
      idSocio: this.form.idSocio,
      fecha: this.form.fecha,
      montoBruto: this.form.montoBruto || 0,
      descuentoIgv: this.form.descuentoIgv || 0,
      descuentoDetraccion: this.form.descuentoDetraccion || 0,
      referencia: this.form.referencia?.trim() || undefined,
      notas: this.form.notas?.trim() || undefined
    };

    this.guardando = true;
    this.liquidacionService.crear(dto).subscribe({
      next: () => {
        this.guardando = false;
        this.modalAbierto = false;
        this.alert.success('Liquidación registrada');
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.alert.toastError(err?.error?.mensaje || 'No se pudo registrar la liquidación', 'Error');
      }
    });
  }

  eliminar(l: LiquidacionSocio): void {
    Swal.fire({
      title: 'Eliminar liquidación',
      html: `¿Eliminar la liquidación de <strong>${l.socioNombre || 'socio'}</strong> por <strong>${this.moneda(l.montoNeto || 0)}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = l.id ?? null;
      this.liquidacionService.eliminar(l.id!).subscribe({
        next: () => {
          this.procesandoId = null;
          this.alert.success('Liquidación eliminada');
          this.cargar();
        },
        error: (err) => {
          this.procesandoId = null;
          this.alert.toastError(err?.error?.mensaje || 'No se pudo eliminar', 'Error');
        }
      });
    });
  }

  moneda(v: number): string {
    return '$ ' + new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(v || 0);
  }

  hoy(): string {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  private formVacio() {
    return {
      idSocio: 0,
      socioNombre: '',
      fecha: this.hoy(),
      montoBruto: 0,
      descuentoIgv: 0,
      descuentoDetraccion: 0,
      referencia: '',
      notas: ''
    };
  }
}
