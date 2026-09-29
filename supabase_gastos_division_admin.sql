-- Ejecutar en el Supabase SQL Editor. Es idempotente: se puede correr de nuevo.
--
-- Trae dos cosas que la pagina de /grupo necesita y la base no tenia:
--   1) poder editar la division de un gasto ya cargado (entre quienes se
--      divide), y
--   2) un admin, que es la persona que creo el grupo.
--
-- Sobre el alcance de (2): gastos y participantes siguen con el modelo de "el
-- link del grupo es la contraseña" (RLS abierta a anon, ver la nota de
-- grupos_viaje en supabase.sql). El "solo borra los tuyos" es una regla de la
-- pantalla, NO una frontera de seguridad: alguien con el link y la API a mano
-- puede seguir borrando lo que quiera. Convertirlo en frontera real exige
-- autenticar al participante y atar update/delete a su user_id, que es otra
-- decision y otro cambio aparte.

-- ---------------------------------------------------------------------------
-- 1) Editar la division de un gasto
--
-- La app nunca actualizo un gasto: los permisos de gastos eran
-- select/insert/delete, sin update. Por eso la fila no se podia tocar una vez
-- guardada, y no habia forma de corregir entre quienes se dividia.
-- El alcance es el mismo que el delete, que ya es "cualquiera con el link":
-- la regla de quien puede tocar que fila la aplica la pagina.
-- ---------------------------------------------------------------------------
alter table public.gastos enable row level security;

drop policy if exists "Anyone with the link can edit an expense" on public.gastos;
create policy "Anyone with the link can edit an expense"
  on public.gastos for update
  using (true) with check (true);

grant select, insert, update, delete on public.gastos to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) El admin es quien creo el grupo
--
-- No habia columna para eso. grupos_viaje.creator_user_id existe pero no
-- servia: la app crea el grupo con solo el nombre (grupo.js, renderCreateForm)
-- y nunca escribe ese campo, asi que siempre quedo en NULL. Y aunque se
-- escribiera, es un id de auth.users y el grupo se puede crear sin sesion.
--
-- El admin va en participantes, no en el grupo: la app inserta la fila del
-- creador en el mismo acto del alta (inmediatamente despues del insert del
-- grupo), asi que es el unico dato que ya existe sin loguearse a nadie.
-- ---------------------------------------------------------------------------
alter table public.participantes add column if not exists es_admin boolean not null default false;

-- Los grupos ya creados no tienen la marca, asi que se le pone al primero que
-- se sumo en cada uno. El desempate por id es para que dos altas con el mismo
-- joined_at no dejen a un grupo sin admin.
update public.participantes p
set es_admin = true
where not p.es_admin
  and not exists (
    select 1
    from public.participantes q
    where q.grupo_id = p.grupo_id
      and (q.joined_at, q.id) < (p.joined_at, p.id)
  );
