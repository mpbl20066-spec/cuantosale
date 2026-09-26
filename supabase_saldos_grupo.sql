-- Marcar transferencias como pagadas en /grupo/:id.
--
-- La columna "saldos" guarda los pares ya pagados como ["quien|quien"]. Se
-- elige el par y no el importe a propósito: el greedy que arma las
-- transferencias recalcula los montos cada vez que se agrega o borra un gasto,
-- así que una marca atada al importe se perdería al día siguiente.
--
-- Es idempotente: se puede correr las veces que haga falta.

alter table public.grupos_viaje
  add column if not exists saldos jsonb not null default '[]'::jsonb;

-- Sin este update el "Ya pagué" rebota con permission denied: la tabla solo
-- tenía select e insert.
drop policy if exists "Anyone with the link can update a group" on public.grupos_viaje;
create policy "Anyone with the link can update a group"
  on public.grupos_viaje for update using (true) with check (true);

grant update on public.grupos_viaje to anon, authenticated;
