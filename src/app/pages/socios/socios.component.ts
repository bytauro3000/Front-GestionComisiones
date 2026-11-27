import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { SocioService, Socio } from '../../services/socio.service';
import { DeclectaService } from '../../services/decolecta.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-socios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './socios.component.html',
  styleUrl: './socios.component.scss'
})
export class SociosComponent implements OnInit {

  socios: Socio[] = [];
  cargando = false;
  terminoBusqueda = '';
  procesandoId: number | null = null;

  modalAbierto = false;
  modoEdicion = false;
  socioEditando: Socio | null = null;
  guardando = false;
  buscandoDocumento = false;
  form: Socio = this.formVacio();

  constructor(
    private socioService: SocioService,
    private decolectaService: DeclectaService,
    private alert: AlertService
  ) { }

  ngOnInit(): void {
    this.cargar();
  }

  @HostListener('window:app:data-changed')
  onRealtimeChange(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.socioService.listar().subscribe({
      next: (data) => {
        this.socios = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.alert.toastError('Error al cargar los socios', 'Error');
      }
    });
  }

  get xFiltrados(): Socio[] {
    const t = this.terminoBusqueda.trim().toLowerCase();
    if (!t) return this.socios;
    return this.socios.filter(s =>
      this.nombreCompleto(s).toLowerCase().includes(t) ||
      (s.documento || '').toLowerCase().includes(t) ||
      (s.telefono || '').toLowerCase().includes(t)
    );
  }

  nombreCompleto(s: Socio): string {
    return `${s.nombres || ''} ${s.apellidos || ''}`.trim();
  }

  abrirCrear(): void {
    this.modoEdicion = false;
    this.socioEditando = null;
    this.form = this.formVacio();
    this.modalAbierto = true;
  }

  abrirEditar(socio: Socio): void {
    this.modoEdicion = true;
    this.socioEditando = socio;
    this.form = {
      ...socio,
      tipoDocumento: socio.tipoDocumento || 'DNI',
      activo: socio.activo !== false
    };
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  buscarDocumento(): void {
    if (this.buscandoDocumento) return;
    const tipo = this.form.tipoDocumento || 'DNI';
    const numero = (this.form.documento || '').trim();

    if (tipo === 'DNI') {
      if (!/^\d{8}$/.test(numero)) {
        this.alert.toastWarning('El DNI debe tener exactamente 8 dígitos');
        return;
      }
      this.buscandoDocumento = true;
      this.decolectaService.dni(numero).subscribe({
        next: (data) => {
          this.buscandoDocumento = false;
          if (data.first_name) this.form.nombres = data.first_name;
          const apellidos = [data.first_last_name, data.second_last_name]
            .filter(Boolean).join(' ');
          if (apellidos) this.form.apellidos = apellidos;
          this.alert.toastSuccess('Datos completados desde RENIEC');
        },
        error: () => {
          this.buscandoDocumento = false;
          this.alert.toastWarning('No se encontró información para ese DNI');
        }
      });
      return;
    }

    if (tipo === 'RUC') {
      if (!/^\d{11}$/.test(numero)) {
        this.alert.toastWarning('El RUC debe tener exactamente 11 dígitos');
        return;
      }
      this.buscandoDocumento = true;
      this.decolectaService.ruc(numero).subscribe({
        next: (data) => {
          this.buscandoDocumento = false;
          if (data.razon_social) this.form.nombres = data.razon_social;
          this.alert.toastSuccess('Datos completados desde SUNAT');
        },
        error: () => {
          this.buscandoDocumento = false;
          this.alert.toastWarning('No se encontró información para ese RUC');
        }
      });
      return;
    }

    this.alert.toastInfo('Para CE u otro documento, completa los nombres manualmente');
  }

  async guardar(): Promise<void> {
    if (this.guardando) return;
    if (!this.form.nombres || !this.form.nombres.trim()) {
      this.alert.toastWarning('Los nombres del socio son obligatorios');
      return;
    }
    if (this.modoEdicion) {
      const ok = await this.alert.confirmarEdicion(
        `¿Guardar los cambios de <strong>${this.nombreCompleto(this.form)}</strong>?`);
      if (!ok) return;
    }
    this.guardando = true;
    const peticion = this.modoEdicion && this.socioEditando
      ? this.socioService.editar(this.socioEditando.id!, this.form)
      : this.socioService.crear(this.form);

    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.modalAbierto = false;
        this.alert.success(this.modoEdicion ? 'Socio actualizado' : 'Socio creado');
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.alert.toastError(err?.error?.mensaje || 'No se pudo guardar el socio', 'Error');
      }
    });
  }

  eliminar(socio: Socio): void {
    Swal.fire({
      title: 'Eliminar socio',
      html: `¿Eliminar a <strong>${this.nombreCompleto(socio)}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = socio.id ?? null;
      this.socioService.eliminar(socio.id!).subscribe({
        next: () => {
          this.procesandoId = null;
          this.alert.success('Socio eliminado');
          this.cargar();
        },
        error: (err) => {
          this.procesandoId = null;
          this.alert.toastError(err?.error?.mensaje || 'No se pudo eliminar el socio', 'Error');
        }
      });
    });
  }

  private formVacio(): Socio {
    return {
      nombres: '',
      apellidos: '',
      tipoDocumento: 'DNI',
      documento: '',
      telefono: '',
      activo: true
    };
  }
}
