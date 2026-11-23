import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UsuarioService, UsuarioListado } from '../../services/usuario.service';
import { AdminSesionesService, SesionResumen } from '../../services/admin-sesiones.service';

@Component({
  selector: 'app-admin-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-inicio.component.html',
  styleUrl: './admin-inicio.component.scss'
})
export class AdminInicioComponent implements OnInit {

  usuarios: UsuarioListado[] = [];
  sesiones: SesionResumen | null = null;

  constructor(
    private usuarioService: UsuarioService,
    private sesionesService: AdminSesionesService
  ) {}

  ngOnInit(): void {
    this.usuarioService.listar().subscribe({
      next: (data) => this.usuarios = data,
      error: () => {}
    });
    this.sesionesService.resumen().subscribe({
      next: (data) => this.sesiones = data,
      error: () => {}
    });
  }

  get totalUsuarios(): number { return this.usuarios.length; }
  get totalVendedores(): number { return this.usuarios.filter(u => u.rol === 'VENDEDOR').length; }
  get totalAdmins(): number { return this.usuarios.filter(u => u.rol === 'ADMINISTRADOR').length; }
  get usuariosActivos(): number { return this.usuarios.filter(u => u.estado === 'activo').length; }
}
