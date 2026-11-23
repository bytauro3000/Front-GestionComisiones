import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { roleGuard } from './auth/role.guard';
import { LoginLayoutComponent } from './auth/login/login-layout.component';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { VendedorLayoutComponent } from './layouts/vendedor-layout/vendedor-layout.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./auth/login/login.component').then((m) => m.LoginComponent)
      }
    ]
  },
  {
    path: 'registro',
    component: LoginLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/registro/registro.component').then((m) => m.RegistroComponent)
      }
    ]
  },

  // ── Panel del administrador ───────────────────────────────────────
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_ADMINISTRADOR'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        loadComponent: () =>
          import('./pages/admin-inicio/admin-inicio.component').then((m) => m.AdminInicioComponent)
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./pages/admin-usuarios/admin-usuarios.component').then(
            (m) => m.AdminUsuariosComponent
          )
      },
      {
        path: 'sesiones',
        loadComponent: () =>
          import('./pages/admin-sesiones/admin-sesiones.component').then(
            (m) => m.AdminSesionesComponent
          )
      },
      {
        path: 'auditoria',
        loadComponent: () =>
          import('./pages/admin-auditoria/admin-auditoria.component').then(
            (m) => m.AdminAuditoriaComponent
          )
      }
    ]
  },

  // ── Panel del vendedor ────────────────────────────────────────────
  {
    path: 'vendedor',
    component: VendedorLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ROLE_VENDEDOR'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        loadComponent: () =>
          import('./pages/vendedor-inicio/vendedor-inicio.component').then(
            (m) => m.VendedorInicioComponent
          )
      },
      {
        path: 'empresas',
        loadComponent: () =>
          import('./pages/empresas/empresas.component').then((m) => m.EmpresasComponent)
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./pages/clientes/clientes.component').then((m) => m.ClientesComponent)
      },
      {
        path: 'socios',
        loadComponent: () =>
          import('./pages/socios/socios.component').then((m) => m.SociosComponent)
      },
      {
        path: 'proyectos',
        loadComponent: () =>
          import('./pages/proyectos/proyectos.component').then((m) => m.ProyectosComponent)
      },
      {
        path: 'lotes',
        loadComponent: () =>
          import('./pages/lotes/lotes.component').then((m) => m.LotesComponent)
      },
      {
        path: 'proformas',
        loadComponent: () =>
          import('./pages/proformas/proformas.component').then((m) => m.ProformasComponent)
      },
      {
        path: 'parametros-comision',
        loadComponent: () =>
          import('./pages/parametros-comision/parametros-comision.component').then(
            (m) => m.ParametrosComisionComponent
          )
      },
      {
        path: 'ventas',
        loadComponent: () =>
          import('./pages/ventas/ventas.component').then((m) => m.VentasComponent)
      },
      {
        path: 'separaciones',
        loadComponent: () =>
          import('./pages/separaciones/separaciones.component').then(
            (m) => m.SeparacionesComponent
          )
      },
      {
        path: 'comisiones',
        loadComponent: () =>
          import('./pages/comisiones/comisiones.component').then((m) => m.ComisionesComponent)
      },
      {
        path: 'liquidaciones',
        loadComponent: () =>
          import('./pages/liquidaciones/liquidaciones.component').then(
            (m) => m.LiquidacionesComponent
          )
      },
      {
        path: 'comprobantes',
        loadComponent: () =>
          import('./pages/comprobantes/comprobantes.component').then(
            (m) => m.ComprobantesComponent
          )
      }
    ]
  },

  // ── Redirección inicial según rol ─────────────────────────────────
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' }
];
