import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Title } from '@angular/platform-browser';
import { RegistroService, RegistroPublico } from '../../auth/registro.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.scss'
})
export class RegistroComponent {

  form: RegistroPublico = {
    nombres: '',
    apellidos: '',
    correo: '',
    contrasena: '',
    telefono: '',
    dni: ''
  };
  telefonos: string[] = [''];
  confirmarContrasena = '';
  verContrasena = false;
  cargando = false;
  correoDuplicado = false;

  constructor(
    private registroService: RegistroService,
    private router: Router,
    private alert: AlertService,
    private toastr: ToastrService,
    private titleService: Title
  ) {
    this.titleService.setTitle('Crear cuenta | Vende Lote');
  }

  agregarTelefono(): void {
    if (this.telefonos.length >= 9) {
      this.toastr.info('Puedes registrar hasta 9 celulares');
      return;
    }
    this.telefonos.push('');
  }

  quitarTelefono(indice: number): void {
    this.telefonos.splice(indice, 1);
    if (!this.telefonos.length) this.telefonos.push('');
  }

  onRegistrar(): void {
    if (this.cargando) return;

    if (!this.form.nombres.trim() || !this.form.apellidos.trim() || !this.form.correo.trim()) {
      this.toastr.warning('Nombres, apellidos y correo son obligatorios');
      return;
    }
    if (this.form.contrasena.length < 8) {
      this.toastr.warning('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (this.form.contrasena !== this.confirmarContrasena) {
      this.toastr.warning('Las contraseñas no coinciden');
      return;
    }
    if (this.form.dni && !/^\d{8}$/.test(this.form.dni)) {
      this.toastr.warning('El DNI debe tener 8 dígitos');
      return;
    }

    this.cargando = true;
    this.correoDuplicado = false;
    const tels = this.telefonos.map(t => t.trim()).filter(Boolean);
    const dto: RegistroPublico = {
      ...this.form,
      telefono: tels.join(',') || undefined,
      dni: this.form.dni?.trim() || undefined
    };

    this.registroService.registrar(dto).subscribe({
      next: (res) => {
        this.cargando = false;
        this.alert.success(res.mensaje || 'Cuenta creada. Debe ser aprobada por un administrador.',
          'Registro exitoso');
        setTimeout(() => this.router.navigate(['/login']), 1400);
      },
      error: (err) => {
        this.cargando = false;
        const mensaje = err?.error?.mensaje || 'No se pudo crear la cuenta';
        if (mensaje.toLowerCase().includes('correo') && mensaje.toLowerCase().includes('registrado')) {
          this.correoDuplicado = true;
        }
        this.toastr.error(mensaje, 'Error en el registro');
      }
    });
  }
}
