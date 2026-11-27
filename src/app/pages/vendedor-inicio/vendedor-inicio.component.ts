import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TokenService } from '../../auth/token.service';

@Component({
  selector: 'app-vendedor-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './vendedor-inicio.component.html',
  styleUrl: './vendedor-inicio.component.scss'
})
export class VendedorInicioComponent {

  readonly nombreUsuario: string;
  readonly esAsociado: boolean;
  readonly esJefe: boolean;

  constructor(tokenService: TokenService) {
    this.nombreUsuario = tokenService.getNombreCompleto() || 'Vendedor';
    this.esAsociado = tokenService.esAsociado();
    this.esJefe = tokenService.esVendedorJefe();
  }
}
