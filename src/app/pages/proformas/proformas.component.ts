import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { ProformaService, Proforma } from '../../services/proforma.service';
import { ClienteService, Cliente } from '../../services/cliente.service';
import { EmpresaService, Empresa } from '../../services/empresa.service';
import { LoteService, Lote } from '../../services/lote.service';
import { UsuarioService, Perfil } from '../../services/usuario.service';
import { TokenService } from '../../auth/token.service';
import { AlertService } from '../../services/alert.service';

interface FilaDetalle {
  idLote: number | null;
  precioUnitario: number | null;
}

@Component({
  selector: 'app-proformas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proformas.component.html',
  styleUrl: './proformas.component.scss'
})
export class ProformasComponent implements OnInit {

  proformas: Proforma[] = [];
  empresas: Empresa[] = [];
  clientes: Cliente[] = [];
  lotes: Lote[] = [];
  perfil: Perfil | null = null;
  cargando = false;
  terminoBusqueda = '';
  procesandoId: number | null = null;

  // Modal crear/editar
  modalAbierto = false;
  modoEdicion = false;
  proformaEditando: Proforma | null = null;
  guardando = false;
  form: { idEmpresa: number | null; idCliente: number | null; observaciones: string } = {
    idEmpresa: null,
    idCliente: null,
    observaciones: ''
  };
  filas: FilaDetalle[] = [{ idLote: null, precioUnitario: null }];

  // Vista previa imprimible
  vistaPrevia: Proforma | null = null;

  constructor(
    private proformaService: ProformaService,
    private clienteService: ClienteService,
    private empresaService: EmpresaService,
    private loteService: LoteService,
    private usuarioService: UsuarioService,
    private tokenService: TokenService,
    private alert: AlertService
  ) { }

  ngOnInit(): void {
    this.cargarProformas();
    this.empresaService.listar().subscribe({
      next: (data) => this.empresas = data,
      error: () => this.alert.toastError('Error al cargar las empresas', 'Error')
    });
    this.clienteService.listar().subscribe({
      next: (data) => this.clientes = data,
      error: () => this.alert.toastError('Error al cargar los clientes', 'Error')
    });
    this.loteService.listar().subscribe({
      next: (data) => this.lotes = data,
      error: () => this.alert.toastError('Error al cargar los lotes', 'Error')
    });
    // Datos del vendedor para el encabezado del documento (nunca los de la empresa)
    this.usuarioService.perfil().subscribe({
      next: (data) => this.perfil = data,
      error: () => {
        // Si falla el perfil, se usan los datos del token como respaldo
        this.perfil = null;
      }
    });
  }

  cargarProformas(): void {
    this.cargando = true;
    this.proformaService.listar().subscribe({
      next: (data) => {
        this.proformas = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.alert.toastError('Error al cargar las proformas', 'Error');
      }
    });
  }

  get xFiltrados(): Proforma[] {
    if (!this.terminoBusqueda.trim()) return this.proformas;
    const t = this.terminoBusqueda.toLowerCase();
    return this.proformas.filter(p =>
      (p.numero || '').toLowerCase().includes(t) ||
      this.nombreCliente(p).toLowerCase().includes(t) ||
      (p.estado || '').toLowerCase().includes(t)
    );
  }

  // ── Crear / Editar ────────────────────────────────────────────────────────

  abrirCrear(): void {
    this.modoEdicion = false;
    this.proformaEditando = null;
    this.form = {
      idEmpresa: this.empresas.length ? this.empresas[0].id! : null,
      idCliente: null,
      observaciones: ''
    };
    this.filas = [{ idLote: null, precioUnitario: null }];
    this.modalAbierto = true;
  }

  abrirEditar(p: Proforma): void {
    this.modoEdicion = true;
    this.proformaEditando = p;
    this.form = {
      idEmpresa: p.idEmpresa,
      idCliente: p.idCliente,
      observaciones: p.observaciones || ''
    };
    this.filas = (p.detalles || []).map(d => ({
      idLote: d.idLote,
      precioUnitario: d.precioUnitario
    }));
    if (!this.filas.length) this.filas = [{ idLote: null, precioUnitario: null }];
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  onEmpresaChange(): void {
    const conLote = this.filas.some(f => f.idLote != null);
    this.filas = [{ idLote: null, precioUnitario: null }];
    if (conLote) this.alert.toastInfo('Se limpiaron los lotes al cambiar de empresa');
  }

  /** Lotes de la empresa elegida que aún no fueron agregados a otra fila (sin vendidos). */
  lotesParaFila(indice: number): Lote[] {
    const idsEnUso = this.filas
      .filter((f, i) => i !== indice && f.idLote != null)
      .map(f => f.idLote);
    return this.lotes.filter(l =>
      l.idEmpresa === this.form.idEmpresa &&
      l.estado !== 'VENDIDO' &&
      !idsEnUso.includes(l.id!)
    );
  }

  onLoteSeleccionado(indice: number): void {
    const fila = this.filas[indice];
    if (fila.idLote == null) return;
    const lote = this.lotes.find(l => l.id === fila.idLote);
    if (lote) fila.precioUnitario = lote.precio;
  }

  agregarFila(): void {
    this.filas.push({ idLote: null, precioUnitario: null });
  }

  quitarFila(indice: number): void {
    this.filas.splice(indice, 1);
    if (!this.filas.length) this.filas.push({ idLote: null, precioUnitario: null });
  }

  get totalForm(): number {
    return this.filas.reduce((s, f) => s + (Number(f.precioUnitario) || 0), 0);
  }

  async guardar(): Promise<void> {
    if (this.guardando) return;

    if (!this.form.idEmpresa) {
      this.alert.toastWarning('Seleccione una empresa');
      return;
    }
    if (!this.form.idCliente) {
      this.alert.toastWarning('Seleccione un cliente');
      return;
    }
    const validas = this.filas.filter(f => f.idLote != null && Number(f.precioUnitario) > 0);
    if (validas.length !== this.filas.length) {
      this.alert.toastWarning('Cada fila debe tener un lote y un precio mayor a 0');
      return;
    }

    const dto: Proforma = {
      idEmpresa: this.form.idEmpresa,
      idCliente: this.form.idCliente,
      observaciones: this.form.observaciones.trim() ? this.form.observaciones.trim() : null,
      detalles: validas.map(f => ({
        idLote: f.idLote!,
        precioUnitario: Number(f.precioUnitario)
      }))
    };

    if (this.modoEdicion && this.proformaEditando) {
      const ok = await this.alert.confirmarEdicion(
        `¿Guardar los cambios de la proforma <strong>${this.proformaEditando.numero}</strong>?`);
      if (!ok) return;
    }

    this.guardando = true;
    const peticion = this.modoEdicion && this.proformaEditando
      ? this.proformaService.editar(this.proformaEditando.id!, dto)
      : this.proformaService.crear(dto);

    peticion.subscribe({
      next: (guardada) => {
        this.guardando = false;
        this.modalAbierto = false;
        this.alert.success(this.modoEdicion ? 'Proforma actualizada' : 'Proforma emitida: ' + guardada.numero);
        this.cargarProformas();
        this.ver(guardada);
      },
      error: (err) => {
        this.guardando = false;
        this.alert.toastError(err?.error?.mensaje || 'No se pudo guardar la proforma', 'Error');
      }
    });
  }

  // ── Vista previa e impresión ──────────────────────────────────────────────

  ver(p: Proforma): void {
    this.vistaPrevia = p;
  }

  cerrarVista(): void {
    this.vistaPrevia = null;
  }

  imprimir(): void {
    window.print();
  }

  // ── Estado ────────────────────────────────────────────────────────────────

  esEditable(p: Proforma): boolean {
    return (p.estado || 'EMITIDA') === 'EMITIDA';
  }

  claseEstado(p: Proforma): string {
    switch (p.estado) {
      case 'ACEPTADA': return 'badge-ok';
      case 'ANULADA': return 'badge-error';
      default: return 'badge-info';
    }
  }

  etiquetaEstado(p: Proforma): string {
    switch (p.estado) {
      case 'ACEPTADA': return 'Aceptada';
      case 'ANULADA': return 'Anulada';
      default: return 'Emitida';
    }
  }

  cambiarEstado(p: Proforma, estado: string): void {
    const accion = estado === 'ACEPTADA' ? 'aceptar' : 'anular';
    Swal.fire({
      title: `${accion.charAt(0).toUpperCase()}${accion.slice(1)} proforma`,
      html: `¿Desea ${accion} la proforma <strong>${p.numero}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: estado === 'ACEPTADA' ? '#10b981' : '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = p.id ?? null;
      this.proformaService.cambiarEstado(p.id!, estado).subscribe({
        next: () => {
          this.procesandoId = null;
          this.alert.success(`Proforma ${accion}da`);
          this.cargarProformas();
          if (this.vistaPrevia?.id === p.id) this.vistaPrevia = null;
        },
        error: (err) => {
          this.procesandoId = null;
          this.alert.toastError(err?.error?.mensaje || 'No se pudo cambiar el estado', 'Error');
        }
      });
    });
  }

  eliminar(p: Proforma): void {
    Swal.fire({
      title: 'Eliminar proforma',
      html: `¿Eliminar la proforma <strong>${p.numero}</strong>? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.procesandoId = p.id ?? null;
      this.proformaService.eliminar(p.id!).subscribe({
        next: () => {
          this.procesandoId = null;
          this.alert.success('Proforma eliminada');
          if (this.vistaPrevia?.id === p.id) this.vistaPrevia = null;
          this.cargarProformas();
        },
        error: (err) => {
          this.procesandoId = null;
          this.alert.toastError(err?.error?.mensaje || 'No se pudo eliminar la proforma', 'Error');
        }
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  // ── Datos del vendedor (encabezado del documento) ─────────────────────────

  get vendedorNombre(): string {
    if (this.perfil) {
      return `${this.perfil.nombres || ''} ${this.perfil.apellidos || ''}`.trim();
    }
    return this.tokenService.getNombreCompleto() || 'Vendedor';
  }

  get vendedorTelefono(): string {
    return this.perfil?.telefono || '';
  }

  get vendedorCorreo(): string {
    return this.perfil?.correo || '';
  }

  get vendedorDni(): string {
    return this.perfil?.dni || '';
  }

  // ── Plan de pago del documento ────────────────────────────────────────────

  /** Lotes incluidos en la proforma (para tomar su inicial y n° de cuotas). */
  private lotesDeProforma(p: Proforma): Lote[] {
    return (p.detalles || [])
      .map(d => this.lotes.find(l => l.id === d.idLote))
      .filter((l): l is Lote => !!l);
  }

  /** Inicial total pactada (suma de la inicial de cada lote). */
  get inicialDoc(): number {
    if (!this.vistaPrevia) return 0;
    return this.lotesDeProforma(this.vistaPrevia)
      .reduce((s, l) => s + (Number(l.inicial) || 0), 0);
  }

  /** Número de cuotas (letras) del plan de pago. */
  get numCuotasDoc(): number {
    if (!this.vistaPrevia) return 0;
    const cuotas = this.lotesDeProforma(this.vistaPrevia)
      .map(l => Number(l.numCuotas) || 0)
      .filter(n => n > 0);
    return cuotas.length ? Math.max(...cuotas) : 0;
  }

  /** Saldo a financiar = total de la proforma − inicial. */
  get saldoDoc(): number {
    if (!this.vistaPrevia) return 0;
    const total = Number(this.vistaPrevia.total) || 0;
    return Math.max(0, total - this.inicialDoc);
  }

  /** Importe de cada cuota (letra): piso(saldo / n° de cuotas). */
  get cuotaDoc(): number {
    const n = this.numCuotasDoc;
    if (n <= 0 || this.saldoDoc <= 0) return 0;
    return Math.floor(this.saldoDoc / n);
  }

  /** La última cuota absorbe el residuo (saldo − cuota × (n−1)). */
  get ultimaCuotaDoc(): number {
    const n = this.numCuotasDoc;
    if (n <= 0) return 0;
    return this.saldoDoc - this.cuotaDoc * (n - 1);
  }

  get tieneResiduoDoc(): boolean {
    return this.ultimaCuotaDoc !== this.cuotaDoc;
  }

  clienteDe(id?: number): Cliente | undefined {
    return this.clientes.find(c => c.id === id);
  }

  nombreCliente(p: Proforma): string {
    const c = this.clienteDe(p.idCliente);
    return c ? `${c.nombres} ${c.apellidos || ''}`.trim() : 'Cliente';
  }
}
