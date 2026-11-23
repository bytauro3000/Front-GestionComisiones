import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import {
  ParametroComisionService,
  ParametroComision
} from '../../services/parametro-comision.service';
import { EmpresaService, Empresa } from '../../services/empresa.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-parametros-comision',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parametros-comision.component.html',
  styleUrl: './parametros-comision.component.scss'
})
export class ParametrosComisionComponent implements OnInit {

  parametros: ParametroComision[] = [];
  empresas: Empresa[] = [];
  cargando = false;
  procesandoId: number | null = null;

  modalAbierto = false;
  modoEdicion = false;
  editando: ParametroComision | null = null;
  guardando = false;
  form: ParametroComision = this.formVacio();

  constructor(
    private parametroService: ParametroComisionService,
    private empresaService: EmpresaService,
    private alert: AlertService
  ) { }

  ngOnInit(): void {
    this.cargar();
    this.cargarEmpresas();
  }

  cargar(): void {
    this.cargando = true;
    this.parametroService.listar().subscribe({
      next: (data) => {
        this.parametros = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.alert.toastError('Error al cargar los parámetros de comisión', 'Error');
      }
    });
  }

  cargarEmpresas(): void {
    this.empresaService.listar().subscribe({
      next: (data) => (this.empresas = data),
      error: () => this.alert.toastError('Error al cargar las empresas', 'Error')
    });
  }

  nombreEmpresa(id?: number | null): string {
    if (id == null) return 'GENERAL';
    const emp = this.empresas.find((e) => e.id === id);
    return emp?.nombreComercial?.trim() || emp?.razonSocial || `Empresa #${id}`;
  }

  // ── Crear / Editar ────────────────────────────────────────────────────────

  abrirCrear(): void {
    this.modoEdicion = false;
    this.editando = null;
    this.form = this.formVacio();
    this.modalAbierto = true;
  }

  abrirEditar(p: ParametroComision): void {
    this.modoEdicion = true;
    this.editando = p;
    this.form = {
      ...p,
      idEmpresa: p.idEmpresa ?? null,
      anticipoMontoFijo: p.anticipoMontoFijo ?? null,
      fechaInicioVigencia: p.fechaInicioVigencia ? p.fechaInicioVigencia.substring(0, 10) : null,
      fechaFinVigencia: p.fechaFinVigencia ? p.fechaFinVigencia.substring(0, 10) : null
    };
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.editando = null;
  }

  async guardar(): Promise<void> {
    if (this.guardando) return;

    const f = this.form;
    const pcContado = this.num(f.porcentajeComisionContado);
    const pcFinanciado = this.num(f.porcentajeComision);
    const pcAnticipo = this.num(f.anticipoPorcentaje);
    const cuota = this.num(f.montoCuota);
    const meses = this.num(f.mesesEspera);

    if (pcContado == null || pcContado < 0 || pcContado > 1) {
      this.alert.toastWarning('El % de comisión contado debe estar entre 0 y 1 (use 0.03 = 3%)');
      return;
    }
    if (pcFinanciado == null || pcFinanciado < 0 || pcFinanciado > 1) {
      this.alert.toastWarning('El % de comisión financiado debe estar entre 0 y 1 (use 0.03 = 3%)');
      return;
    }
    if (pcAnticipo == null || pcAnticipo < 0 || pcAnticipo > 1) {
      this.alert.toastWarning('El % de anticipo debe estar entre 0 y 1 (use 0.20 = 20%)');
      return;
    }
    if (cuota == null || cuota < 0) {
      this.alert.toastWarning('La cuota debe ser 0 o un monto mayor');
      return;
    }
    if (meses == null || meses < 0) {
      this.alert.toastWarning('Los meses de espera deben ser 0 o más');
      return;
    }

    let anticipoFijo: number | null = null;
    if (f.anticipoMontoFijo != null) {
      anticipoFijo = this.num(f.anticipoMontoFijo);
      if (anticipoFijo == null || anticipoFijo < 0) {
        this.alert.toastWarning('El anticipo fijo debe ser 0 o un monto mayor');
        return;
      }
    }

    if (f.fechaInicioVigencia && f.fechaFinVigencia && f.fechaFinVigencia < f.fechaInicioVigencia) {
      this.alert.toastWarning('La fecha fin de vigencia debe ser mayor o igual a la fecha de inicio');
      return;
    }

    const dto: ParametroComision = {
      idEmpresa: f.idEmpresa ?? null,
      porcentajeComision: pcFinanciado,
      porcentajeComisionContado: pcContado,
      anticipoPorcentaje: pcAnticipo,
      anticipoMontoFijo: anticipoFijo,
      montoCuota: cuota,
      mesesEspera: meses,
      fechaInicioVigencia: f.fechaInicioVigencia || null,
      fechaFinVigencia: f.fechaFinVigencia || null
    };

    if (this.modoEdicion) {
      const idEdit = this.editando?.id;
      if (idEdit == null) return;
      const ok = await this.alert.confirmarEdicion('¿Guardar los cambios del parámetro de comisión?');
      if (!ok) return;
      this.guardando = true;
      this.parametroService.editar(idEdit, dto).subscribe({
        next: () => {
          this.guardando = false;
          this.cerrarModal();
          this.alert.success('Parámetro actualizado');
          this.cargar();
        },
        error: (err) => {
          this.guardando = false;
          this.alert.toastError(err?.error?.mensaje || 'No se pudo actualizar el parámetro', 'Error');
        }
      });
    } else {
      this.guardando = true;
      this.parametroService.crear(dto).subscribe({
        next: () => {
          this.guardando = false;
          this.cerrarModal();
          this.alert.success('Parámetro de comisión creado');
          this.cargar();
        },
        error: (err) => {
          this.guardando = false;
          this.alert.toastError(err?.error?.mensaje || 'No se pudo crear el parámetro', 'Error');
        }
      });
    }
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  eliminar(p: ParametroComision): void {
    if (p.id == null) return;
    const alcance = p.idEmpresa == null ? 'GENERAL' : this.nombreEmpresa(p.idEmpresa);

    Swal.fire({
      title: 'Eliminar parámetro',
      html: `¿Eliminar el parámetro de comisión de <strong>${alcance}</strong>?<br><small>Esta acción no se puede deshacer.</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = p.id!;
      this.parametroService.eliminar(p.id!).subscribe({
        next: () => {
          this.procesandoId = null;
          this.alert.success('Parámetro eliminado');
          this.cargar();
        },
        error: (err) => {
          this.procesandoId = null;
          this.alert.toastError(err?.error?.mensaje || 'No se pudo eliminar el parámetro', 'Error');
        }
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private num(valor: unknown): number | null {
    return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
  }

  private formVacio(): ParametroComision {
    return {
      idEmpresa: null,
      porcentajeComision: 0,
      porcentajeComisionContado: 0,
      anticipoPorcentaje: 0,
      anticipoMontoFijo: null,
      montoCuota: 0,
      mesesEspera: 0,
      fechaInicioVigencia: null,
      fechaFinVigencia: null
    };
  }
}
