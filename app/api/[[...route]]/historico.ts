import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { supabaseHistorico } from '@/app/_lib/supabaseHistorico';

const historicoQuerySchema = z.object({
  ids_productos: z.string().transform((val) => val.split(',').filter(Boolean)),
  provincia: z.string(),
});

interface FilaHistoricoSepa {
  periodo: string; // "año-mes-dia"
  id_producto: string;
  precio_promedio_mensual: number;
}

/**
 * Histórico real de precios (tabla `sepa_precios_historico_test`, datos
 * oficiales del SEPA) para un conjunto de productos dentro de una provincia.
 *
 * El dato viene promediado por provincia: ya no hay desglose por cadena
 * (`id_comercio` / `id_bandera` no existen en esta tabla), así que la serie
 * histórica es una sola línea de referencia provincial por producto.
 */
export const historicoRouter = new Hono().get(
  '/historico-precios',
  zValidator('query', historicoQuerySchema),
  async (c) => {
    const { ids_productos, provincia } = c.req.valid('query');
    if (!ids_productos.length) return c.json({ historico: [] });

    const { data, error } = await supabaseHistorico
      .from('sepa_precios_historico_test')
      .select('periodo, id_producto, precio_promedio_mensual')
      .in('id_producto', ids_productos)
      .eq('sucursales_provincia', provincia)
      .order('periodo', { ascending: true });

    if (error) return c.json({ error: error.message }, 500);

    const historico = (data as FilaHistoricoSepa[]) ?? [];
    return c.json({ historico });
  },
);