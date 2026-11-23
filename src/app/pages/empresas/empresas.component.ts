import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';
import { EmpresaService, Empresa, CuentaBancaria } from '../../services/empresa.service';
import { DeclectaService } from '../../services/decolecta.service';

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './empresas.component.html',
  styleUrl: './empresas.component.scss'
})
export class EmpresasComponent implements OnInit {

  empresas: Empresa[] = [];
  cargando = false;
  terminoBusqueda = '';
  procesandoId: number | null = null;

  // Modal crear/editar
  modalAbierto = false;
  modoEdicion = false;
  empresaEditando: Empresa | null = null;
  guardando = false;
  form: Empresa = this.formVacio();
  telefonos: string[] = [''];
  cuentas: CuentaBancaria[] = [this.cuentaVacia()];
  bancos = ['BCP', 'INTERBANK', 'BBVA CONTINENTAL', 'SCOTIABANK', 'BANBIF', 'MIBANCO', 'OTRO'];
  tiposCuenta = [
    { valor: 'SOLES', etiqueta: 'Soles (S/)' },
    { valor: 'DOLARES', etiqueta: 'Dólares (US$)' }
  ];

  // Búsqueda SUNAT
  buscandoRuc = false;

  constructor(
    private empresaService: EmpresaService,
    private decolectaService: DeclectaService,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.cargarEmpresas();
  }

  cargarEmpresas(): void {
    this.cargando = true;
    this.empresaService.listar().subscribe({
      next: (data) => {
        this.empresas = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.toastr.error('Error al cargar las empresas', 'Error');
      }
    });
  }

  get xFiltrados(): Empresa[] {
    if (!this.terminoBusqueda.trim()) return this.empresas;
    const t = this.terminoBusqueda.toLowerCase();
    return this.empresas.filter(e =>
      e.ruc.toLowerCase().includes(t) ||
      e.razonSocial.toLowerCase().includes(t)
    );
  }

  // ── Crear / Editar ────────────────────────────────────────────────────────

  abrirCrear(): void {
    this.modoEdicion = false;
    this.empresaEditando = null;
    this.form = this.formVacio();
    this.telefonos = [''];
    this.cuentas = [this.cuentaVacia()];
    this.modalAbierto = true;
  }

  abrirEditar(empresa: Empresa): void {
    this.modoEdicion = true;
    this.empresaEditando = empresa;
    this.form = { ...empresa };
    this.telefonos = this.parseTelefonos(empresa.telefono);
    this.cuentas = (empresa.cuentas && empresa.cuentas.length)
      ? empresa.cuentas.map(c => ({ ...c }))
      : [this.cuentaVacia()];
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
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

  /** SOLES → "Soles (S/)", DOLARES → "Dólares (US$)". */
  etiquetaTipo(valor?: string): string {
    return this.tiposCuenta.find(t => t.valor === valor)?.etiqueta || valor || '';
  }

  private parseTelefonos(valor?: string): string[] {
    const lista = this.listaTelefonos(valor);
    return lista.length ? lista : [''];
  }

  // ── Cuentas bancarias ────────────────────────────────────────────────────

  agregarCuenta(): void {
    if (this.cuentas.length >= 5) {
      this.toastr.info('Puedes registrar hasta 5 cuentas');
      return;
    }
    this.cuentas.push(this.cuentaVacia());
  }

  quitarCuenta(indice: number): void {
    this.cuentas.splice(indice, 1);
    if (!this.cuentas.length) this.cuentas.push(this.cuentaVacia());
  }

  private cuentaVacia(): CuentaBancaria {
    return { banco: '', tipoCuenta: '', numeroCuenta: '', cci: '' };
  }

  guardar(): void {
    if (this.guardando) return;

    if (!/^\d{11}$/.test(this.form.ruc || '')) {
      this.toastr.warning('El RUC debe tener exactamente 11 dígitos');
      return;
    }
    if (!this.form.razonSocial || !this.form.razonSocial.trim()) {
      this.toastr.warning('La razón social es obligatoria');
      return;
    }

    this.form.telefono = this.telefonos.map(t => t.trim()).filter(Boolean).join(',');

    const cuentasLimpias = this.cuentas
      .map(c => ({
        banco: (c.banco || '').trim(),
        tipoCuenta: (c.tipoCuenta || '').trim(),
        numeroCuenta: (c.numeroCuenta || '').trim(),
        cci: (c.cci || '').trim()
      }))
      .filter(c => c.banco || c.tipoCuenta || c.numeroCuenta || c.cci);

    for (const c of cuentasLimpias) {
      if (!c.banco) {
        this.toastr.warning('Cada cuenta debe indicar el banco (o quítala con ×)', 'Falta el banco');
        return;
      }
      if (!c.tipoCuenta) {
        this.toastr.warning('Cada cuenta debe indicar si es en soles o dólares', 'Falta el tipo de cuenta');
        return;
      }
      if (!c.numeroCuenta) {
        this.toastr.warning('Cada cuenta debe tener número de cuenta (o quítala con ×)', 'Falta el número de cuenta');
        return;
      }
      if (!/^\d{10,25}$/.test(c.numeroCuenta)) {
        this.toastr.warning(
          `Debe tener de 10 a 25 dígitos y solo números (tiene ${c.numeroCuenta.length}): ${c.numeroCuenta}`,
          'Revisa el número de cuenta');
        return;
      }
      if (c.cci && !/^\d{20}$/.test(c.cci)) {
        this.toastr.warning(
          `El CCI debe tener exactamente 20 dígitos (tiene ${c.cci.length}): ${c.cci}`,
          'Revisa el CCI');
        return;
      }
    }
    this.form.cuentas = cuentasLimpias;

    this.guardando = true;
    const peticion = this.modoEdicion && this.empresaEditando
      ? this.empresaService.editar(this.empresaEditando.id!, this.form)
      : this.empresaService.crear(this.form);

    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.modalAbierto = false;
        this.toastr.success(this.modoEdicion ? 'Empresa actualizada' : 'Empresa creada');
        this.cargarEmpresas();
      },
      error: (err) => {
        this.guardando = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudo guardar la empresa', 'Error');
      }
    });
  }

  // ── Búsqueda SUNAT ───────────────────────────────────────────────────────

  buscarSunat(): void {
    if (this.buscandoRuc) return;
    if (!/^\d{11}$/.test(this.form.ruc || '')) {
      this.toastr.warning('Ingrese un RUC de 11 dígitos para buscar en SUNAT');
      return;
    }

    this.buscandoRuc = true;
    this.decolectaService.ruc(this.form.ruc).subscribe({
      next: (data) => {
        this.buscandoRuc = false;
        if (data.razon_social) this.form.razonSocial = data.razon_social;
        if (data.direccion) this.form.direccion = data.direccion;
        if (data.distrito) this.form.distrito = data.distrito;
        if (data.provincia) this.form.provincia = data.provincia;
        if (data.departamento) this.form.departamento = data.departamento;
        this.toastr.success('Datos completados desde SUNAT');
        if (data.estado || data.condicion) {
          this.toastr.info(`SUNAT: ${data.condicion || '—'} - ${data.estado || '—'}`);
        }
      },
      error: () => {
        this.buscandoRuc = false;
        this.toastr.warning('No se encontró información para ese RUC');
      }
    });
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  eliminar(empresa: Empresa): void {
    Swal.fire({
      title: 'Eliminar empresa',
      html: `¿Eliminar la empresa <strong>${empresa.razonSocial}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = empresa.id ?? null;
      this.empresaService.eliminar(empresa.id!).subscribe({
        next: () => {
          this.procesandoId = null;
          this.toastr.success('Empresa eliminada');
          this.cargarEmpresas();
        },
        error: (err) => {
          this.procesandoId = null;
          this.toastr.error(err?.error?.mensaje || 'No se pudo eliminar la empresa', 'Error');
        }
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private formVacio(): Empresa {
    return {
      ruc: '',
      razonSocial: '',
      nombreComercial: '',
      direccion: '',
      distrito: '',
      provincia: '',
      departamento: '',
      telefono: '',
      correo: ''
    };
  }
}
