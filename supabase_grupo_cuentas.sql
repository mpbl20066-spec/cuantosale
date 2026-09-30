-- Ejecutar en el Supabase SQL Editor. Es idempotente: se puede correr de nuevo.
--
-- /grupo sigue funcionando SIN cuenta (el link es la contraseña). Esto suma la
-- posibilidad OPCIONAL de entrar con Google para que los gastos queden a nombre
-- de la persona, y protege de verdad lo que ya tiene dueño con cuenta.
--
--   1) participantes.user_id: a qué cuenta de Google pertenece esa persona.
--      Un gasto pertenece a una persona (participante), así que al vincular la
--      cuenta al participante todos sus gastos pasan a ser de la cuenta, sin
--      tocar los gastos uno por uno. Sirve para quien cargó gastos sin cuenta y
--      entra con Google después.
--   2) gastos.agregado_por: quién cargó el gasto (distinto de quién pagó). Los
--      gastos viejos no lo tienen: para esos manda quien pagó.
--   3) grupo_reclamar_participante(): vincula una persona del grupo con la
--      cuenta que está logueada. Solo si esa persona no tiene cuenta todavía y
--      la cuenta no tiene ya otra persona en el mismo grupo.
--   4) Borrar un gasto: si su dueño tiene cuenta, solo puede hacerlo esa cuenta. Si el dueño no tiene cuenta, sigue abierto (modelo del link):
--      ahí la regla "solo borra los tuyos" la aplica la pantalla.

-- ---------------------------------------------------------------------------
-- 1) y 2) columnas
-- ---------------------------------------------------------------------------
alter table public.participantes
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Una cuenta no puede ser dos personas en el mismo grupo.
create unique index if not exists participantes_grupo_user_uidx
  on public.participantes (grupo_id, user_id)
  where user_id is not null;

alter table public.gastos
  add column if not exists agregado_por uuid references public.participantes(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Nadie puede crear una persona "a nombre" de otra cuenta
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone with the link can join a group" on public.participantes;
create policy "Anyone with the link can join a group"
  on public.participantes for insert
  with check (user_id is null or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) vincular la cuenta logueada con una persona del grupo
-- ---------------------------------------------------------------------------
create or replace function public.grupo_reclamar_participante(p_participante uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_grupo uuid;
  v_user  uuid;
begin
  if v_uid is null then return false; end if;

  select grupo_id, user_id into v_grupo, v_user
    from public.participantes where id = p_participante;
  if not found then return false; end if;

  if v_user = v_uid then return true; end if;     -- ya era suya
  if v_user is not null then return false; end if; -- es de otra cuenta

  if exists (select 1 from public.participantes
              where grupo_id = v_grupo and user_id = v_uid) then
    return false; -- esta cuenta ya es otra persona de este grupo
  end if;

  update public.participantes set user_id = v_uid
   where id = p_participante and user_id is null;
  return found;
end;
$$;

revoke all on function public.grupo_reclamar_participante(uuid) from public;
grant execute on function public.grupo_reclamar_participante(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) borrar un gasto (editar la division queda como estaba: abierto)
--    Dueño = quien lo agregó; en los gastos viejos, quien pagó.
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone with the link can delete an expense" on public.gastos;
drop policy if exists "Delete an expense unless its owner has an account" on public.gastos;
create policy "Delete an expense unless its owner has an account"
  on public.gastos for delete
  using (not exists (
    select 1 from public.participantes p
     where p.id = coalesce(gastos.agregado_por, gastos.paid_by_participante_id)
       and p.user_id is not null
       and p.user_id is distinct from auth.uid()
  ));
