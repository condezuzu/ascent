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
//
// Desde `src/lib` se importa CON extensión (`from '../textos.ts'`) y no con
// el alias `@/`: `test:db` carga esos archivos con node pelado, que no conoce
// el alias ni resuelve especificadores sin extensión. Desde los componentes,
// que solo los arma el bundler, va `@/textos` como todo lo demás.
//
// LO QUE NO VIVE ACÁ, a propósito: los nombres de los rangos (`rangos.ts`) y
// de los planetas (`reglas.ts`) — son el vocabulario de la app, no texto de
// interfaz —, las citas con autor (`frases.ts`), y el artículo largo de
// "Cómo se compara la fuerza", que es texto con formato y ya vive entero en
// su propia pantalla.

export const T = {
  // ---------------------------------------------------------------
  general: {
    entendido: 'Entendido',
    fotos: 'Fotos',
    // El huso para escribir horas. Cambia junto con el idioma.
    locale: 'es-UY',
    guardar: 'Guardar',
    borrar: 'Borrar',
    ajustes: 'Ajustes',
    volver: '← Volver',
    cancelar: 'Cancelar',
    noSePudo: 'No se pudo guardar. Probá de nuevo.',
    noSePudoGenerico: 'No se pudo. Probá de nuevo.',
    // Los avisos de escritura fallada. Todos empiezan igual a propósito: lo
    // que cambia es QUÉ no se guardó, y eso es lo que hay que leer.
    falloFoto: 'No se pudo subir la foto. Seguí conectado y probá de nuevo.',
    falloPreferencia: 'No se pudo guardar ese ajuste. Quedó como estaba.',
    falloVisibilidad: 'No se pudo cambiar quién ve esa foto.',
    falloDescansos: 'No se pudieron guardar tus días de descanso.',
    falloPunto: 'No se pudo borrar el punto del gimnasio.',
  },

  // ---------------------------------------------------------------
  inicio: {
    racha: 'Racha',
    registrarDia: 'Registrar día',
    diaRegistrado: 'Día registrado',
    // EL MOMENTO DE LLEGAR SIN APRETAR NADA. Desde que el día entra por
    // ubicación, el mejor momento de la app pasa en el bolsillo: abrís y ya
    // está. Hasta ahora se veía EXACTAMENTE igual que si lo hubieras apretado
    // vos, que es tirar a la basura lo único que ninguna otra app hace.
    //
    // Se dice una sola vez, el día que pasa, y después vuelve al cartel de
    // siempre. Un mensaje que aparece todos los días deja de ser noticia.
    diaSolo: 'Estabas ahí. El día entró solo.',
    iniciarEntrenamiento: 'Iniciar entrenamiento',
    // Redacción hacia adelante, nunca hacia la pérdida.
    ultimoTramo: (n: number) => `Último tramo para el ${n}.`,
    perdida: 'Se dispersó un poco de masa. Hoy se recupera.',
    hoyDescansa: 'Hoy descansa. La racha sigue igual.',
    diaPendiente: 'Tu día de hoy quedó anotado y se suma solo. No lo perdiste.',
    diaRegistradoSumar: 'Día registrado · sumar foto o peso',
    sumarSerie: 'Sumar una serie',
    masArrancaDescanso: 'Cada + suma la serie y arranca el descanso.',
    // La nota de arriba está debajo del contador y se lee tarde: la primera
    // vez, el + aparece sin ninguna explicación y parece un botón de confirmar.
    // Esto se dice una sola vez, arriba, donde se está mirando.
    globoSeries: 'Tocá el + cuando terminás una serie: la cuenta sube y arranca el descanso solo. El − es para corregir.',
    // Un cronómetro que aparece andando sin que lo hayas tocado se lee como un
    // error de la app. Con una línea deja de serlo.
    sesionSola: 'Arrancó sola cuando llegaste. Se corta al irte, o cuando quieras.',
    yaHabiaSesion: 'Ya tenías una corriendo. Seguimos con esa.',
    diaDeshecho: 'Muy corta para contar como día. Se deshizo.',
    sacarSerie: 'Sacar una serie',
    sigueSubiendo: (nombre: string, dias: string) => `${nombre} sigue subiendo — ${dias}`,
    // Discreto y permanente mientras no haya punto: es el diferencial de la
    // app y vivía escondido en Ajustes.
    gimnasioRecordatorio: 'Tu gimnasio todavía no está marcado. Marcalo y el día entra solo.',
    // Y acá sí se insiste, porque es el único momento en que es probable que
    // la persona esté parada en el gimnasio. NUNCA al empezar la sesión:
    // ahí casi nunca está ahí todavía.
    gimnasioAhora: '¿Estás en el gimnasio ahora?',
    gimnasioAhoraPie: 'Marcá el punto y no lo tenés que hacer nunca más: el día entra solo con abrir la app.',
    gimnasioAhoraNo: 'Ahora no',
    noCargo: 'No se pudieron traer tus datos. Puede ser la conexión.',
    reintentar: 'Reintentar',
    vacioTitulo: 'Todavía no hay nada acá.',
    vacioPie: 'Registrá tu primer día y algo se empieza a formar.',
    vacio: 'Todavía no hay nada acá.\nRegistrá tu primer día y algo se empieza a formar.',
  },

  // ---------------------------------------------------------------
  // Entrar, crear cuenta y elegir nombre.
  entrar: {
    marca: 'Ascent',
    entrar: 'Entrar',
    crearCuenta: 'Crear cuenta',
    enviarCorreo: 'Enviar correo',
    correo: 'Correo',
    contrasena: 'Contraseña',
    o: 'o',
    conGoogle: 'Continuar con Google',
    primeraVez: '¿Primera vez? Crear cuenta',
    olvide: 'Olvidé mi contraseña',
    volverAEntrar: 'Volver a entrar',
    revisaCorreo: 'Listo. Revisá tu correo para confirmar la cuenta.',
    // No se dice si el mail existe: eso filtra quién tiene cuenta.
    siTieneCuenta: 'Si esa dirección tiene cuenta, le llega un correo para cambiar la contraseña.',
    paraRecuperar: 'Te mandamos un enlace para elegir una contraseña nueva.',
    malConfigurada: 'La app no está bien configurada.',
    malConfiguradaDetalle:
      'Faltan o están mal las variables de entorno de Supabase, así que no puede conectarse al servidor. Nada de lo que escribas acá va a funcionar hasta que se arreglen.',

    elegiNombre: 'Elegí tu nombre',
    elegiNombreSub: 'Así te van a encontrar tus amigos.',
    empezar: 'Empezar',
    nombreFormato: 'Entre 3 y 20 caracteres: letras, números o guion bajo.',
  },

  // ---------------------------------------------------------------
  // El recorrido de bienvenida. REGLA DURA: la explicación es genérica — no
  // se nombra ningún rango, ni cuántos hay, ni dónde termina la escalera.
  // Descubrir en qué te vas a convertir es la recompensa del juego.
  guia: {
    saltar: 'Saltar',
    seguir: 'Seguir',
    entendido: 'Entendido',
    pasos: [
      {
        titulo: 'Registrás el día',
        texto: 'Cada vez que vas al gimnasio, lo marcás acá. Un día atrás del otro, eso es tu racha.',
      },
      {
        titulo: 'Y algo se va formando',
        texto: 'Eso que se mueve atrás cambia con tu racha. Hasta dónde llega, lo vas a ver vos.',
      },
      {
        titulo: 'Los descansos no te cortan',
        texto: 'Elegís tus días libres una vez, en Ajustes. Y si igual se te corta, no volvés a cero.',
      },
      // Este paso PRESENTA el punto del gimnasio y no pide nada: acá nadie
      // está en el gimnasio, y pedir algo que no se puede hacer en el momento
      // se despacha con un toque y no se vuelve a pensar nunca.
      {
        titulo: 'Y un día deja de hacer falta',
        texto:
          'Si marcás dónde queda tu gimnasio, abrir la app estando ahí registra el día solo. Se marca desde Ajustes, parado en la puerta.',
      },
    ],
  },

  // ---------------------------------------------------------------
  // Contraseña nueva, desde el correo de recuperación o desde Ajustes.
  clave: {
    titulo: 'Contraseña nueva',
    sub: 'Elegí una de al menos 6 caracteres.',
    nueva: 'Contraseña nueva',
    repetir: 'Repetila',
    corta: 'Mínimo 6 caracteres.',
    noCoinciden: 'Las dos no coinciden.',
    esLaMisma: 'Esa ya es tu contraseña actual.',
    noSePudo: 'No se pudo cambiar. Pedí el correo de nuevo.',
    cambiada: 'Contraseña cambiada.',
    enlaceVencido: 'El enlace ya venció o se abrió en otro navegador.',
    enlaceVencidoPie: 'Pedí uno nuevo desde la pantalla de entrada.',
    irAEntrar: 'Ir a entrar',
  },

  // ---------------------------------------------------------------
  // La guarda de las 20 horas por cambio de zona (§12b). Tiene que decir dos
  // cosas y las dos importan: que el día NO se perdió, y cuándo entra. Un
  // rechazo mudo con la racha en juego se lee como que la app está rota.
  bloqueo: {
    sinHora: 'Tu día quedó anotado y se suma solo en cuanto la app lo pueda confirmar.',
    aLaHora: (hora: string) =>
      `Cambiaste de zona horaria, así que tu día queda anotado y se suma solo a las ${hora}. No lo perdiste.`,
    enMinutos: (min: number) =>
      `Cambiaste de zona horaria, así que tu día queda anotado y se suma solo en ${min} min. No lo perdiste.`,
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

    categorias: {
      principiante: 'Principiante',
      novato: 'Novato',
      intermedio: 'Intermedio',
      avanzado: 'Avanzado',
      elite: 'Élite',
      // Debajo del primer umbral no hay categoría: la fuente no nombra ese tramo.
      arrancando: 'Arrancando',
    },

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

    // El DOTS necesita las TRES. El PORQUÉ vive en Ajustes ("Cómo se compara
    // la fuerza"), donde puede ser largo: el que abre eso lo está buscando.
    // Acá va el hecho y un link, y nada más.
    faltanMarcas: (n: number) => `Con ${n} de 3 todavía no hay número.`,
    yaEstanLasTres: 'Ya están las tres.',
    // Partido en dos porque en el medio va el link a Ajustes.
    faltaSexo: 'Para el número falta cargar el sexo en',
    faltaSexoFin: ': la fórmula usa dos juegos de coeficientes y no se asume ninguno.',
    faltaPeso:
      'Falta tu peso corporal: la fórmula compara levantamientos entre personas de distinto tamaño y sin él no hay número.',

    // En Stats no hay cuántas van cargadas a mano, así que ahí va la corta.
    faltanMarcasCorto: 'Faltan marcas: el número sale de las tres, y con dos no se compara con nada.',
    // Partido en dos porque en el medio va el link a Mis marcas.
    faltaPesoEnMarcas: 'Falta tu peso corporal, que se anota en',
    faltaPesoEnMarcasFin: '. Solo lo ves vos.',
    loDemas: 'Lo demás',
    loDemasNota: 'Anotalas todas las que quieras. Estas no entran al número.',
    ningunaCargada: 'Sentadilla, press de banca y peso muerto. Ninguna cargada todavía.',
    esLaUnica: 'Es la única que anotaste.',
    cuantasAnotaste: (n: number) => `Anotaste ${n}. Vale la mejor.`,
    otraDe: (nombre: string) => `Otra de ${nombre}`,
    vacioTitulo: 'Todavía no cargaste ninguna.',
    vacioPie: 'Sentadilla, banca y peso muerto son las tres que arman tu número.',
    sinNada:
      'Sentadilla, banca y peso muerto arman un número comparable con el de tus amigos, pese lo que pese cada uno.',
  },

  // ---------------------------------------------------------------
  ajustes: {
    titulo: 'Ajustes',

    diasDescanso: 'Días de descanso',
    diasDescansoNota: 'Esos días podés faltar sin perder la racha.',

    calendarioNota: 'Tocá un día para agregarlo o sacarlo. Los días de descanso salen con un guion.',
    corregirDias: 'Corregir días',

    descansoEntreSeries: 'Descanso entre series',
    descansoNota: 'Mientras descansás lo podés cambiar ahí mismo.',
    sonidoPrendido: 'Sonido al terminar ✓',
    sonidoApagado: 'Sonido al terminar — apagado',
    vibra: 'Vibra al terminar, con la app abierta. Si la cerrás, no avisa.',
    noVibra: 'Tu teléfono no vibra desde la web: el aviso es visual, con la app abierta.',
    // Las dos frases decían lo contrario de lo que ahora hace la app: el
    // aviso CORTA la música a propósito, porque con auriculares no se escucha
    // de ninguna otra forma.
    sonidoRespeta: 'Corta tu música el instante que dura el aviso y la deja volver sola.',
    sonidoCorta: 'En este teléfono el sonido puede taparse si tenés música fuerte.',

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
    // No dice "error": dice qué pasó y qué hacer. Marcar el punto con esta
    // precisión guardaría el barrio en vez del gimnasio, y eso no se nota
    // hasta semanas después, cuando los días entran solos desde tu casa.
    gimnasioImpreciso: (metros: number) =>
      `Te ubica con ${metros} m de error, demasiado para marcar el punto acá. Salí a la vereda y probá de nuevo en unos segundos.`,

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
    sugerenciaEnviada: 'Gracias por tu opinión, la leo yo mismo.',

    instalar: 'Instalar',
    instalarBoton: 'Instalar Ascent en este teléfono',
    // Partido en tres porque el nombre del botón de iOS va destacado.
    instalarIOS: 'En iPhone: tocá el botón de compartir en Safari y elegí',
    instalarIOSAccion: '“Agregar a inicio”',
    instalarIOSFin: '. Queda como una app más.',
    instalarNota: 'Desde el menú del navegador podés agregar Ascent a la pantalla de inicio.',

    misDatos: 'Mis datos',
    exportar: 'Exportar mis datos',
    exportarNota: 'Todo tu historial, en un archivo.',

    verGuia: 'Volver a ver la guía',
    cambiarClave: 'Cambiar contraseña',
    cerrarSesion: 'Cerrar sesión',
    eliminarCuenta: 'Eliminar mi cuenta',

    exportando: 'Armando el archivo…',
    exportarError: 'No se pudo armar el archivo. Probá de nuevo.',

    mesAnterior: 'Mes anterior',
    mesSiguiente: 'Mes siguiente',
    mesYAnio: (mes: string, anio: number) => `${mes} ${anio}`,
    diaRegistrado: (dia: number) => `${dia} — registrado, tocá para sacarlo`,
    diaSinRegistrar: (dia: number) => `${dia} — sin registrar, tocá para agregarlo`,
    noSeSaco: 'No se pudo sacar ese día.',
    noSeAgrego: 'No se pudo agregar ese día.',
    recalcular: 'Recalcular racha desde el historial',
    recalculando: 'Recalculando…',
    recalcularError: 'No se pudo recalcular. Probá de nuevo.',
    // `dias` llega ya escrito ("3 días"), no como número: la palabra cambia con
    // el idioma y con el 1.
    recalculoCortado: (dias: string) =>
      `Tu historial da ${dias}: está cortado, así que se aplicó el descuento.`,
    recalculoListo: (dias: string) => `Listo: ${dias}.`,

    nombrePlaceholder: 'nombre_de_usuario',
    nombreFormato: 'Entre 3 y 20 caracteres, solo letras, números y guión bajo.',
    nombreTomado: 'Ese nombre ya está tomado.',

    tuPerfil: 'Tu foto, tus fotos compartidas y tus amigos',

    bajaQueSeBorra: (dias: number) =>
      `Se borra todo: tus ${dias} días de racha, tus fotos, tus pesos, tus marcas y tus amigos. No hay forma de recuperarlo, ni siquiera pidiéndomelo.`,
    // Partido en dos porque en el medio va el nombre en negrita.
    bajaEscribi: 'Si querés seguir, escribí',
    bajaEscribiFin: 'acá abajo.',
    bajaBorrando: 'Borrando…',
    bajaConfirmar: 'Eliminar para siempre',
    mejorNo: 'Mejor no',

    comoSeCompara: 'Cómo se compara la fuerza',

    // El banco de trabajo del automático por ubicación. Se saca cuando esté
    // probado: no es una pantalla de la app.
    diagnostico: 'Diagnóstico',
    diagPunto: 'Punto',
    diagRadio: (m: number) => `marcado, radio ${m} m`,
    diagSinPunto: 'sin marcar',
    diagDia: 'Hoy',
    diagSinDia: 'sin registrar',
    diagSesion: 'Sesión',
    diagSinSesion: 'ninguna corriendo',
    diagDesde: (hora: string) => `desde las ${hora}`,
    diagCola: 'Sin mandar',
    diagColaVacia: 'nada esperando',
    diagColaCon: (n: number) => (n === 1 ? '1 escritura esperando' : `${n} escrituras esperando`),
    diagVaciarCola: 'Mandar lo que quedó',
    diagVisita: 'Visita',
    diagSinVisita: 'ninguna en curso',
    diagLlegada: (hora: string) => `llegaste ${hora}`,
    diagVisto: (hora: string) => `visto ${hora}`,
    diagYaArranco: 'ya arrancó',
    diagMirarAhora: 'Mirar ahora',
    diagMirarNota:
      'Apretalo parado en la puerta: dice a cuántos metros te ve, que es la única forma de saber si el radio quedó bien sin esperar los siete minutos.',
    diagVacia: 'Todavía no hay nada anotado.',
    diagRefrescar: 'Refrescar',
    diagBorrar: 'Borrar lo anotado',
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
    pesoVacio: 'Anotá tu peso y acá aparece la tendencia. Solo la ves vos.',
    sinDuracion_: (n: number) => `${n} sin duración`,
    masCortas: (n: number) => `${n} de menos de 5 min`,
    rachaDe: (dias: string) => `racha de ${dias}`,
    pesoHoy: (valor: string, unidad: string) => `${valor} ${unidad} hoy`,
    diaN: (n: number) => `día ${n}`,
    laEscalera: 'La escalera',
    acaEstas: 'acá estás',
  },

  // ---------------------------------------------------------------
  descanso: {
    saltar: 'Saltar',
    cerrar: 'Cerrar',
    listoPie: 'Listo. Cuando quieras, la que sigue.',
    seguir: 'Seguir',
    terminado: '¡Dale!',
  },

  // ---------------------------------------------------------------
  sesion: {
    seriesPalabra: (n: number) => (n === 1 ? 'serie' : 'series'),
    terminar: 'Terminar',
    label: 'Sesión',
    descansar: 'Descansar',
    listo: 'Listo',
    terminarSesion: 'Terminar sesión',
    guardando: 'Guardando…',
    yaRegistrado: 'El día ya quedó registrado. Solo falta cuánto duró.',
    // Se avisa ANTES de que se cierre sola: enterarse en Stats es tarde.
    seCierraEn: (min: number) => `Se cierra sola en ${min} min y queda sin duración.`,
    yaSeCerro: 'Ya se cerró sola: esta sesión queda sin duración.',
    nuevoRango: 'Nuevo rango',
    sumarFoto: 'Sumar foto',
    sumarPeso: 'Sumar peso',

    // EL RESUMEN DEL FINAL. Terminar un entrenamiento era el momento más
    // vacío de la app: la hoja se cerraba y no pasaba nada. Es el instante de
    // más satisfacción ganada del día y no decía una palabra.
    //
    // Se dicen DOS números y nada más. Ni felicitaciones ni consejos: el
    // mérito ya es de quien entrenó, y una app que aplaude de más se vuelve
    // ruido a la tercera vez.
    resumenTitulo: 'Listo por hoy.',
    resumenMinutos: 'minutos',
    resumenSeries: (n: number) => (n === 1 ? 'serie' : 'series'),
    // Cuando la cerró la salida del gimnasio, no un botón.
    resumenSolo: 'Se cerró cuando saliste.',
    resumenCerrar: 'Cerrar',
  },

  // ---------------------------------------------------------------
  // Idioma puro: nombres de días y meses, y cómo se dice una duración.
  //
  // Los nombres de los RANGOS (Polvo, Asteroide…) y de los planetas viven en
  // `rangos.ts` y `reglas.ts` a propósito: son el vocabulario de la app, no
  // texto de interfaz, y ya están cada uno en un solo lugar. Lo mismo las
  // frases de `frases.ts`, que son citas con autor.
  fechas: {
    diasCortos: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
    diasLargos: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    diasAbreviados: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    meses: [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
    ],
    delMes: (dia: number, mes: string) => `${dia} de ${mes}`,
    hoy: 'Hoy',
    ayer: 'Ayer',
    diaYNumero: (dia: string, n: number) => `${dia} ${n}`,
    // La racha arranca en 1 todo el tiempo, así que el singular aparece
    // seguido y un "1 días" canta enseguida.
    enDias: (n: number) => (n === 1 ? '1 día' : `${n} días`),
    minutos: (n: number) => `${n} min`,
    horas: (n: number) => `${n} h`,
    horasYMinutos: (h: number, m: number) => `${h} h ${m} min`,
    segundos: (n: number) => `${n} s`,
  },

  // ---------------------------------------------------------------
  nav: {
    inicio: 'Inicio',
    // "Ranking" y no "Leaderboard": más corto y en español, como el resto.
    ranking: 'Ranking',
    album: 'Álbum',
    stats: 'Stats',
    ajustes: 'Ajustes',
  },

  // ---------------------------------------------------------------
  peso: {
    titulo: 'Anotar peso',
    sub: 'Solo el peso. No registra el día ni toca la racha.',
    anotarPeso: 'Anotar peso',
    placeholder: (unidad: string) => `Tu peso en ${unidad}`,
    anotar: 'Anotar',
    noDa: 'Ese peso no da.',
    privado: 'Solo lo ves vos. Nunca se comparte ni se muestra.',
  },

  // ---------------------------------------------------------------
  // La hoja que registra el día.
  registrar: {
    sumarAlDia: 'Sumar al día',
    diaN: (n: number) => `Día ${n}`,
    corregirDia: 'Corregir día',
    foto: 'Foto',
    agregarFoto: 'Agregar foto',
    laVenAmigos: 'La ven tus amigos ✓',
    soloLaVesVos: 'Solo la ves vos — tocá para compartirla',
    peso: 'Peso',
    noSeGuardoElPeso: 'No se pudo guardar el peso. Probá de nuevo.',
    diaYaRegistrado: 'Este día ya está registrado.',
  },

  // ---------------------------------------------------------------
  // La hoja que anota una marca de fuerza.
  marca: {
    titulo: 'Anotar una marca',
    sub: 'No hace falta que sea de hoy. Queda con su fecha.',
    ejercicio: 'Ejercicio',
    cuentanDots: 'Cuentan para el DOTS',
    cuantasVeces: 'Cuántas veces',
    deUna: 'De una',
    variasVeces: 'Varias veces',
    peso: 'Peso',
    veces: 'Veces',
    cuando: 'Cuándo',
    anotar: 'Anotar',
    // El máximo calculado es un derivado, no el dato: se dice en voz baja.
    comoMaximo: (kg: string, unidad: string) => `Como máximo de una, te da ${kg} ${unidad}.`,
    sacamosDeUna: 'Con eso sacamos cuánto levantarías de una.',
    unaVezNoSaca: ' Con una vez no hay nada que sacar: es el peso.',
    muchasFloja: ' De 12 para arriba la cuenta se vuelve muy floja.',
    vecesFuera: 'Van de 1 a 20 veces.',
    // "Estimado" suena a traducción y a formulario; lo que la persona hizo fue
    // levantar un peso una cantidad de veces, y así se dice.
    deUnaVez: 'de una',
    nVeces: (n: number) => `${n} veces`,
    fechaLarga: (dia: number, mes: string, anio: number) => `${dia} ${mes} ${anio}`,
    todaviaNo: 'Todavía no la levantaste.',
    sesionCerrada: 'Se cerró la sesión. Volvé a entrar.',
  },

  // ---------------------------------------------------------------
  // El recorte de la foto de perfil.
  recorte: {
    titulo: 'Encuadrá tu foto',
    sub: 'Arrastrala y agrandala hasta que quede como querés.',
    etiqueta: 'Recortar la foto',
    acercar: 'Acercar',
    trabajando: 'Recortando…',
    usar: 'Usar esta foto',
    noSeAbre: 'No se pudo abrir esa imagen.',
    noSeRecorta: 'No se pudo recortar la imagen.',
  },

  // ---------------------------------------------------------------
  album: {
    titulo: 'Álbum',
    globo:
      'Cada foto queda pegada al día en que la sacaste. Desde tu perfil elegís cuáles ven tus amigos.',
    vacioTitulo: 'Ninguna foto todavía.',
    vacioPie: 'Al registrar un día podés sumar una: queda pegada al planeta de ese día.',
    borrarPregunta: '¿Borrar?',
    si: 'Sí',
    no: 'No',
    soloVos: 'Solo vos',
    amigos: 'Amigos',
    borrarFoto: 'Borrar foto',
    noSeBorro: 'No se pudo borrar la foto. Probá de nuevo.',
    vacio: 'Todavía no hay fotos.',
  },

  // ---------------------------------------------------------------
  social: {
    titulo: 'Ranking',
    amigos: 'Amigos',
    buscarGente: 'Buscar gente',
    // El título decía "Leaderboard" mientras la barra de abajo decía
    // "Ranking": la misma pantalla con dos nombres. Manda el de la barra.
    globo: 'Acá comparás tu racha con la de tus amigos, y buscás gente para sumar.',
    aceptar: 'Aceptar',
    no: 'No',
    teReto: (nombre: string) => `${nombre} te retó a 7 días: quien entrene más, gana.`,
    acepto: 'Acepto',
    paso: 'Paso',
    campo: 'Campo',
    lista: 'Lista',
    vos: 'vos',
    yoEnLista: (nombre: string) => `${nombre} (vos)`,
    vacioTitulo: 'Tu cielo todavía está vacío.',
    vacioPie: 'Buscá a alguien más abajo y empieza la constelación.',
    retos: 'Retos',
    vs: (nombre: string) => `vs ${nombre}`,
    hastaEl: (fecha: string) => `hasta el ${fecha}`,
    cerrando: 'cerrando…',
    empate: 'empate',
    ganaste: 'ganaste',
    gano: (nombre: string) => `ganó ${nombre}`,
    actividad: 'Actividad',
    registroEl: (nombre: string, fecha: string) => `${nombre} registró el ${fecha}`,
    pedidoEnviado: 'Pedido enviado',
    agregar: 'Agregar',

    noExiste: 'Este usuario no existe.',
    pedidoDeAmistad: 'Pedido de amistad enviado',
    cuandoSeanAmigos: 'Cuando sean amigos vas a ver su semana y sus fotos.',
    reto: 'Reto',
    retarA7: 'Retar a 7 días',
    retoEnviado: 'Reto enviado — esperando respuesta',
    dejanDeVer: 'Dejan de ver la actividad y las fotos del otro',
    yElRetoSeCancela: ', y el reto se cancela',
    eliminar: 'Eliminar',
    eliminarDeAmigos: 'Eliminar de mis amigos',
    sinNombre: '¿?',
    sumarAmigo: 'Sumar un amigo',
  },

  // ---------------------------------------------------------------
  // Errores de auth. Lo importante: NO todos los fallos son "contraseña
  // equivocada"; decirlo cuando no hay red manda a probar contraseñas para
  // siempre.
  errores: {
    malConfigurada:
      'La app no está bien configurada y no puede hablar con el servidor. No es tu contraseña.',
    sinConexion: 'No hay conexión con el servidor. Fijate si tenés internet y probá de nuevo.',
    sinConfirmar: 'Falta confirmar la cuenta desde el correo que te llegó.',
    demasiadosIntentos: 'Demasiados intentos seguidos. Esperá unos minutos.',
    noCoinciden: 'Ese correo y esa contraseña no coinciden.',
    yaHayCuenta: 'Ya hay una cuenta con ese correo. Probá entrar, o pedí una contraseña nueva.',
    claveCorta: 'La contraseña tiene que tener al menos 6 caracteres.',
    noEsImagen: 'Eso no parece una imagen.',
    imagenPesada: 'La imagen pesa demasiado. Probá con una más liviana.',
    noSubioFoto: 'No se pudo subir la foto. Probá de nuevo.',
    fotoSinGuardar: 'La foto subió pero no se pudo guardar. Probá de nuevo.',
    noSeBorraronFotos: 'No se pudieron borrar tus fotos. Probá de nuevo.',
    noSeElimino: 'No se pudo eliminar la cuenta. Probá de nuevo.',
    algoFallo: 'Algo falló al entrar. Probá de nuevo en un momento.',
  },

  // ---------------------------------------------------------------
  yo: {
    misFotos: 'Qué fotos ven tus amigos',
    cambiarFoto: 'Cambiar la foto de perfil',
    subiendoFoto: 'subiendo la foto…',
    deRacha: (n: number) => `${n} de racha`,
    fotoActualizada: 'Foto actualizada.',
    noSeCambioFoto: 'No se pudo cambiar esa foto. Probá de nuevo.',
    noSeCambiaronFotos: 'No se pudieron cambiar las fotos. Probá de nuevo.',
    noSePudoEliminar: 'No se pudo eliminar. Probá de nuevo.',

    comoMeVen: 'Ver como lo ven los demás',
    comoMeVenSi: 'Esto es todo lo que le llega a un amigo.',
    comoMeVenNo: 'Mirá tu perfil con los ojos de un amigo.',
    loQueVe: (nombre: string) => `lo que ve ${nombre}`,
    unAmigo: 'un amigo',
    noApareceNunca: 'Tu peso y tus días de descanso no aparecen acá, y no aparecen nunca.',

    deTantas: (compartidas: number, total: number) => `${compartidas}/${total}`,
    compartirTodas: 'Compartir todas',
    guardarTodas: 'Guardar todas',
    tocaUnaFoto: 'Tocá una foto para prenderla o apagarla. Las apagadas las ves solo vos.',
    sinFotos:
      'Todavía no sacaste ninguna. Cuando registres un día con foto, la vas a poder prender o apagar desde acá.',

    amigos: 'Amigos',
    eliminar: 'Eliminar',
    no: 'No',
    quitar: 'Quitar',
    // El link para buscar está justo arriba: repetir dónde se buscan sobraba.
    sinAmigos: 'Todavía no agregaste a nadie.',
    noSeSumoLaFoto: 'No se pudo sumar la foto. Probá de nuevo.',
    sumarFotos: 'Sumar fotos acá',
  },
} as const;
