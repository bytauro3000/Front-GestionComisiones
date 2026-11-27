import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { Asociado, AsociadoCrear, AsociadoService } from '../../services/asociado.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-asociados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asociados.component.html',
  styleUrl: './asociados.component.scss'
})
export class AsociadosComponent implements OnInit {
  asociados: Asociado[] = [];
  cargando = false;
  modalAbierto = false;
  guardando = false;
  form: AsociadoCrear = this.formVacio();

  constructor(
    private asociadoService: AsociadoService,
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
    this.asociadoService.listar().subscribe({
      next: (data) => {
        this.asociados = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.alert.toastError('No se pudieron cargar los vendedores asociados', 'Error');
      }
    });
  }

  abrirCrear(): void {
    this.form = this.formVacio();
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  guardar(): void {
    if (!this.form.nombres.trim() || !this.form.apellidos.trim()
        || !this.form.correo.trim() || !this.form.contrasena.trim()) {
      this.alert.toastWarning('Completa nombres, apellidos, correo y contraseña');
      return;
    }

    this.guardando = true;
    this.asociadoService.crear({
      ...this.form,
      nombres: this.form.nombres.trim(),
      apellidos: this.form.apellidos.trim(),
      correo: this.form.correo.trim().toLowerCase(),
      contrasena: this.form.contrasena.trim()
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.modalAbierto = false;
        this.alert.success('Vendedor asociado creado');
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.alert.toastError(err?.error?.mensaje || 'No se pudo crear el asociado', 'Error');
      }
    });
  }

  async cambiarEstado(asociado: Asociado): Promise<void> {
    const nuevo = asociado.estado?.toLowerCase() === 'activo' ? 'inactivo' : 'activo';
    const confirm = await Swal.fire({
      icon: 'question',
      title: `${nuevo === 'activo' ? 'Activar' : 'Desactivar'} asociado`,
      text: `${asociado.nombres} ${asociado.apellidos}`,
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirm.isConfirmed) return;

    this.asociadoService.cambiarEstado(asociado.id, nuevo).subscribe({
      next: (actualizado) => {
        this.asociados = this.asociados.map(a => a.id === actualizado.id ? actualizado : a);
        this.alert.success(`Asociado ${nuevo}`);
      },
      error: (err) => this.alert.toastError(err?.error?.mensaje || 'No se pudo cambiar el estado', 'Error')
    });
  }

  async resetPassword(asociado: Asociado): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Restablecer contraseña',
      input: 'password',
      inputLabel: `Nueva contraseña para ${asociado.nombres}`,
      inputAttributes: { minlength: '8', autocapitalize: 'off', autocorrect: 'off' },
      showCancelButton: true,
      confirmButtonText: 'Restablecer',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => !value || value.length < 8
        ? 'La contraseña debe tener al menos 8 caracteres' : undefined
    });
    if (!result.isConfirmed || !result.value) return;

    this.asociadoService.resetPassword(asociado.id, result.value).subscribe({
      next: () => this.alert.success('Contraseña restablecida'),
      error: (err) => this.alert.toastError(err?.error?.mensaje || 'No se pudo restablecer', 'Error')
    });
  }

  private formVacio(): AsociadoCrear {
    return {
      nombres: '',
      apellidos: '',
      correo: '',
      contrasena: '',
      telefono: '',
      dni: ''
    };
  }
}
