-- Lectura para el respaldo diario (lib/respaldo.js). Correr una vez en Supabase: SQL Editor -> pegar esto -> Run.
--
-- Estas tablas las usa la web con la sesion del usuario (RLS para anon/authenticated) y nunca le habian dado
-- permiso a la service role, asi que el respaldo no las podia leer (HTTP 403). Solo select: el respaldo no escribe.
-- No cambia nada de lo que ve cada usuario: la service role la usa solo el server.

grant select on public.agencia, public.gastos, public.grupos_viaje, public.participantes, public.reservas_hoteles,
  public.reservas_viaje, public.user_trips, public.waitlist to service_role;
