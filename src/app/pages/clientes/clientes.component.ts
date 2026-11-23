import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';
import { ClienteService, Cliente } from '../../services/cliente.service';
import { DeclectaService } from '../../services/decolecta.service';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clientes.component.html',
  styleUrl: './clientes.component.scss'
})
export class ClientesComponent implements OnInit {

  clientes: Cliente[] = [];
  cargando = false;
  terminoBusqueda = '';
  procesandoId: number | null = null;

  // Modal crear/editar
  modalAbierto = false;
  modoEdicion = false;
  clienteEditando: Cliente | null = null;
  guardando = false;
  form: Cliente = this.formVacio();
  telefonos: string[] = [''];

  // Consulta Declecta
  buscando = false;

  constructor(
    private clienteService: ClienteService,
    private decolectaService: DeclectaService,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.cargarClientes();
  }

  cargarClientes(): void {
    this.cargando = true;
    this.clienteService.listar().subscribe({
      next: (data) => {
        this.clientes = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.toastr.error('Error al cargar los clientes', 'Error');
      }
    });
  }

  get xFiltrados(): Cliente[] {
    if (!this.terminoBusqueda.trim()) return this.clientes;
    const t = this.terminoBusqueda.toLowerCase();
    return this.clientes.filter(c =>
      (c.numDocumento || '').toLowerCase().includes(t) ||
      (c.nombres || '').toLowerCase().includes(t) ||
      (c.apellidos || '').toLowerCase().includes(t) ||
      (c.correo || '').toLowerCase().includes(t)
    );
  }

  // ── Crear / Editar ────────────────────────────────────────────────────────

  abrirCrear(): void {
    this.modoEdicion = false;
    this.clienteEditando = null;
    this.form = this.formVacio();
    this.telefonos = [''];
    this.modalAbierto = true;
  }

  abrirEditar(cliente: Cliente): void {
    this.modoEdicion = true;
    this.clienteEditando = cliente;
    this.form = { ...cliente, tipoDocumento: cliente.tipoDocumento || 'DNI' };
    this.telefonos = this.parseTelefonos(cliente.telefono);
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  guardar(): void {
    if (this.guardando) return;

    if (!this.form.numDocumento || !this.form.numDocumento.trim()) {
      this.toastr.warning('El número de documento es obligatorio');
      return;
    }
    if (!this.form.nombres || !this.form.nombres.trim()) {
      this.toastr.warning('Los nombres son obligatorios');
      return;
    }

    this.form.telefono = this.telefonos.map(t => t.trim()).filter(Boolean).join(',');

    this.guardando = true;
    const peticion = this.modoEdicion && this.clienteEditando
      ? this.clienteService.editar(this.clienteEditando.id!, this.form)
      : this.clienteService.crear(this.form);

    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.modalAbierto = false;
        this.toastr.success(this.modoEdicion ? 'Cliente actualizado' : 'Cliente creado');
        this.cargarClientes();
      },
      error: (err) => {
        this.guardando = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudo guardar el cliente', 'Error');
      }
    });
  }

  // ── Celulares múltiples ─────────────────────────────────────────────────

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

  listaTelefonos(valor?: string): string[] {
    return (valor || '').split(',').map(t => t.trim()).filter(Boolean);
  }

  private parseTelefonos(valor?: string): string[] {
    const lista = this.listaTelefonos(valor);
    return lista.length ? lista : [''];
  }

  // ── Consulta Declecta (RENIEC / SUNAT) ────────────────────────────────────

  buscarDocumento(): void {
    if (this.buscando) return;

    const tipo = this.form.tipoDocumento || 'DNI';
    const numero = (this.form.numDocumento || '').trim();

    if (tipo === 'DNI') {
      if (!/^\d{8}$/.test(numero)) {
        this.toastr.warning('El DNI debe tener exactamente 8 dígitos');
        return;
      }
      this.buscando = true;
      this.decolectaService.dni(numero).subscribe({
        next: (data) => {
          this.buscando = false;
          if (data.first_name) this.form.nombres = data.first_name;
          if (data.first_last_name) {
            this.form.apellidos = data.second_last_name
              ? `${data.first_last_name} ${data.second_last_name}`
              : data.first_last_name;
          }
          this.toastr.success('Datos completados desde RENIEC');
        },
        error: () => {
          this.buscando = false;
          this.toastr.warning('No se encontró información para ese documento');
        }
      });
      return;
    }

    if (tipo === 'RUC') {
      if (!/^\d{11}$/.test(numero)) {
        this.toastr.warning('El RUC debe tener exactamente 11 dígitos');
        return;
      }
      this.buscando = true;
      this.decolectaService.ruc(numero).subscribe({
        next: (data) => {
          this.buscando = false;
          if (data.razon_social) this.form.nombres = data.razon_social;
          if (data.direccion) this.form.direccion = data.direccion;
          this.toastr.success('Datos completados desde SUNAT');
        },
        error: () => {
          this.buscando = false;
          this.toastr.warning('No se encontró información para ese documento');
        }
      });
      return;
    }

    this.toastr.warning('La consulta solo está disponible para DNI o RUC');
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  eliminar(cliente: Cliente): void {
    Swal.fire({
      title: 'Eliminar cliente',
      html: `¿Eliminar a <strong>${cliente.nombres} ${cliente.apellidos || ''}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = cliente.id ?? null;
      this.clienteService.eliminar(cliente.id!).subscribe({
        next: () => {
          this.procesandoId = null;
          this.toastr.success('Cliente eliminado');
          this.cargarClientes();
        },
        error: (err) => {
          this.procesandoId = null;
          this.toastr.error(err?.error?.mensaje || 'No se pudo eliminar el cliente', 'Error');
        }
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private formVacio(): Cliente {
    return {
      tipoDocumento: 'DNI',
      numDocumento: '',
      nombres: '',
      apellidos: '',
      telefono: '',
      correo: '',
      direccion: ''
    };
  }
}
