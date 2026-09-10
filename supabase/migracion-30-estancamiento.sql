-- =============================================================
-- MIGRACIÓN 30 — el detector de estancamiento: sus dos ajustes
--
-- Va DESPUÉS de la 29. Ejecutar entera en el SQL Editor de Supabase.
--
-- ADITIVA: dos columnas con valor por omisión y sus permisos. Se puede correr
-- antes o después del deploy. Si va después, el detector usa el valor por
-- omisión de la app hasta que las columnas existan (la pantalla pide
-- `select *`, así que una columna que todavía no está no rompe nada).
-- =============================================================

-- -------------------------------------------------------------
-- POR QUÉ ESTO VIVE EN LA CUENTA Y NO EN EL APARATO
-- -------------------------------------------------------------
-- El fondo del espacio se guarda por aparato porque es una pregunta sobre el
-- aparato: este teléfono lo aguanta o no. Cada cuánto querés que te avisen de
-- un estancamiento es una pregunta sobre TU entrenamiento, y la respuesta es
-- la misma en el teléfono y en la computadora. Guardarla local haría que
-- cambiar de aparato te devuelva avisos que ya habías apagado.

-- El umbral: 3, 6 u 8 semanas. Por omisión 6.
--
-- El de la propuesta era 8 y se queda como opción, no como valor por omisión:
-- ocho semanas son dos meses, y para el que entrena tres veces por semana el
-- aviso llega cuando ya lo sabía. Tres es para quien está empujando de verdad
-- y a alguien en mantenimiento le daría la lata. Seis es el que sirve sin
-- convertirse en ruido, y los otros dos están a un toque.
alter table public.profiles
  add column if not exists umbral_estancamiento int not null default 6
    check (umbral_estancamiento in (3, 6, 8));

-- Y el interruptor para no ver ninguno.
--
-- No es un "por las dudas": un aviso que no se puede apagar deja de ser un
-- aviso y pasa a ser una condición de uso. El que lo apaga no pierde nada más
-- —el módulo de fuerza sigue igual—, y el que lo deja prendido sabe que
-- eligió tenerlo.
alter table public.profiles
  add column if not exists avisos_estancamiento boolean not null default true;

-- Los dos son preferencias del dueño y no afectan a nadie más, así que se
-- escriben directo, igual que la unidad de peso. Se re-otorga la lista entera
-- porque `grant update (columnas)` REEMPLAZA lo otorgado antes: sumar una
-- columna sola dejaría sin permiso a las otras nueve.
grant update (username, avatar_url, visibilidad_default, unidad_peso, sexo,
              duracion_descanso, gimnasio_lat, gimnasio_lon, gimnasio_radio,
              umbral_estancamiento, avisos_estancamiento)
  on public.profiles to authenticated;
