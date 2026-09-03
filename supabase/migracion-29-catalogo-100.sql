-- =============================================================
-- MIGRACIÓN 29 — el catálogo pasa de 31 a 100 ejercicios
--
-- Va DESPUÉS de la 28. Ejecutar entera en el SQL Editor de Supabase.
--
-- Es ADITIVA y no rompe nada: solo inserta filas nuevas en un catálogo de
-- solo lectura. Se puede correr antes o después del deploy; si va antes, el
-- cliente viejo simplemente muestra más opciones en el selector.
-- =============================================================

-- -------------------------------------------------------------
-- POR QUÉ 100 Y NO 31
-- -------------------------------------------------------------
-- El contador de series pregunta "¿qué estás haciendo?" y con 31 opciones la
-- respuesta honesta era muchas veces "eso no está". Un selector que no tiene
-- lo que hacés te enseña a no usarlo, y el contador deja de servir.
--
-- LO QUE NO CAMBIA: `cuenta_dots` sigue en TRES —sentadilla, press de banca y
-- peso muerto—. El catálogo grande es para CONTAR SERIES; la fuerza se mide
-- con la fórmula de siempre, calibrada sobre esos tres. Sumarle ejercicios al
-- DOTS no lo haría más completo, lo invalidaría (§16.3).
--
-- EL ORDEN es lo que agrupa: cada grupo muscular tiene su centena (piernas
-- 100, pecho 200, espalda 300, hombros 400, brazos 500, core 600) y el
-- selector ordena por `orden`, así que los de un mismo grupo salen juntos sin
-- que haga falta ordenar por nombre ni por grupo.
--
-- NO HAY CARDIO. El contador cuenta SERIES; veinte minutos de caminadora no
-- son cuatro series de nada. Meterlo obligaría a que una fila signifique dos
-- cosas distintas según lo que tenga al lado.

insert into public.ejercicios (id, nombre, grupo, cuenta_dots, orden) values
  -- piernas -----------------------------------------------------
  ('sentadilla_bulgara',    'Sentadilla búlgara',          'piernas', false, 111),
  ('sentadilla_goblet',     'Sentadilla goblet',           'piernas', false, 112),
  ('sentadilla_hack',       'Sentadilla hack',             'piernas', false, 113),
  ('sentadilla_smith',      'Sentadilla en multipower',    'piernas', false, 114),
  ('peso_muerto_sumo',      'Peso muerto sumo',            'piernas', false, 121),
  ('peso_muerto_rigidas',   'Peso muerto piernas rígidas', 'piernas', false, 122),
  ('peso_muerto_una_pierna','Peso muerto a una pierna',    'piernas', false, 123),
  ('buenos_dias',           'Buenos días',                 'piernas', false, 124),
  ('prensa_una_pierna',     'Prensa a una pierna',         'piernas', false, 131),
  ('zancadas_caminando',    'Zancadas caminando',          'piernas', false, 151),
  ('zancada_inversa',       'Zancada inversa',             'piernas', false, 152),
  ('subida_cajon',          'Subida al cajón',             'piernas', false, 153),
  ('curl_femoral_pie',      'Curl femoral de pie',         'piernas', false, 171),
  ('gemelos_sentado',       'Gemelos sentado',             'piernas', false, 181),
  ('gemelos_prensa',        'Gemelos en prensa',           'piernas', false, 182),
  ('aductores',             'Aductores en máquina',        'piernas', false, 191),
  ('abductores',            'Abductores en máquina',       'piernas', false, 192),
  ('puente_gluteo',         'Puente de glúteos',           'piernas', false, 193),
  ('patada_gluteo',         'Patada de glúteo en polea',   'piernas', false, 194),
  -- pecho -------------------------------------------------------
  ('press_declinado',       'Press declinado',             'pecho',   false, 211),
  ('press_inclinado_mancuernas','Press inclinado con mancuernas','pecho', false, 221),
  ('press_pecho_maquina',   'Press de pecho en máquina',   'pecho',   false, 222),
  ('cruce_polea_alta',      'Cruces en polea alta',        'pecho',   false, 231),
  ('cruce_polea_baja',      'Cruces en polea baja',        'pecho',   false, 232),
  ('pec_deck',              'Contractora (pec deck)',      'pecho',   false, 233),
  ('flexiones',             'Flexiones de brazos',         'pecho',   false, 241),
  ('pullover',              'Pullover con mancuerna',      'pecho',   false, 251),
  -- espalda -----------------------------------------------------
  ('dominadas_supinas',     'Dominadas supinas',           'espalda', false, 311),
  ('dominadas_lastradas',   'Dominadas con lastre',        'espalda', false, 312),
  ('remo_invertido',        'Remo invertido',              'espalda', false, 313),
  ('remo_pendlay',          'Remo Pendlay',                'espalda', false, 321),
  ('remo_t',                'Remo en T',                   'espalda', false, 322),
  ('remo_maquina',          'Remo en máquina',             'espalda', false, 331),
  ('remo_unilateral_polea', 'Remo unilateral en polea',    'espalda', false, 332),
  ('jalon_cerrado',         'Jalón con agarre cerrado',    'espalda', false, 341),
  ('jalon_unilateral',      'Jalón unilateral',            'espalda', false, 342),
  ('pullover_polea',        'Pullover en polea',           'espalda', false, 351),
  ('rack_pull',             'Rack pull',                   'espalda', false, 361),
  ('hiperextensiones',      'Hiperextensiones',            'espalda', false, 362),
  -- hombros -----------------------------------------------------
  ('press_militar_mancuernas','Press militar con mancuernas','hombros', false, 411),
  ('press_hombro_maquina',  'Press de hombro en máquina',  'hombros', false, 412),
  ('elevaciones_frontales', 'Elevaciones frontales',       'hombros', false, 431),
  ('elevaciones_polea',     'Elevaciones laterales en polea','hombros',false, 432),
  ('elevaciones_maquina',   'Elevaciones laterales en máquina','hombros',false,433),
  ('face_pull',             'Face pull',                   'hombros', false, 441),
  ('remo_menton',           'Remo al mentón',              'hombros', false, 442),
  ('rotacion_externa',      'Rotación externa',            'hombros', false, 443),
  ('encogimientos',         'Encogimientos',               'hombros', false, 451),
  -- brazos ------------------------------------------------------
  ('curl_predicador',       'Curl predicador',             'brazos',  false, 511),
  ('curl_inclinado',        'Curl inclinado',              'brazos',  false, 521),
  ('curl_concentrado',      'Curl concentrado',            'brazos',  false, 522),
  ('curl_polea',            'Curl en polea',               'brazos',  false, 523),
  ('curl_barra_z',          'Curl con barra Z',            'brazos',  false, 524),
  ('curl_muneca',           'Curl de muñeca',              'brazos',  false, 531),
  ('press_cerrado',         'Press de banca agarre cerrado','brazos', false, 541),
  ('triceps_mancuerna',     'Extensión de tríceps con mancuerna','brazos',false,542),
  ('triceps_sobre_cabeza',  'Tríceps sobre la cabeza en polea','brazos',false, 551),
  ('patada_triceps',        'Patada de tríceps',           'brazos',  false, 552),
  ('fondos_banco',          'Fondos en banco',             'brazos',  false, 553),
  ('triceps_maquina',       'Tríceps en máquina',          'brazos',  false, 554),
  -- core --------------------------------------------------------
  ('plancha',               'Plancha',                     'core',    false, 601),
  ('plancha_lateral',       'Plancha lateral',             'core',    false, 602),
  ('crunch',                'Crunch',                      'core',    false, 611),
  ('elevacion_piernas',     'Elevación de piernas colgado','core',    false, 613),
  ('elevacion_rodillas',    'Elevación de rodillas',       'core',    false, 614),
  ('giros_rusos',           'Giros rusos',                 'core',    false, 621),
  ('bicicleta_abdominal',   'Abdominales bicicleta',       'core',    false, 622),
  ('dead_bug',              'Dead bug',                    'core',    false, 623),
  ('press_pallof',          'Press Pallof',                'core',    false, 624)
on conflict (id) do nothing;
