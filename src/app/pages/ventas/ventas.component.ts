import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';
import {
  VentaService,
  VentaCrear,
  VentaListado,
  VentaDetalle
} from '../../services/venta.service';
import { LoteService, Lote } from '../../services/lote.service';
import { ClienteService, Cliente } from '../../services/cliente.service';
import { EmpresaService, Empresa } from '../../services/empresa.service';
import { ProyectoService, Proyecto } from '../../services/proyecto.service';
import { PagoComision } from '../../services/comision.service';
import { CurrencyFormatterDirective } from '../../directives/currency-formatter';

interface VentaForm {
  idEmpresa: number | null;
  idProyecto: number | null;
  fechaVenta: string;
  precioVenta: number | null;
  modalidad: string;
  montoInicial: number | null;
  numCuotas: number | null;
  comisionManual: number | null;
  notas: string;
}

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyFormatterDirective],
  templateUrl: './ventas.component.html',
  styleUrl: './ventas.component.scss'
})
export class VentasComponent implements OnInit {

  ventas: VentaListado[] = [];
  cargando = false;

  // Catálogos del modal de nueva venta
  empresas: Empresa[] = [];
  proyectos: Proyecto[] = [];
  lotes: Lote[] = [];               // lotes del programa seleccionado (sin VENDIDOS)
  clientes: Cliente[] = [];
  lotesSeleccionados: Lote[] = [];
  clientesSeleccionados: Cliente[] = [];

  cargandoCatalogos = false;
  modalAbierto = false;
  guardando = false;
  form: VentaForm = this.formVacio();

  // Selects con búsqueda (mismo patrón que la vista "registrar contrato")
  @ViewChild('empresaBusquedaContainer') empresaBusquedaContainer?: ElementRef;
  @ViewChild('proyectoBusquedaContainer') proyectoBusquedaContainer?: ElementRef;
  @ViewChild('loteBusquedaContainer') loteBusquedaContainer?: ElementRef;
  @ViewChild('clienteBusquedaContainer') clienteBusquedaContainer?: ElementRef;
  @ViewChild('empresaInput') empresaInput?: ElementRef<HTMLInputElement>;
  @ViewChild('proyectoInput') proyectoInput?: ElementRef<HTMLInputElement>;

  filtroEmpresa = '';
  mostrarEmpresas = false;
  empresasFiltradas: Empresa[] = [];

  filtroProyecto = '';
  mostrarProyectos = false;
  proyectosFiltrados: Proyecto[] = [];

  filtroLote = '';
  mostrarLotes = false;
  lotesFiltrados: Lote[] = [];

  filtroCliente = '';
  mostrarClientes = false;
  clientesFiltrados: Cliente[] = [];

  // Detalle
  detalleAbierto = false;
  cargandoDetalle = false;
  detalle: VentaDetalle | null = null;

  constructor(
    private ventaService: VentaService,
    private loteService: LoteService,
    private clienteService: ClienteService,
    private empresaService: EmpresaService,
    private proyectoService: ProyectoService,
    private toastr: ToastrService
  ) { }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent): void {
    const t = event.target as HTMLElement;
    if (this.empresaBusquedaContainer && !this.empresaBusquedaContainer.nativeElement.contains(t)) {
      this.mostrarEmpresas = false;
    }
    if (this.proyectoBusquedaContainer && !this.proyectoBusquedaContainer.nativeElement.contains(t)) {
      this.mostrarProyectos = false;
    }
    if (this.loteBusquedaContainer && !this.loteBusquedaContainer.nativeElement.contains(t)) {
      this.mostrarLotes = false;
    }
    if (this.clienteBusquedaContainer && !this.clienteBusquedaContainer.nativeElement.contains(t)) {
      this.mostrarClientes = false;
    }
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.ventaService.listar().subscribe({
      next: (data) => {
        this.ventas = data;
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.toastr.error('Error al cargar las ventas', 'Error');
      }
    });
  }

  // ── Nueva venta ───────────────────────────────────────────────────────────

  async abrirCrear(): Promise<void> {
    this.form = this.formVacio();
    this.lotesSeleccionados = [];
    this.clientesSeleccionados = [];
    this.lotes = [];
    this.lotesFiltrados = [];
    this.filtroEmpresa = '';
    this.filtroProyecto = '';
    this.filtroLote = '';
    this.filtroCliente = '';
    this.mostrarEmpresas = false;
    this.mostrarProyectos = false;
    this.mostrarLotes = false;
    this.mostrarClientes = false;
    this.modalAbierto = true;
    this.cargandoCatalogos = true;

    try {
      const [empresas, proyectos, clientes] = await Promise.all([
        firstValueFrom(this.empresaService.listar()),
        firstValueFrom(this.proyectoService.listar()),
        firstValueFrom(this.clienteService.listar())
      ]);
      this.empresas = empresas;
      this.proyectos = proyectos;
      this.clientes = clientes;
      // Las listas se calculan al enfocar cada campo (focus),
      // así el modal NO se abre con los desplegables ya visibles.
    } catch (err: any) {
      this.modalAbierto = false;
      this.toastr.error(err?.error?.mensaje || 'No se pudieron cargar empresas, programas y clientes', 'Error');
    } finally {
      this.cargandoCatalogos = false;
    }
  }

  cerrarModal(): void {
    this.modalAbierto = false;
  }

  // ── Empresa (paso 1 de la cascada) ────────────────────────────────────────

  filtrarEmpresas(): void {
    const f = this.filtroEmpresa.trim().toLowerCase();
    this.empresasFiltradas = this.empresas.filter(e =>
      (e.razonSocial || '').toLowerCase().includes(f) ||
      (e.nombreComercial || '').toLowerCase().includes(f) ||
      (e.ruc || '').includes(f));
    this.mostrarEmpresas = true;
  }

  /**
   * Al enfocar el campo se despliega la lista COMPLETA (aunque el input
   * conserve el nombre ya elegido) y se selecciona el texto para que
   * la primera tecla lo reemplace.
   */
  abrirEmpresas(): void {
    this.empresasFiltradas = this.empresas;
    this.mostrarEmpresas = true;
    this.empresaInput?.nativeElement.select();
  }

  seleccionarEmpresa(e: Empresa): void {
    const mismo = this.form.idEmpresa === e.id;
    this.form.idEmpresa = e.id ?? null;
    this.filtroEmpresa = e.nombreComercial?.trim() || e.razonSocial;
    this.mostrarEmpresas = false;
    if (!mismo) {
      // Al cambiar de empresa se limpia el programa y los lotes elegidos
      this.form.idProyecto = null;
      this.filtroProyecto = '';
      this.lotes = [];
      this.lotesFiltrados = [];
      this.lotesSeleccionados = [];
      this.actualizarTotalDesdeLotes();
    }
    this.filtrarProyectos();
  }

  // ── Programa / proyecto (paso 2) ──────────────────────────────────────────

  get proyectosDeEmpresa(): Proyecto[] {
    return this.proyectos.filter(p => p.idEmpresa === this.form.idEmpresa);
  }

  filtrarProyectos(): void {
    if (!this.form.idEmpresa) {
      this.proyectosFiltrados = [];
      this.mostrarProyectos = true;
      return;
    }
    const f = this.filtroProyecto.trim().toLowerCase();
    this.proyectosFiltrados = this.proyectosDeEmpresa.filter(p =>
      (p.nombre || '').toLowerCase().includes(f));
    this.mostrarProyectos = true;
  }

  /** Igual que abrirEmpresas: lista completa al desplegar + texto a reemplazar. */
  abrirProyectos(): void {
    this.proyectosFiltrados = this.proyectosDeEmpresa;
    this.mostrarProyectos = true;
    this.proyectoInput?.nativeElement.select();
  }

  seleccionarProyecto(p: Proyecto): void {
    const mismo = this.form.idProyecto === p.id;
    this.form.idProyecto = p.id ?? null;
    this.filtroProyecto = p.nombre;
    this.mostrarProyectos = false;
    if (mismo) return;
    this.lotesSeleccionados = [];
    this.actualizarTotalDesdeLotes();
    this.cargarLotesDelProyecto();
  }

  private cargarLotesDelProyecto(): void {
    if (!this.form.idProyecto) {
      this.lotes = [];
      this.lotesFiltrados = [];
      return;
    }
    this.loteService.listar({ idProyecto: this.form.idProyecto }).subscribe({
      next: (lotes) => {
        // Fuera los vendidos y los que ya tienen venta activa (solo la anulación los libera)
        this.lotes = lotes.filter(l => l.estado !== 'VENDIDO' && !l.ventaActiva);
        this.filtrarLotes();
      },
      error: () => this.toastr.error('No se pudieron cargar los lotes del programa', 'Error')
    });
  }

  // ── Lotes (multi-selección con suma) ──────────────────────────────────────

  filtrarLotes(): void {
    const f = this.filtroLote.trim().toLowerCase();
    this.lotesFiltrados = this.lotes.filter(l =>
      !this.lotesSeleccionados.some(s => s.id === l.id) &&
      this.loteCoincide(l, f));
    this.mostrarLotes = true;
  }

  seleccionarLote(l: Lote): void {
    if (l.id == null || this.lotesSeleccionados.some(s => s.id === l.id)) return;
    this.lotesSeleccionados.push(l);
    this.filtroLote = '';
    this.filtrarLotes();
    this.actualizarTotalDesdeLotes();
    setTimeout(() => { this.mostrarLotes = false; }, 0);
  }

  eliminarLote(id?: number): void {
    if (id == null) return;
    this.lotesSeleccionados = this.lotesSeleccionados.filter(l => l.id !== id);
    this.filtrarLotes();
    this.actualizarTotalDesdeLotes();
  }

  /** Suma de precios de lista → total (editable por si hay descuento). */
  private actualizarTotalDesdeLotes(): void {
    this.form.precioVenta = this.lotesSeleccionados.length > 0 ? this.totalLista : null;
    this.form.montoInicial = this.lotesSeleccionados.reduce((a, l) => a + (Number(l.inicial) || 0), 0) || null;
    this.form.numCuotas = this.lotesSeleccionados[0]?.numCuotas ?? null;
  }

  /** Suma de los precios de lista de los lotes seleccionados. */
  get totalLista(): number {
    return this.lotesSeleccionados.reduce((a, l) => a + (Number(l.precio) || 0), 0);
  }

  private loteCoincide(l: Lote, texto: string): boolean {
    if (!texto) return true;
    const t = texto.toLowerCase();
    return (l.manzana || '').toLowerCase().includes(t) ||
      (l.numero || '').toLowerCase().includes(t) ||
      (l.descripcion || '').toLowerCase().includes(t) ||
      (l.proyecto || '').toLowerCase().includes(t);
  }

  // ── Clientes (multi-selección) ────────────────────────────────────────────

  filtrarClientes(): void {
    const f = this.filtroCliente.trim().toLowerCase();
    this.clientesFiltrados = this.clientes.filter(c =>
      !this.clientesSeleccionados.some(s => s.id === c.id) &&
      ((c.nombres || '').toLowerCase().includes(f) ||
        (c.apellidos || '').toLowerCase().includes(f) ||
        (c.numDocumento || '').includes(f)));
    this.mostrarClientes = true;
  }

  seleccionarCliente(c: Cliente): void {
    if (c.id == null || this.clientesSeleccionados.some(s => s.id === c.id)) return;
    this.clientesSeleccionados.push(c);
    this.filtroCliente = '';
    this.filtrarClientes();
    setTimeout(() => { this.mostrarClientes = false; }, 0);
  }

  eliminarCliente(id?: number): void {
    if (id == null) return;
    this.clientesSeleccionados = this.clientesSeleccionados.filter(c => c.id !== id);
    this.filtrarClientes();
  }

  etiquetaLote(l: Lote): string {
    return `Mz.${l.manzana} Lt.${l.numero}`;
  }

  etiquetaCliente(c: Cliente): string {
    return `${c.nombres || ''} ${c.apellidos || ''}`.trim();
  }

  // ── Cuotas (misma lógica que la vista "registrar contrato") ────────────────

  /** Saldo a financiar = max(0, total de venta − inicial). */
  get saldoCalc(): number {
    return Math.max(0, (this.form.precioVenta || 0) - (this.form.montoInicial || 0));
  }

  /** Cuota mensual = piso(saldo / n° de cuotas). */
  get cuotaMensual(): number {
    const n = this.form.numCuotas || 0;
    return n > 0 ? Math.floor(this.saldoCalc / n) : 0;
  }

  /** Última cuota: absorbe el residuo (saldo − cuota × (n−1)). */
  get ultimaCuota(): number {
    const n = this.form.numCuotas || 0;
    if (n <= 0) return 0;
    return this.saldoCalc - this.cuotaMensual * (n - 1);
  }

  get tieneResiduo(): boolean {
    return this.ultimaCuota !== this.cuotaMensual;
  }

  formatearMoneda(v: number): string {
    return '$ ' + new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(v || 0);
  }

  guardar(): void {
    if (this.guardando) return;

    if (!this.form.idEmpresa) {
      this.toastr.warning('Seleccione una empresa');
      return;
    }
    if (!this.form.idProyecto) {
      this.toastr.warning('Seleccione un programa');
      return;
    }
    if (this.lotesSeleccionados.length === 0) {
      this.toastr.warning('Agregue al menos un lote');
      return;
    }
    if (this.clientesSeleccionados.length === 0) {
      this.toastr.warning('Agregue al menos un cliente');
      return;
    }
    const fechaVenta = this.form.fechaVenta;
    if (!fechaVenta) {
      this.toastr.warning('Indique la fecha de la venta');
      return;
    }
    const precio = this.num(this.form.precioVenta);
    if (precio == null || precio <= 0) {
      this.toastr.warning('El precio de venta debe ser mayor a 0');
      return;
    }

    const modalidad = this.form.modalidad;
    const dto: VentaCrear = {
      idsLotes: this.lotesSeleccionados.map(l => l.id!),
      idsClientes: this.clientesSeleccionados.map(c => c.id!),
      fechaVenta,
      precioVenta: precio,
      modalidad
    };

    if (modalidad === 'FINANCIADO') {
      const inicial = this.num(this.form.montoInicial);
      if (inicial == null || inicial <= 0) {
        this.toastr.warning('Indique el monto inicial (mayor a 0)');
        return;
      }
      if (inicial >= precio) {
        this.toastr.warning('La inicial debe ser menor al precio de venta');
        return;
      }
      if (this.form.numCuotas != null &&
          (this.form.numCuotas < 0 || this.form.numCuotas > 160)) {
        this.toastr.warning('El número de cuotas debe estar entre 0 y 160');
        return;
      }
      dto.montoInicial = inicial;
    }

    const comision = this.num(this.form.comisionManual);
    if (this.form.comisionManual != null && comision == null) {
      this.toastr.warning('La comisión manual debe ser un número válido');
      return;
    }
    if (comision != null) {
      dto.comisionManual = comision;
    }

    if (this.form.notas.trim()) {
      dto.notas = this.form.notas.trim();
    }

    this.guardando = true;
    this.ventaService.crear(dto).subscribe({
      next: () => {
        this.guardando = false;
        this.cerrarModal();
        const n = this.lotesSeleccionados.length;
        this.toastr.success(`Venta registrada con ${n} lote(s). Comisión generada.`);
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudo registrar la venta', 'Error');
      }
    });
  }

  // ── Detalle ───────────────────────────────────────────────────────────────

  get pagosDetalle(): PagoComision[] {
    return (this.detalle?.pagos || []) as PagoComision[];
  }

  abrirDetalle(v: VentaListado): void {
    this.detalleAbierto = true;
    this.detalle = null;
    this.cargandoDetalle = true;
    this.ventaService.obtener(v.id).subscribe({
      next: (data) => {
        this.detalle = data;
        this.cargandoDetalle = false;
      },
      error: (err) => {
        this.cargandoDetalle = false;
        this.detalleAbierto = false;
        this.toastr.error(err?.error?.mensaje || 'No se pudo cargar el detalle de la venta', 'Error');
      }
    });
  }

  cerrarDetalle(): void {
    this.detalleAbierto = false;
    this.detalle = null;
  }

  anular(id: number): void {
    Swal.fire({
      title: 'Anular venta',
      html: `¿Anular la venta <strong>#${id}</strong>?<br><small>La comisión generada también dejará de estar activa y los lotes volverán a estar disponibles.</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.ventaService.anular(id).subscribe({
        next: () => {
          this.toastr.success('Venta anulada');
          if (this.detalleAbierto) {
            this.cerrarDetalle();
          }
          this.cargar();
        },
        error: (err) => {
          this.toastr.error(err?.error?.mensaje || 'No se pudo anular la venta', 'Error');
        }
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  hoy(): string {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  claseModalidad(modalidad: string): string {
    return modalidad === 'CONTADO' ? 'badge-info' : 'badge-warning';
  }

  claseEstadoVenta(estado: string): string {
    return estado === 'ACTIVA' ? 'badge-activo' : 'badge-inactivo';
  }

  claseEstadoComision(estado?: string): string {
    switch (estado) {
      case 'PAGADA':
        return 'badge-activo';
      case 'PAGADA_PARCIAL':
        return 'badge-info';
      default:
        return 'badge-warning';
    }
  }

  etiquetaTipoPago(p: PagoComision): string {
    switch (p.tipo) {
      case 'ANTICIPO':
        return 'Anticipo';
      case 'TOTAL':
        return 'Total';
      default:
        return p.numeroCuota != null ? `Cuota #${p.numeroCuota}` : 'Cuota';
    }
  }

  private num(valor: unknown): number | null {
    return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
  }

  private formVacio(): VentaForm {
    return {
      idEmpresa: null,
      idProyecto: null,
      fechaVenta: this.hoy(),
      precioVenta: null,
      modalidad: 'CONTADO',
      montoInicial: null,
      numCuotas: null,
      comisionManual: null,
      notas: ''
    };
  }
}
