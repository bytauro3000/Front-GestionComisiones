import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { RegistroService, RegistroPublico } from '../../auth/registro.service';
import { DeclectaService } from '../../services/decolecta.service';
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
    dni: '',
    tipoDocumento: 'DNI',
    numDocumento: ''
  };
  telefonos: string[] = [''];
  confirmarContrasena = '';
  verContrasena = false;
  cargando = false;
  buscandoDocumento = false;
  correoDuplicado = false;

  constructor(
    private registroService: RegistroService,
    private decolectaService: DeclectaService,
    private router: Router,
    private alert: AlertService,
    private titleService: Title
  ) {
    this.titleService.setTitle('Crear cuenta | Closure');
  }

  agregarTelefono(): void {
    if (this.telefonos.length >= 9) {
      this.alert.toastInfo('Puedes registrar hasta 9 celulares');
      return;
    }
    this.telefonos.push('');
  }

  quitarTelefono(indice: number): void {
    this.telefonos.splice(indice, 1);
    if (!this.telefonos.length) this.telefonos.push('');
  }

  buscarDocumento(): void {
    if (this.buscandoDocumento) return;
    const tipo = this.form.tipoDocumento || 'DNI';
    const numero = (this.form.numDocumento || '').trim();

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

  onRegistrar(): void {
    if (this.cargando) return;

    if (!this.form.nombres.trim() || !this.form.apellidos.trim() || !this.form.correo.trim()) {
      this.alert.toastWarning('Nombres, apellidos y correo son obligatorios');
      return;
    }
    if (this.form.contrasena.length < 8) {
      this.alert.toastWarning('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (this.form.contrasena !== this.confirmarContrasena) {
      this.alert.toastWarning('Las contraseñas no coinciden');
      return;
    }
    const tipo = this.form.tipoDocumento || 'DNI';
    const numero = (this.form.numDocumento || '').trim();
    if (tipo === 'DNI' && numero && !/^\d{8}$/.test(numero)) {
      this.alert.toastWarning('El DNI debe tener 8 dígitos');
      return;
    }
    if (tipo === 'RUC' && numero && !/^\d{11}$/.test(numero)) {
      this.alert.toastWarning('El RUC debe tener 11 dígitos');
      return;
    }

    this.cargando = true;
    this.correoDuplicado = false;
    const tels = this.telefonos.map(t => t.trim()).filter(Boolean);
    const dto: RegistroPublico = {
      ...this.form,
      telefono: tels.join(',') || undefined,
      dni: tipo === 'DNI' ? (numero || undefined) : undefined,
      tipoDocumento: tipo,
      numDocumento: numero || undefined
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
        this.alert.toastError(mensaje, 'Error en el registro');
      }
    });
  }
}
