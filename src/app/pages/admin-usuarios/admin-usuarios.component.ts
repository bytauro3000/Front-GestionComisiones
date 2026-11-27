import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { jwtDecode } from 'jwt-decode';
import { UsuarioService, UsuarioListado, UsuarioRegistro } from '../../services/usuario.service';
import { TokenService } from '../../auth/token.service';
import { DeclectaService } from '../../services/decolecta.service';
import { AlertService } from '../../services/alert.service';

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-usuarios.component.html',
  styleUrl: './admin-usuarios.component.scss'
})
export class AdminUsuariosComponent implements OnInit {

  usuarios: UsuarioListado[] = [];
  cargando = false;
  terminoBusqueda = '';
  filtroEstado: '' | 'pendiente' | 'activo' | 'inactivo' = '';
  procesandoId: number | null = null;

  // Modal crear/editar
  modalAbierto = false;
  modoEdicion = false;
  usuarioEditando: UsuarioListado | null = null;
  guardando = false;
  buscandoDocumento = false;
  form: UsuarioRegistro = this.formVacio();
  telefonos: string[] = [''];

  // Modal reset password
  resetAbierto = false;
  resetUsuario: UsuarioListado | null = null;
  nuevaContrasena = '';
  confirmandoReset = false;

  readonly rolActual: string | null;

  constructor(
    private usuarioService: UsuarioService,
    private decolectaService: DeclectaService,
    private alert: AlertService,
    tokenService: TokenService
  ) {
    this.rolActual = tokenService.getRole();
  }

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  @HostListener('window:app:data-changed')
  onRealtimeChange(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.cargando = true;
    this.usuarioService.listar().subscribe({
      next: (data) => {
        this.usuarios = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.alert.toastError('Error al cargar los usuarios', 'Error');
      }
    });
  }

  get usuariosFiltrados(): UsuarioListado[] {
    let lista = this.usuarios;
    if (this.filtroEstado) {
      lista = lista.filter(u => u.estado === this.filtroEstado);
    }
    if (!this.terminoBusqueda.trim()) return lista;
    const t = this.terminoBusqueda.toLowerCase();
    return lista.filter(u =>
      u.nombres.toLowerCase().includes(t) ||
      u.apellidos.toLowerCase().includes(t) ||
      u.correo.toLowerCase().includes(t)
    );
  }

  contarPorEstado(estado: string): number {
    return this.usuarios.filter(u => u.estado === estado).length;
  }

  // ── Aprobación de auto-registros ──────────────────────────────────────────

  aprobar(usuario: UsuarioListado): void {
    Swal.fire({
      title: 'Aprobar cuenta',
      html: `¿Aprobar la cuenta de <strong>${usuario.correo}</strong>?<br><small>Podrá iniciar sesión inmediatamente.</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, aprobar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = usuario.id;
      this.usuarioService.aprobar(usuario.id).subscribe({
        next: () => {
          this.procesandoId = null;
          this.alert.success('Cuenta aprobada: ' + usuario.correo);
          this.cargarUsuarios();
        },
        error: (err) => {
          this.procesandoId = null;
          this.alert.toastError(err?.error?.mensaje || 'No se pudo aprobar la cuenta', 'Error');
        }
      });
    });
  }

  rechazar(usuario: UsuarioListado): void {
    Swal.fire({
      title: 'Rechazar cuenta',
      html: `¿Rechazar la cuenta de <strong>${usuario.correo}</strong>?<br><small>No podrá iniciar sesión.</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, rechazar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = usuario.id;
      this.usuarioService.rechazar(usuario.id).subscribe({
        next: () => {
          this.procesandoId = null;
          this.alert.success('Cuenta rechazada: ' + usuario.correo);
          this.cargarUsuarios();
        },
        error: (err) => {
          this.procesandoId = null;
          this.alert.toastError(err?.error?.mensaje || 'No se pudo rechazar la cuenta', 'Error');
        }
      });
    });
  }

  // ── Crear / Editar ────────────────────────────────────────────────────────

  abrirCrear(): void {
    this.modoEdicion = false;
    this.usuarioEditando = null;
    this.form = this.formVacio();
    this.telefonos = [''];
    this.modalAbierto = true;
  }

  abrirEditar(usuario: UsuarioListado): void {
    this.modoEdicion = true;
    this.usuarioEditando = usuario;
    this.form = {
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      contrasena: '',
      telefono: usuario.telefono || '',
      dni: usuario.dni || '',
      tipoDocumento: usuario.tipoDocumento || 'DNI',
      numDocumento: usuario.numDocumento || usuario.dni || '',
      rol: usuario.rol,
      estado: usuario.estado
    };
    this.telefonos = this.parseTelefonos(usuario.telefono);
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  // ── Celulares múltiples ─────────────────────────────────────────────────

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

  listaTelefonos(valor?: string): string[] {
    return (valor || '').split(',').map(t => t.trim()).filter(Boolean);
  }

  private parseTelefonos(valor?: string): string[] {
    const lista = this.listaTelefonos(valor);
    return lista.length ? lista : [''];
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

  async guardar(): Promise<void> {
    if (this.guardando) return;

    if (!this.form.nombres.trim() || !this.form.apellidos.trim() || !this.form.correo.trim()) {
      this.alert.toastWarning('Nombres, apellidos y correo son obligatorios');
      return;
    }
    if (!this.modoEdicion && (!this.form.contrasena || this.form.contrasena.length < 8)) {
      this.alert.toastWarning('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (this.modoEdicion && this.form.contrasena && this.form.contrasena.length < 8) {
      this.alert.toastWarning('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    this.form.telefono = this.telefonos.map(t => t.trim()).filter(Boolean).join(',');

    if (this.modoEdicion) {
      const ok = await this.alert.confirmarEdicion(
        `¿Guardar los cambios de <strong>${this.form.correo}</strong>?`);
      if (!ok) return;
    }

    this.guardando = true;
    const peticion = this.modoEdicion && this.usuarioEditando
      ? this.usuarioService.editar(this.usuarioEditando.id, this.form)
      : this.usuarioService.crear(this.form);

    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.modalAbierto = false;
        this.alert.success(this.modoEdicion ? 'Usuario actualizado' : 'Usuario creado');
        this.cargarUsuarios();
      },
      error: (err) => {
        this.guardando = false;
        this.alert.toastError(err?.error?.mensaje || 'No se pudo guardar el usuario', 'Error');
      }
    });
  }

  // ── Cambiar estado ────────────────────────────────────────────────────────

  cambiarEstado(usuario: UsuarioListado): void {
    const activando = usuario.estado === 'inactivo';
    const texto = activando
      ? `¿Activar a <strong>${usuario.correo}</strong>?`
      : `¿Desactivar a <strong>${usuario.correo}</strong>?<br><small>Su sesión se cerrará y no podrá iniciar sesión.</small>`;

    Swal.fire({
      title: activando ? 'Activar usuario' : 'Desactivar usuario',
      html: texto,
      icon: activando ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: activando ? 'Sí, activar' : 'Sí, desactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: activando ? '#10b981' : '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.usuarioService.cambiarEstado(usuario.id).subscribe({
        next: () => {
          this.alert.success(activando ? 'Usuario activado' : 'Usuario desactivado');
          this.cargarUsuarios();
        },
        error: (err) => {
          this.alert.toastError(err?.error?.mensaje || 'No se pudo cambiar el estado', 'Error');
        }
      });
    });
  }

  // ── Reset de contraseña ──────────────────────────────────────────────────

  abrirReset(usuario: UsuarioListado): void {
    this.resetUsuario = usuario;
    this.nuevaContrasena = '';
    this.resetAbierto = true;
  }

  cerrarReset(): void {
    this.resetAbierto = false;
    this.resetUsuario = null;
  }

  confirmarReset(): void {
    if (!this.resetUsuario || this.confirmandoReset) return;
    if (this.nuevaContrasena.length < 8) {
      this.alert.toastWarning('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    this.confirmandoReset = true;
    this.usuarioService.resetPassword(this.resetUsuario.id, this.nuevaContrasena).subscribe({
      next: (res) => {
        this.confirmandoReset = false;
        this.cerrarReset();
        this.alert.success(res.mensaje || 'Contraseña restablecida');
      },
      error: (err) => {
        this.confirmandoReset = false;
        this.alert.toastError(err?.error?.mensaje || 'No se pudo restablecer la contraseña', 'Error');
      }
    });
  }

  // ── Eliminar (en cascada) ─────────────────────────────────────────────────

  eliminar(usuario: UsuarioListado): void {
    if (this.esPropio(usuario)) {
      this.alert.toastWarning('No puede eliminar su propia cuenta');
      return;
    }

    Swal.fire({
      title: 'Eliminar usuario',
      html: `
        <p>Se eliminará <strong>${usuario.correo}</strong> y <strong>todos sus datos</strong>:</p>
        <ul style="text-align:left;margin:8px 0 0 18px">
          <li>Empresas, proyectos y lotes</li>
          <li>Ventas, comisiones y pagos</li>
          <li>Comprobantes y proformas</li>
          <li>Clientes, parámetros y sesiones</li>
        </ul>
        <small>Esta operación no se puede deshacer.</small>`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar todo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = usuario.id;
      this.usuarioService.eliminar(usuario.id).subscribe({
        next: (res) => {
          this.procesandoId = null;
          this.alert.success(res?.mensaje || 'Usuario eliminado');
          this.cargarUsuarios();
        },
        error: (err) => {
          this.procesandoId = null;
          this.alert.toastError(err?.error?.mensaje || 'No se pudo eliminar el usuario', 'Error');
        }
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  esPropio(usuario: UsuarioListado): boolean {
    const token = localStorage.getItem('jwtToken');
    if (!token) return false;
    try {
      const decoded: any = jwtDecode(token);
      return decoded.id === usuario.id;
    } catch {
      return false;
    }
  }

  private formVacio(): UsuarioRegistro {
    return {
      nombres: '',
      apellidos: '',
      correo: '',
      contrasena: '',
      telefono: '',
      dni: '',
      tipoDocumento: 'DNI',
      numDocumento: '',
      rol: 'VENDEDOR',
      estado: 'activo'
    };
  }
}
