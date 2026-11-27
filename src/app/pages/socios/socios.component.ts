import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { SocioService, Socio } from '../../services/socio.service';
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
  form: Socio = this.formVacio();

  constructor(
    private socioService: SocioService,
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
    this.form = { ...socio, activo: socio.activo !== false };
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
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
      documento: '',
      telefono: '',
      activo: true
    };
  }
}
