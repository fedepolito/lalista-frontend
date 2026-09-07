export interface ProductoChanguito {
  id: string;
  nombre: string;
  urlImagen: string | null;
  cantidad: number;
}

export interface SupermercadoChanguito {
  clave: string;
  idComercio: number;
  idBandera: number;
  cadena: string;
  direccion: string;
}

export interface PuntoMensual {
  mes: string; // 'YYYY-MM'
  precioTotal: number;
  /** Cuántos productos del changuito se encontraron en ese supermercado ese
   * mes. Sin esto, un supermercado al que le faltan productos parece más
   * barato que el resto solo porque suma menos cosas. Opcional: los
   * changuitos guardados antes de este cambio no lo tienen. */
  productosEncontrados?: number;
}

export interface HistorialSupermercado {
  clave: string;
  puntos: PuntoMensual[];
}

export interface Changuito {
  id: string;
  nombre: string;
  fechaInicio: string;
  productos: ProductoChanguito[];
  supermercados: SupermercadoChanguito[];
  historialPorSupermercado: HistorialSupermercado[];
}