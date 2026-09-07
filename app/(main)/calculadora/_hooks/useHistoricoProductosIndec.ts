'use client';

import { useEffect, useMemo, useState } from 'react';
import { obtenerHistoricoCompletoIndec } from '../_lib/indec';
import { buscarCoincidenciaIndec } from '../_lib/indecProductos';
import type { Changuito } from '../_types/changuito';
import type { SerieInflacion } from '../_types/inflacion';

const COLORES = [
  'var(--color-accent-600)',
  'var(--color-orange-500)',
  'var(--color-primary-400)',
  'var(--color-sky-600)',
];

interface ProductoConCoincidencia {
  productoId: string;
  nombreProducto: string;
  nombreGenerico: string;
  serieId: string;
  aclaracion?: string;
}

/** Recorta una serie a un rango de meses ("YYYY-MM") y la recalcula para
 * que el primer mes del recorte sea la base 0%. Sin esto, el porcentaje
 * seguiría midiéndose contra 2016 y no se podría comparar con el SEPA. */
function recortarYRebasar(
  puntos: { fecha: string; porcentaje: number }[],
  mesDesde: string,
  mesHasta: string,
) {
  const dentro = puntos.filter((p) => {
    const mes = p.fecha.slice(0, 7);
    return mes >= mesDesde && mes <= mesHasta;
  });
  if (!dentro.length) return [];

  // El porcentaje viene acumulado desde 2016. Para rebasar al primer mes
  // del recorte usamos el índice implícito: (1 + p/100) / (1 + base/100).
  const base = 1 + dentro[0].porcentaje / 100;
  return dentro.map((p) => ({
    fecha: p.fecha,
    porcentaje: Math.round(((1 + p.porcentaje / 100) / base - 1) * 100 * 10) / 10,
  }));
}

/** Para cada producto del changuito, busca si el INDEC publica un genérico
 * parecido (aceite de girasol, arroz blanco simple, etc.) y trae su
 * historia — recortada al mismo rango de meses que el histórico SEPA
 * cuando se le pasa `rango`, para que los dos gráficos sean comparables. */
export function useHistoricoProductosIndec(
  changuito: Changuito | null,
  rango?: { desde: string; hasta: string } | null,
) {
  const coincidencias = useMemo<ProductoConCoincidencia[]>(() => {
    if (!changuito) return [];
    return changuito.productos
      .map((p): ProductoConCoincidencia | null => {
        const match = buscarCoincidenciaIndec(p.nombre);
        if (!match) return null;
        return {
          productoId: p.id,
          nombreProducto: p.nombre,
          nombreGenerico: match.nombreGenerico,
          serieId: match.serieId,
          ...(match.aclaracion ? { aclaracion: match.aclaracion } : {}),
        };
      })
      .filter((x): x is ProductoConCoincidencia => x !== null);
  }, [changuito]);

  const [seriesCompletas, setSeriesCompletas] = useState<SerieInflacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coincidencias.length) {
      setSeriesCompletas([]);
      return;
    }
    let vigente = true;
    setCargando(true);
    setError(null);

    Promise.all(
      coincidencias.map((c) =>
        obtenerHistoricoCompletoIndec(c.serieId).then((puntos) => ({ ...c, puntos })),
      ),
    )
            .then((resultados) => {
        if (!vigente) return;

        // Varios productos del changuito pueden matchear la MISMA categoría
        // del INDEC (tres aceites distintos → "Aceite de girasol"). Agrupamos
        // por serieId para dibujar una sola línea por categoría, en vez de
        // superponer la misma curva varias veces con etiquetas repetidas.
        const porCategoria = new Map<string, { nombre: string; puntos: typeof resultados[0]['puntos']; productos: string[] }>();
        for (const r of resultados) {
          const actual = porCategoria.get(r.serieId);
          if (actual) {
            actual.productos.push(r.productoId);
          } else {
            porCategoria.set(r.serieId, {
              nombre: r.nombreGenerico,
              puntos: r.puntos,
              productos: [r.productoId],
            });
          }
        }

        setSeriesCompletas(
          Array.from(porCategoria.entries()).map(([serieId, cat], i) => ({
            id: serieId,
            nombre: cat.nombre,
            color: COLORES[i % COLORES.length],
            estiloLinea: 'solido' as const,
            puntos: cat.puntos,
            visible: true,
          })),
        );
      })
      .catch((err: unknown) => {
        if (!vigente) return;
        setError(err instanceof Error ? err.message : 'No se pudo cargar el histórico del INDEC');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
    // `coincidencias` es un array nuevo en cada render — comparamos por su
    // "firma" (los productoId que matchean) para no repetir el fetch de más.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coincidencias.map((c) => c.productoId).join(',')]);

  // El recorte se hace acá y no en el fetch: así, si cambia el rango del
  // SEPA, no hay que volver a pedirle nada al INDEC.
  const series = useMemo(() => {
    if (!rango) return seriesCompletas;
    return seriesCompletas
      .map((s) => ({ ...s, puntos: recortarYRebasar(s.puntos, rango.desde, rango.hasta) }))
      .filter((s) => s.puntos.length > 0);
  }, [seriesCompletas, rango?.desde, rango?.hasta]);

    // productoId -> serieId de su categoría INDEC. Como ahora las series se
  // agrupan por categoría (varios productos pueden compartir una), esto
  // permite encontrar la línea que le corresponde a un producto puntual.
  const categoriaPorProducto = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of coincidencias) mapa.set(c.productoId, c.serieId);
    return mapa;
  }, [coincidencias]);

  return {
    series,
    cargando,
    error,
    categoriaPorProducto,
    // Productos que matchearon con aclaración (para mostrar el aviso de "aproximado").
    aclaraciones: coincidencias.filter((c) => c.aclaracion),
  };
}