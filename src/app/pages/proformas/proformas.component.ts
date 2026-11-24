import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import {
  ProformaService,
  Proforma,
  ProformaSeguimiento,
  DetalleProforma
} from '../../services/proforma.service';
import { ClienteService, Cliente } from '../../services/cliente.service';
import { EmpresaService, Empresa } from '../../services/empresa.service';
import { ProyectoService, Proyecto } from '../../services/proyecto.service';
import { LoteService, Lote } from '../../services/lote.service';
import { DeclectaService } from '../../services/decolecta.service';
import { UsuarioService, Perfil } from '../../services/usuario.service';
import { TokenService } from '../../auth/token.service';
import { AlertService } from '../../services/alert.service';
import { ProformaUiService } from '../../services/proforma-ui.service';
import { environment } from '../../../environments/environment';
import {
  SearchableSelectComponent,
  SelectOption
} from '../../components/searchable-select/searchable-select.component';

interface FilaDetalle {
  idEmpresa: number | null;
  idProyecto: number | null;
  idLote: number | null;
  precioUnitario: number | null;
  inicial: number | null;
  numCuotas: number | null;
}

interface ProformaForm {
  idCliente: number | null;
  tipoDocumento: string;
  numDocumento: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  observaciones: string;
}

@Component({
  selector: 'app-proformas',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent],
  templateUrl: './proformas.component.html',
  styleUrl: './proformas.component.scss'
})
export class ProformasComponent implements OnInit, OnDestroy {

  proformas: Proforma[] = [];
  seguimiento: ProformaSeguimiento[] = [];
  empresas: Empresa[] = [];
  proyectos: Proyecto[] = [];
  clientes: Cliente[] = [];
  lotes: Lote[] = [];
  perfil: Perfil | null = null;

  cargando = false;
  cargandoSeguimiento = false;
  terminoBusqueda = '';
  procesandoId: number | null = null;
  tab: 'PROFORMAS' | 'SEGUIMIENTO' = 'PROFORMAS';

  // Filtro por fechas
  fechaDesde = '';
  fechaHasta = '';

  // Modal crear/editar
  modalAbierto = false;
  modoEdicion = false;
  proformaEditando: Proforma | null = null;
  guardando = false;
  buscandoDni = false;
  form: ProformaForm = this.formVacio();
  filas: FilaDetalle[] = [this.filaVacia()];

  vistaPrevia: Proforma | null = null;

  readonly estadosSeguimiento = ['NUEVO', 'CONTACTADO', 'INTERESADO', 'NO_INTERESADO', 'GANADO'];

  private nuevaSub?: Subscription;

  constructor(
    private proformaService: ProformaService,
    private clienteService: ClienteService,
    private empresaService: EmpresaService,
    private proyectoService: ProyectoService,
    private loteService: LoteService,
    private decolectaService: DeclectaService,
    private usuarioService: UsuarioService,
    private tokenService: TokenService,
    private alert: AlertService,
    private proformaUi: ProformaUiService
  ) { }

  ngOnInit(): void {
    this.cargarProformas();
    this.empresaService.listar().subscribe({ next: (d) => this.empresas = d, error: () => undefined });
    this.proyectoService.listar().subscribe({ next: (d) => this.proyectos = d, error: () => undefined });
    this.clienteService.listar().subscribe({ next: (d) => this.clientes = d, error: () => undefined });
    this.loteService.listar().subscribe({ next: (d) => this.lotes = d, error: () => undefined });
    this.usuarioService.perfil().subscribe({ next: (d) => this.perfil = d, error: () => this.perfil = null });

    // Permite abrir el modal desde el botón flotante global del layout.
    this.nuevaSub = this.proformaUi.onNueva().subscribe(() => {
      this.proformaUi.consumirPendiente();
      this.abrirCrear();
    });
    if (this.proformaUi.consumirPendiente()) {
      this.abrirCrear();
    }
  }

  ngOnDestroy(): void {
    this.nuevaSub?.unsubscribe();
  }

  // ── Carga y filtros ───────────────────────────────────────────────────────

  cargarProformas(): void {
    this.cargando = true;
    this.proformaService.listar(this.filtro()).subscribe({
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

  cargarSeguimiento(): void {
    this.cargandoSeguimiento = true;
    this.proformaService.seguimiento(this.filtro()).subscribe({
      next: (data) => {
        this.seguimiento = data;
        this.cargandoSeguimiento = false;
      },
      error: () => {
        this.cargandoSeguimiento = false;
        this.alert.toastError('Error al cargar el seguimiento', 'Error');
      }
    });
  }

  cambiarTab(tab: 'PROFORMAS' | 'SEGUIMIENTO'): void {
    this.tab = tab;
    if (tab === 'SEGUIMIENTO' && this.seguimiento.length === 0) {
      this.cargarSeguimiento();
    }
  }

  private filtro(): { fechaDesde?: string; fechaHasta?: string } {
    return {
      fechaDesde: this.fechaDesde || undefined,
      fechaHasta: this.fechaHasta || undefined
    };
  }

  aplicarPreset(preset: 'HOY' | 'AYER' | 'SEMANA' | 'MES' | 'TODOS'): void {
    const hoy = new Date();
    if (preset === 'TODOS') {
      this.fechaDesde = '';
      this.fechaHasta = '';
    } else if (preset === 'HOY') {
      this.fechaDesde = this.iso(hoy);
      this.fechaHasta = this.iso(hoy);
    } else if (preset === 'AYER') {
      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);
      this.fechaDesde = this.iso(ayer);
      this.fechaHasta = this.iso(ayer);
    } else if (preset === 'SEMANA') {
      const desde = new Date(hoy);
      desde.setDate(desde.getDate() - 7);
      this.fechaDesde = this.iso(desde);
      this.fechaHasta = this.iso(hoy);
    } else {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      this.fechaDesde = this.iso(primero);
      this.fechaHasta = this.iso(hoy);
    }
    this.recargar();
  }

  recargar(): void {
    this.cargarProformas();
    if (this.tab === 'SEGUIMIENTO') {
      this.cargarSeguimiento();
    }
  }

  get xFiltrados(): Proforma[] {
    const t = this.terminoBusqueda.trim().toLowerCase();
    if (!t) return this.proformas;
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
    this.form = this.formVacio();
    this.filas = [this.filaVacia()];
    this.modalAbierto = true;
  }

  abrirEditar(p: Proforma): void {
    const c = this.clienteDe(p.idCliente);
    this.modoEdicion = true;
    this.proformaEditando = p;
    this.form = {
      idCliente: p.idCliente,
      tipoDocumento: c?.tipoDocumento || 'DNI',
      numDocumento: c?.numDocumento || '',
      nombres: c?.nombres || '',
      apellidos: c?.apellidos || '',
      telefono: c?.telefono || '',
      observaciones: p.observaciones || ''
    };
    this.filas = (p.detalles || []).map(d => {
      const lote = this.lotes.find(l => l.id === d.idLote);
      return {
        idEmpresa: lote?.idEmpresa ?? d.idEmpresa ?? null,
        idProyecto: lote?.idProyecto ?? null,
        idLote: d.idLote,
        precioUnitario: d.precioUnitario,
        inicial: d.inicial ?? lote?.inicial ?? null,
        numCuotas: d.numCuotas ?? lote?.numCuotas ?? null
      };
    });
    if (!this.filas.length) this.filas = [this.filaVacia()];
    this.modalAbierto = true;
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  onDocumentoInput(): void {
    // Si cambia el documento, deja de estar asociado a un cliente existente.
    this.form.idCliente = null;
  }

  buscarDni(): void {
    const doc = (this.form.numDocumento || '').trim();
    if (!/^\d{8}$/.test(doc)) {
      this.alert.toastWarning('El DNI debe tener 8 dígitos');
      return;
    }
    this.buscandoDni = true;
    this.decolectaService.dni(doc).subscribe({
      next: (data) => {
        this.buscandoDni = false;
        if (data.first_name) this.form.nombres = data.first_name;
        if (data.first_last_name) {
          this.form.apellidos = data.second_last_name
            ? `${data.first_last_name} ${data.second_last_name}`
            : data.first_last_name;
        }
        this.buscarClienteExistente(doc);
      },
      error: () => {
        this.buscandoDni = false;
        this.buscarClienteExistente(doc);
      }
    });
  }

  private buscarClienteExistente(doc: string): void {
    this.clienteService.buscarPorDocumento(doc).subscribe({
      next: (c) => {
        this.form.idCliente = c.id ?? null;
        this.form.nombres = c.nombres || this.form.nombres;
        this.form.apellidos = c.apellidos || this.form.apellidos;
        this.form.telefono = c.telefono || this.form.telefono;
        this.alert.toastInfo('Cliente existente encontrado');
      },
      error: () => {
        // No existe: se creará como prospecto al emitir.
      }
    });
  }

  /** Programas/proyectos de la empresa elegida en la fila. */
  get empresaOptions(): SelectOption[] {
    return this.empresas
      .filter(e => e.id != null)
      .map(e => ({
        id: e.id!,
        label: e.nombreComercial?.trim() || e.razonSocial,
        badge: e.ruc
      }));
  }

  programaOptions(indice: number): SelectOption[] {
    return this.programasDeFila(indice)
      .filter(p => p.id != null)
      .map(p => ({ id: p.id!, label: p.nombre }));
  }

  loteOptions(indice: number): SelectOption[] {
    return this.lotesDeFila(indice)
      .filter(l => l.id != null)
      .map(l => ({
        id: l.id!,
        label: `Mz ${l.manzana} N° ${l.numero}`,
        sub: l.areaM2 != null ? `${l.areaM2} m²` : undefined,
        badge: l.precio != null ? `USD ${l.precio}` : undefined
      }));
  }

  programasDeFila(indice: number): Proyecto[] {
    const fila = this.filas[indice];
    if (fila.idEmpresa == null) return [];
    return this.proyectos
      .filter(p => p.idEmpresa === fila.idEmpresa && p.estado !== 'INACTIVO')
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }

  /** Lotes disponibles del programa elegido en la fila (sin vendidos ni repetidos). */
  lotesDeFila(indice: number): Lote[] {
    const fila = this.filas[indice];
    if (fila.idEmpresa == null || fila.idProyecto == null) return [];
    const usados = this.filas
      .filter((f, i) => i !== indice && f.idLote != null)
      .map(f => f.idLote);
    return this.lotes
      .filter(l => l.id != null
        && l.idEmpresa === fila.idEmpresa
        && l.idProyecto === fila.idProyecto
        && l.estado !== 'VENDIDO'
        && !l.ventaActiva
        && !usados.includes(l.id))
      .sort((a, b) => this.etiquetaLoteCorto(a).localeCompare(this.etiquetaLoteCorto(b)));
  }

  onEmpresaFila(indice: number, valor: number | null): void {
    const fila = this.filas[indice];
    fila.idEmpresa = valor;
    fila.idProyecto = null;
    fila.idLote = null;
    fila.precioUnitario = null;
  }

  onProgramaFila(indice: number, valor: number | null): void {
    const fila = this.filas[indice];
    fila.idProyecto = valor;
    fila.idLote = null;
    fila.precioUnitario = null;
  }

  onLoteSeleccionado(indice: number, valor: number | null): void {
    const fila = this.filas[indice];
    fila.idLote = valor;
    if (valor == null) {
      fila.precioUnitario = null;
      fila.inicial = null;
      fila.numCuotas = null;
      return;
    }
    const lote = this.lotes.find(l => l.id === valor);
    if (lote) {
      fila.precioUnitario = lote.precio;
      fila.inicial = lote.inicial ?? null;
      fila.numCuotas = lote.numCuotas ?? null;
    }
  }

  agregarFila(): void {
    // Copia empresa/programa de la última fila: permite agregar más lotes
    // del mismo programa rápidamente (o cambiarlos para otro programa).
    const ultima = this.filas[this.filas.length - 1];
    this.filas.push(this.filaVacia(ultima?.idEmpresa ?? null, ultima?.idProyecto ?? null));
  }

  quitarFila(indice: number): void {
    this.filas.splice(indice, 1);
    if (!this.filas.length) this.filas.push(this.filaVacia());
  }

  get totalForm(): number {
    return this.filas.reduce((s, f) => s + (Number(f.precioUnitario) || 0), 0);
  }

  /** Saldo a financiar de UN lote (total − inicial de ese lote). */
  saldoFila(f: FilaDetalle): number {
    const total = Number(f.precioUnitario) || 0;
    const inicial = Number(f.inicial) || 0;
    return Math.max(0, Math.round((total - inicial) * 100) / 100);
  }

  /** Cuota aprox. de UN lote (saldo / n° de letras). */
  cuotaFila(f: FilaDetalle): number {
    const n = Number(f.numCuotas) || 0;
    return n > 0 ? Math.floor(this.saldoFila(f) / n) : 0;
  }

  async guardar(): Promise<void> {
    if (this.guardando) return;

    if (!/^\d{8}$/.test((this.form.numDocumento || '').trim())) {
      this.alert.toastWarning('Ingrese un DNI de 8 dígitos');
      return;
    }
    if (!this.form.nombres || !this.form.nombres.trim()) {
      this.alert.toastWarning('Ingrese el nombre del cliente');
      return;
    }
    const validas = this.filas.filter(f => f.idLote != null && Number(f.precioUnitario) > 0);
    if (validas.length !== this.filas.length) {
      this.alert.toastWarning('Cada fila debe tener un lote y un precio mayor a 0');
      return;
    }

    if (this.modoEdicion && this.proformaEditando) {
      const ok = await this.alert.confirmarEdicion(
        `¿Guardar los cambios de la proforma <strong>${this.proformaEditando.numero}</strong>?`);
      if (!ok) return;
    }

    this.guardando = true;
    try {
      const idCliente = await this.resolverCliente();
      const dto: Proforma = {
        idCliente,
        observaciones: this.form.observaciones.trim() ? this.form.observaciones.trim() : null,
        detalles: validas.map(f => ({
          idLote: f.idLote!,
          precioUnitario: Number(f.precioUnitario),
          inicial: f.inicial != null ? Number(f.inicial) : undefined,
          numCuotas: f.numCuotas != null ? Number(f.numCuotas) : undefined
        }))
      };

      const guardada = this.modoEdicion && this.proformaEditando
        ? await firstValueFrom(this.proformaService.editar(this.proformaEditando.id!, dto))
        : await firstValueFrom(this.proformaService.crear(dto));

      this.guardando = false;
      this.modalAbierto = false;
      this.alert.success(this.modoEdicion
        ? 'Proforma actualizada'
        : 'Proforma emitida: ' + guardada.numero);
      this.cargarProformas();
      this.ver(guardada);
    } catch (err: any) {
      this.guardando = false;
      this.alert.toastError(err?.error?.mensaje || 'No se pudo guardar la proforma', 'Error');
    }
  }

  /** Usa el cliente existente o crea un prospecto mínimo (DNI, nombre, celular). */
  private async resolverCliente(): Promise<number> {
    if (this.form.idCliente) {
      return this.form.idCliente;
    }
    const doc = this.form.numDocumento.trim();
    try {
      const existente = await firstValueFrom(this.clienteService.buscarPorDocumento(doc));
      if (existente.id) {
        this.form.idCliente = existente.id;
        return existente.id;
      }
    } catch {
      // 404: no existe → se crea como prospecto
    }
    const creado = await firstValueFrom(this.clienteService.crear({
      tipoDocumento: this.form.tipoDocumento || 'DNI',
      numDocumento: doc,
      nombres: this.form.nombres.trim(),
      apellidos: this.form.apellidos?.trim() || undefined,
      telefono: this.form.telefono?.trim() || undefined,
      prospecto: true,
      estadoSeguimiento: 'NUEVO'
    }));
    this.clientes = [...this.clientes, creado];
    this.form.idCliente = creado.id!;
    return creado.id!;
  }

  // ── PDF / WhatsApp ────────────────────────────────────────────────────────

  ver(p: Proforma): void {
    this.vistaPrevia = p;
  }

  cerrarVista(): void {
    this.vistaPrevia = null;
  }

  imprimir(): void {
    window.print();
  }

  descargarPdf(p: Proforma): void {
    if (!p.id) return;
    this.proformaService.descargarPdf(p.id).subscribe({
      next: (blob) => this.guardarBlob(blob, `Proforma-${p.numero || p.id}.pdf`),
      error: () => this.alert.toastError('No se pudo generar el PDF', 'Error')
    });
  }

  /** Envía la proforma al celular registrado del cliente (texto + enlace al PDF). */
  compartirWhatsApp(p: Proforma, telefonoRegistrado?: string): void {
    if (!p.id) return;
    const cliente = this.clienteDe(p.idCliente);
    const telefono = this.normalizarTelefono(telefonoRegistrado || cliente?.telefono);
    const texto = this.textoProforma(p);
    const url = telefono
      ? `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;

    if (!telefono) {
      this.alert.toastWarning(
        'El cliente no tiene celular registrado; elige el contacto en WhatsApp.');
    }
    window.open(url, '_blank');
  }

  whatsappSeguimiento(s: ProformaSeguimiento): void {
    if (!s.ultimaProformaId) {
      this.alert.toastWarning('No hay proforma para compartir');
      return;
    }
    this.proformaService.obtener(s.ultimaProformaId).subscribe({
      next: (p) => this.compartirWhatsApp(p, s.clienteTelefono),
      error: () => this.alert.toastError('No se pudo cargar la proforma', 'Error')
    });
  }

  /** Texto legible con el resumen y el enlace al PDF (por si no abre el PDF). */
  private textoProforma(p: Proforma): string {
    const cliente = this.clienteDe(p.idCliente);
    const nombre = cliente
      ? `${cliente.nombres} ${cliente.apellidos || ''}`.trim()
      : 'Cliente';
    const r = this.resumenPago(p);
    const lineas = (p.detalles || []).map(d => {
      const ini = this.inicialDetalle(d);
      return `• ${d.descripcion || 'Lote'} — USD ${this.moneda(d.precioUnitario)}`
        + (ini > 0 ? ` · Inicial USD ${this.moneda(ini)}` : '');
    }).join('\n');
    const enlace = p.publicToken
      ? `${environment.apiUrl}/api/proformas/pdf-publico/${p.publicToken}`
      : '';
    const fecha = p.fecha ? new Date(p.fecha).toLocaleDateString('es-PE') : '—';
    const cuota = r.cuotas > 0
      ? `*Cuota aprox.:* USD ${this.moneda(r.cuota)} × ${r.cuotas} letras`
      : '';

    return [
      `*PROFORMA ${p.numero || ''}*`,
      `Cliente: ${nombre}`,
      `Fecha: ${fecha}`,
      '',
      lineas,
      '',
      `*Total:* USD ${this.moneda(r.total)}`,
      `*Inicial:* USD ${this.moneda(r.inicial)}`,
      `*Saldo:* USD ${this.moneda(r.saldo)}`,
      cuota,
      enlace ? `\nVer PDF: ${enlace}` : '',
      '',
      '_Vende Lote_'
    ].filter(l => l !== '').join('\n');
  }

  private inicialDetalle(d: DetalleProforma): number {
    if (d.inicial != null) return Number(d.inicial);
    return Number(this.lotes.find(l => l.id === d.idLote)?.inicial) || 0;
  }

  private resumenPago(p: Proforma): {
    total: number; inicial: number; saldo: number; cuotas: number; cuota: number;
  } {
    const total = Number(p.total) || 0;
    const inicial = (p.detalles || []).reduce((s, d) => s + this.inicialDetalle(d), 0);
    const saldo = Math.max(0, total - inicial);
    const cuotasList = (p.detalles || [])
      .map(d => d.numCuotas != null
        ? Number(d.numCuotas)
        : (this.lotes.find(l => l.id === d.idLote)?.numCuotas ?? 0))
      .filter(n => n > 0);
    const cuotas = cuotasList.length ? Math.max(...cuotasList) : 0;
    const cuota = cuotas > 0 ? Math.floor(saldo / cuotas) : 0;
    return { total, inicial, saldo, cuotas, cuota };
  }

  /** Normaliza al formato de WhatsApp (móvil Perú: 9 dígitos → 51XXXXXXXXX). */
  private normalizarTelefono(telefono?: string): string {
    const primero = (telefono || '').split(',')[0].replace(/\D/g, '');
    if (!primero) return '';
    if (primero.length === 9) return '51' + primero;
    return primero;
  }

  private moneda(valor?: number | null): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(valor) || 0);
  }

  private guardarBlob(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Seguimiento ───────────────────────────────────────────────────────────

  cambiarEstadoSeguimiento(s: ProformaSeguimiento): void {
    this.clienteService.actualizarSeguimiento(s.idCliente, { estado: s.estadoSeguimiento })
      .subscribe({
        next: (c) => {
          s.estadoSeguimiento = c.estadoSeguimiento || s.estadoSeguimiento;
          this.alert.toastSuccess('Seguimiento actualizado');
        },
        error: () => this.alert.toastError('No se pudo actualizar el seguimiento', 'Error')
      });
  }

  completarCliente(s: ProformaSeguimiento): void {
    this.clienteService.completar(s.idCliente).subscribe({
      next: () => {
        s.prospecto = false;
        this.clientes = this.clientes.map(c => c.id === s.idCliente ? { ...c, prospecto: false } : c);
        this.alert.success('Prospecto marcado como cliente');
      },
      error: () => this.alert.toastError('No se pudo actualizar el cliente', 'Error')
    });
  }

  verUltima(s: ProformaSeguimiento): void {
    if (!s.ultimaProformaId) return;
    this.proformaService.obtener(s.ultimaProformaId).subscribe({
      next: (p) => this.ver(p),
      error: () => this.alert.toastError('No se pudo cargar la proforma', 'Error')
    });
  }

  // ── Estado / helpers ──────────────────────────────────────────────────────

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

  claseSeguimiento(estado: string): string {
    switch (estado) {
      case 'GANADO': return 'badge-ok';
      case 'INTERESADO': return 'badge-info';
      case 'CONTACTADO': return 'badge-warning';
      case 'NO_INTERESADO': return 'badge-error';
      default: return 'badge-info';
    }
  }

  etiquetaSeguimiento(estado: string): string {
    return (estado || 'NUEVO').replace('_', ' ');
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
    this.alert.confirmarEliminacion(
      `¿Eliminar la proforma <strong>${p.numero}</strong>? Esta acción no se puede deshacer.`,
      'Eliminar proforma'
    ).then((ok) => {
      if (!ok) return;
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

  // ── Datos del vendedor ────────────────────────────────────────────────────

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

  get inicialDoc(): number {
    if (!this.vistaPrevia) return 0;
    return (this.vistaPrevia.detalles || []).reduce((s, d) => {
      if (d.inicial != null) return s + Number(d.inicial);
      const lote = this.lotes.find(l => l.id === d.idLote);
      return s + (Number(lote?.inicial) || 0);
    }, 0);
  }

  get numCuotasDoc(): number {
    if (!this.vistaPrevia) return 0;
    const cuotas = (this.vistaPrevia.detalles || [])
      .map(d => d.numCuotas != null
        ? Number(d.numCuotas)
        : (this.lotes.find(l => l.id === d.idLote)?.numCuotas ?? 0))
      .filter(n => n > 0);
    return cuotas.length ? Math.max(...cuotas) : 0;
  }

  get saldoDoc(): number {
    if (!this.vistaPrevia) return 0;
    const total = Number(this.vistaPrevia.total) || 0;
    return Math.max(0, total - this.inicialDoc);
  }

  get cuotaDoc(): number {
    const n = this.numCuotasDoc;
    if (n <= 0 || this.saldoDoc <= 0) return 0;
    return Math.floor(this.saldoDoc / n);
  }

  get ultimaCuotaDoc(): number {
    const n = this.numCuotasDoc;
    if (n <= 0) return 0;
    return this.saldoDoc - this.cuotaDoc * (n - 1);
  }

  get tieneResiduoDoc(): boolean {
    return this.ultimaCuotaDoc !== this.cuotaDoc;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  clienteDe(id?: number): Cliente | undefined {
    return this.clientes.find(c => c.id === id);
  }

  nombreCliente(p: Proforma): string {
    const c = this.clienteDe(p.idCliente);
    return c ? `${c.nombres} ${c.apellidos || ''}`.trim() : 'Cliente';
  }

  empresaNombre(l: Lote): string {
    const e = this.empresas.find(x => x.id === l.idEmpresa);
    return e?.nombreComercial?.trim() || e?.razonSocial || 'Empresa';
  }

  etiquetaLote(l: Lote): string {
    return `${this.empresaNombre(l)} · ${l.proyecto} · Mz ${l.manzana} N° ${l.numero}`;
  }

  etiquetaLoteCorto(l: Lote): string {
    const area = l.areaM2 != null ? ` (${l.areaM2} m²)` : '';
    return `Mz ${l.manzana} N° ${l.numero}${area}`;
  }

  etiquetaPrograma(p: Proyecto): string {
    return p.nombre;
  }

  private filaVacia(idEmpresa: number | null = null, idProyecto: number | null = null): FilaDetalle {
    return {
      idEmpresa,
      idProyecto,
      idLote: null,
      precioUnitario: null,
      inicial: null,
      numCuotas: null
    };
  }

  private iso(d: Date): string {
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  private formVacio(): ProformaForm {
    return {
      idCliente: null,
      tipoDocumento: 'DNI',
      numDocumento: '',
      nombres: '',
      apellidos: '',
      telefono: '',
      observaciones: ''
    };
  }
}
