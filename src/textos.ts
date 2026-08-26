// TODO el texto que ve el usuario, en un solo lugar.
//
// POR QUÉ: la mitad de los pedidos son cambios de texto, y antes había que
// cazarlos entre treinta y un archivos. Acá "cambiá esto por aquello" es una
// línea.
//
// Es un OBJETO y no una función `t('clave')` a propósito: así TypeScript
// autocompleta y una clave mal escrita no compila. Con `t()` y claves de texto
// suelto, un error de tipeo se descubre en pantalla.
//
// Para el inglés (después de migrar a nativo): esto pasa a ser `es` y se
// agrega `en` con la misma forma; el tipo de uno obliga al otro a estar
// completo, así que no se puede olvidar una clave. No hace falta nada más:
// ningún componente cambia.
//
// Las que llevan datos adentro son funciones, no plantillas: `faltaPara(8)` en
// vez de pegar el número al string. Cuando haya inglés, el orden de las
// palabras cambia y una plantilla no lo soporta.
//
// NO importa nada, como `reglas.ts`, para que `test:db` pueda cargarlo.

export const T = {
  // ---------------------------------------------------------------
  general: {
    guardar: 'Guardar',
    volver: '← Volver',
    cancelar: 'Cancelar',
    noSePudo: 'No se pudo guardar. Probá de nuevo.',
    noSePudoGenerico: 'No se pudo. Probá de nuevo.',
  },

  // ---------------------------------------------------------------
  inicio: {
    racha: 'Racha',
    registrarDia: 'Registrar día',
    diaRegistrado: 'Día registrado',
    iniciarEntrenamiento: 'Iniciar entrenamiento',
    vacio: 'Todavía no hay nada acá.\nRegistrá tu primer día y algo se empieza a formar.',
  },

  // ---------------------------------------------------------------
  fuerza: {
    titulo: 'Fuerza',
    misMarcas: 'Mis marcas',
    anotarMarca: 'Anotar una marca',
    lasTresQueCuentan: 'Las tres que cuentan',
    entreAmigos: 'Entre amigos',
    dondeEstoy: 'Dónde estoy',

    // §16.8. "Strength Level 2026, gente que anota en apps, no competidores"
    // era exacto y no significaba nada para quien lo lee: nombra una fuente
    // que nadie conoce y define la población por lo que NO es.
    contraQuien: 'Comparado con gente que va al gimnasio de forma constante.',
    verEnAjustes: 'Cómo se compara',

    soloVosLoVes: (banda: string) => `Solo vos lo ves. Tus amigos ven: ${banda}.`,
    faltaPara: (peso: string) => `Te faltan ${peso} para principiante`,
    faltaParaUno: (peso: string) => `Te falta ${peso} para principiante`,

    muestraFina:
      'La muestra de mujeres es mucho más chica que la de hombres: tomá el porcentaje como una orientación, no como una medición.',
    fueraDeTabla:
      'Tu peso corporal queda fuera de la tabla, así que se compara contra el extremo más cercano.',

    // Una línea y un link: la explicación larga vive en Ajustes, donde el que
    // la busca la encuentra y el que no, no la tropieza.
    porQueTres: 'Son estos tres porque son los que se comparan.',

    faltanMarcas: 'Faltan marcas: el número sale de las tres, y con dos no se compara con nada.',
    faltaSexo: 'Para el número falta cargar el sexo en',
    faltaSexoFin: '. La fórmula usa dos juegos de coeficientes y no se asume ninguno.',
    faltaPeso: 'Falta tu peso corporal, que se anota en',
    faltaPesoFin: '. Solo lo ves vos.',
    sinNada:
      'Sentadilla, banca y peso muerto arman un número comparable con el de tus amigos, pese lo que pese cada uno.',
  },

  // ---------------------------------------------------------------
  ajustes: {
    titulo: 'Ajustes',

    diasDescanso: 'Días de descanso',
    diasDescansoNota: 'Esos días podés faltar sin perder la racha.',

    corregirDias: 'Corregir días',

    descansoEntreSeries: 'Descanso entre series',
    descansoNota: 'Mientras descansás lo podés cambiar ahí mismo.',
    sonidoPrendido: 'Sonido al terminar ✓',
    sonidoApagado: 'Sonido al terminar — apagado',
    vibra: 'Vibra al terminar, con la app abierta. Si la cerrás, no avisa.',
    noVibra: 'Tu teléfono no vibra desde la web: el aviso es visual, con la app abierta.',
    sonidoRespeta: 'El sonido suena por encima de tu música, sin cortarla.',
    sonidoCorta: 'Ojo: en algunos teléfonos el sonido puede pausarte la música un instante.',

    gimnasio: 'Mi gimnasio',
    gimnasioMarcar: 'Marcar el punto',
    gimnasioRemarcar: 'Volver a marcar el punto',
    gimnasioBuscando: 'Buscando…',
    gimnasioBorrar: 'Borrar el punto',
    gimnasioComo: 'Marcalo parado en la puerta de tu gimnasio.',
    gimnasioParaQue: 'Después, abrir la app estando ahí registra el día sin que aprietes nada.',
    gimnasioListo: (metros: number) => `Listo, con ${metros} m de precisión.`,
    gimnasioPuesto: 'Ya está marcado. Nadie más lo ve: no se comparte con tus amigos.',
    gimnasioSinGps: 'Este teléfono no da la ubicación.',
    gimnasioSinPermiso:
      'No se pudo leer la ubicación. Fijate que le hayas dado permiso a la app.',

    nombreUsuario: 'Nombre de usuario',
    nombreNota: 'Así te encuentran tus amigos. No puede repetirse.',
    nombreListo: 'Listo, ese es tu nombre ahora.',

    fotosNuevas: 'Quién ve tus fotos nuevas',
    fotosNota: 'Cada foto se puede cambiar después, una por una.',
    soloYo: 'Solo yo',
    amigos: 'Amigos',

    peso: 'Peso',
    kilos: 'Kilos',
    libras: 'Libras',

    sexo: 'Sexo — solo para el DOTS',
    sinCargar: 'Sin cargar',
    mujer: 'Mujer',
    hombre: 'Hombre',
    sexoNota: 'Sin esto no hay DOTS. El resto de tus marcas anda igual.',
    sexoAviso: 'Ojo: con el DOTS puesto, tus amigos pueden deducir más o menos cuánto pesás.',

    sugerencias: 'Sugerencias',
    sugerenciasPlaceholder: '¿Algo anda mal? ¿Se te ocurrió algo? Contá acá.',
    mandar: 'Mandar',
    sugerenciaEnviada: 'Gracias. Llegó.',

    instalar: 'Instalar',
    instalarNota: 'Desde el menú del navegador podés agregar Ascent a la pantalla de inicio.',

    misDatos: 'Mis datos',
    exportar: 'Exportar mis datos',
    exportarNota: 'Todo tu historial, en un archivo.',

    verGuia: 'Volver a ver la guía',
    cambiarClave: 'Cambiar contraseña',
    cerrarSesion: 'Cerrar sesión',
    eliminarCuenta: 'Eliminar mi cuenta',

    comoSeCompara: 'Cómo se compara la fuerza',
  },

  // ---------------------------------------------------------------
  stats: {
    titulo: 'Stats',
    globo: 'Constancia, historial y tu peso. El peso no lo ve nadie más.',
    rachaActual: 'Racha actual',
    mejorRacha: 'Mejor racha',
    ultimos30: 'Últimos 30 días',
    esteMes: 'Este mes',
    elAno: 'El año',
    sesiones: 'Sesiones',
    promedio: 'Promedio',
    totalEn: (n: number) => `Total en ${n} sesiones`,
    sinDuracion: 'Todavía ninguna con duración.',
    fueraDelPromedio: (que: string) => `Fuera del promedio: ${que}. Los días cuentan igual.`,
    peso: 'Peso',
    pesoTendencia: 'Peso — tendencia 7 días',
    pesoUnoMas: 'Con uno más aparece la tendencia. Solo la ves vos.',
    pesoVacio: 'Anotalo al registrar el día y acá aparece la tendencia. Solo la ves vos.',
    laEscalera: 'La escalera',
    acaEstas: 'acá estás',
  },

  // ---------------------------------------------------------------
  descanso: {
    saltar: 'Saltar',
    cerrar: 'Cerrar',
    terminado: '¡Dale!',
  },

  // ---------------------------------------------------------------
  sesion: {
    series: (n: number) => (n === 1 ? '1 serie' : `${n} series`),
    sumarSerie: 'Sumar una serie',
    quitarSerie: 'Quitar una serie',
    terminar: 'Terminar',
    sumarFoto: 'Sumar foto',
    sumarPeso: 'Sumar peso',
  },

  // ---------------------------------------------------------------
  album: {
    titulo: 'Álbum',
    vacio: 'Todavía no hay fotos.',
  },

  // ---------------------------------------------------------------
  social: {
    titulo: 'Ranking',
    amigos: 'Amigos',
    buscarGente: 'Buscar gente',
    sumarAmigo: 'Sumar un amigo',
  },

  // ---------------------------------------------------------------
  yo: {
    misFotos: 'Qué fotos ven tus amigos',
    sumarFotos: 'Sumar fotos acá',
  },
} as const;
