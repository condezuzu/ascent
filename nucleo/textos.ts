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
// VIVE EN `nucleo/` desde la mudanza del 2026-08-29: es el paquete compartido
// entre la web y la app nativa, y los textos los necesitan las dos. Adentro de
// `nucleo/` los archivos se importan entre sí con rutas relativas y CON
// extensión, porque `test:db` los carga con node pelado —que no conoce alias
// ni resuelve especificadores sin extensión—. Desde afuera va `@nucleo/textos`,
// que lo resuelve el bundler.
//
// LO QUE NO VIVE ACÁ, a propósito: los nombres de los rangos (`rangos.ts`) y
// de los planetas (`reglas.ts`) — son el vocabulario de la app, no texto de
// interfaz —, las citas con autor (`frases.ts`), y el artículo largo de
// "Cómo se compara la fuerza", que es texto con formato y ya vive entero en
// su propia pantalla.

/** "Press de banca" → "press de banca", para meterlo en medio de una frase. */
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export const T = {
  // ---------------------------------------------------------------
  // LAS VIDAS. Se llamaron "impulsos" un tiempo, por elegancia, y el humano lo
  // probó en el gimnasio: no se entendía, ni él lo entendía. "Vidas" es más
  // obvio aunque sea menos elegante, y lo obvio gana. La llave sigue siendo
  // `impulso` —y las funciones de la base, `mis_impulsos`— para no tocar la
  // base por un nombre: lo que se ve dice "vidas".
  //
  // Dicen el hecho y nada más: no felicitan —"¡tu racha está a salvo!"— ni
  // retan. La app no opina sobre el día que alguien no fue al gimnasio;
  // cuenta lo que hizo con eso.
  impulso: {
    faltasteUno: (dia: string) => `Faltaste el ${dia}. Se usó una vida.`,
    faltasteVarios: (n: number) => `Faltaste ${n} días. Se usaron ${n} vidas.`,
    // Sin "este mes": ya no son del mes. Cada uno vuelve treinta días después
    // de usarlo, así que lo único que hay que saber es cuántos hay ahora.
    quedan: (n: number) =>
      n === 0 ? 'No te queda ninguna.' : n === 1 ? 'Te queda 1.' : `Te quedan ${n}.`,
    vuelve: (dia: string) => `La siguiente vuelve el ${dia}.`,
    // Cuánta racha falta para ganar el tercero. Se dice solo cuando falta.
    seGanaEn: (dias: number) =>
      dias === 1 ? 'La tercera se gana mañana.' : `La tercera se gana en ${dias} días.`,
    // En Stats, al lado de los puntos. En minúscula y chico: es un dato de
    // contexto, no un título.
    titulo: 'Vidas',
    // Cuántas hay y cuándo se gana la tercera ya lo dicen los puntos y la
    // línea de al lado: la nota solo dice para qué sirven.
    nota: 'Si faltas un día se usa una y la racha sigue. Cada una vuelve a los 30 días.',

    // ---- la ventana del día siguiente ----
    //
    // NO FELICITA, Y CUESTA NO HACERLO: es el momento más parecido a un premio
    // que tiene la app. Pero el usuario no hizo nada para merecerlo —faltó—, y
    // una felicitación ahí enseña que faltar está bien. Dice lo que pasó.
    salvada: {
      titulo: 'La racha sigue',
      // El precio de guardarlo, dicho con el número y no con el reglamento.
      // "Se corta la racha" no significa nada hasta que se ve en cuánto queda.
      precio: (n: number, racha: number) =>
        `${n === 1 ? 'La vida vuelve' : `Las ${n} vidas vuelven`} y la racha se corta hoy: quedas en ${racha} ${racha === 1 ? 'día' : 'días'}.`,
      guardar: (n: number) => (n === 1 ? 'Guardarla para después' : 'Guardarlas para después'),
      confirmar: 'Cortar la racha',
      volver: 'Mejor no',
      // Después de devolverlo. Tampoco reta: la persona eligió esto sabiendo
      // el precio, y repetirle que perdió sería cobrarle dos veces.
      guardada: (n: number) =>
        n === 1 ? 'La vida quedó para después.' : `Las ${n} vidas quedaron para después.`,
      // Sin señal no se devolvió nada: se dice lo que sigue siendo cierto.
      noSeGuardo: 'Sin señal no se guardó: la racha sigue como estaba. Prueba de nuevo.',
    },
  },

  // EL DETECTOR DE ESTANCAMIENTO. Describe, no juzga y no receta: cada
  // frase es un hecho con fecha, y lo único que se ofrece es lo único que la
  // app puede hacer —guardar una marca—. La racha NO se nombra acá nunca.
  estancamiento: {
    marcaQuieta: (ejercicio: string, semanas: number) =>
      `Tu mejor ${ejercicio.toLowerCase()} sigue siendo el de hace ${semanas} semanas.`,
    ejercicioDejado: (ejercicio: string, semanas: number) =>
      `Hace ${semanas} semanas que no anotas ${ejercicio.toLowerCase()}.`,
    anotarUna: '¿Anotas una nueva?',
    // Las dos filas sin verbo. No hay frase a propósito: la conclusión la
    // saca quien mira, y por eso se la cree.
    ultimas4: 'Últimas 4 semanas',
    anteriores4: 'Las 4 anteriores',
    dias: (n: number) => `${n} días`,
    minutos: (n: number) => `${n} min`,
    descartar: 'No mostrar esto',
  },

  // ---------------------------------------------------------------
  // EL CALENDARIO. Vivía en Ajustes como "Corregir días"; ahora hay uno solo,
  // en Stats, y TOCAR UN DÍA LO ABRE en vez de cambiarlo. Antes la única forma
  // de averiguar qué había pasado un día era tocarlo, y tocarlo cambiaba el
  // dato: mirar rompía cosas.
  calendario: {
    titulo: 'Tus días',
    nota: 'Toca un día para ver qué hiciste, o para corregirlo.',
    mesAnterior: 'Mes anterior',
    mesSiguiente: 'Mes siguiente',
    mesYAnio: (mes: string, anio: number) => `${mes} ${anio}`,
    verDia: (dia: number) => `Ver el día ${dia}`,
    // La referencia. Tres palabras, no tres frases: es una leyenda, no una
    // explicación.
    leyendaHecho: 'Fuiste',
    leyendaVacio: 'No fuiste',
    leyendaDescanso: 'Descanso',
    noSeSaco: 'Ese día sigue puesto.',
    noSeAgrego: 'Ese día no se agregó.',
    // La corrección NO recalcula sola: la racha la recalcula la base y hacerlo
    // en cada toque serían diez recálculos para arreglar una semana.
    recalcularNota:
      'Corregiste días: recalcula la racha para que cuente como quedaron.',
    recalcular: 'Recalcular racha desde el historial',
    recalculando: 'Recalculando…',
    recalcularError: 'La cuenta no salió. Prueba de nuevo.',
    // `dias` llega ya escrito ("3 días"), no como número: la palabra cambia con
    // el idioma y con el 1.
    recalculoCortado: (dias: string) =>
      `Tu historial da ${dias}: está cortado, así que se aplicó el descuento.`,
    recalculoListo: (dias: string) => `Listo: ${dias}.`,
  },

  // ---------------------------------------------------------------
  // EL RESUMEN DE UN DÍA. Sin gráficos ni comparaciones con otros días: un día
  // no tiene tendencia, y "15% menos que el martes" convierte mirar un
  // entrenamiento en rendir cuentas.
  resumen: {
    fuiste: 'Fuiste',
    descanso: 'Descanso',
    sinRegistrar: 'Sin registrar',
    series: (n: number) => (n === 1 ? '1 serie' : `${n} series`),
    // Series que se contaron sin decir en qué. Existen y suman; solo no se
    // sabe de qué fueron.
    sinEjercicio: 'Sin ejercicio',
    // "60, 60 kg" · "30, 30 kg por mancuerna". El modo sale del bloque, no del
    // catálogo: es lo que quedó escrito ese día.
    pesosDeSeries: (lista: string, unidad: string, carga: 'total' | 'par' | 'parPolea' | 'una' | 'lastre' = 'total') =>
      `${lista} ${unidad}${
        { total: '', par: ' por mancuerna', parPolea: ' de cada lado', una: ', un lado por vez', lastre: ' de lastre' }[carga]
      }`,
    ejercicioSinNombre: 'Un ejercicio que ya no está',
    enCurso: 'La sesión sigue abierta: esto se completa al terminarla.',
    // Cada forma de entrar dice lo que pasó, sin disculparse por lo que falta.
    porUbicacion: 'Entró solo, al llegar al gimnasio.',
    porSalud: 'Entró por la app de salud del teléfono.',
    sinSesion: 'Sin cronómetro: solo se marcó el día.',
    corregir: 'Corregir',
    marcarFui: 'Fui',
    marcarDescanso: 'Descansé',
    marcarNada: 'Sin registrar',
    // Las sesiones cuelgan del día: sacarle el "fui" a un día con sesión la
    // borra entera. El calendario viejo lo hacía en silencio.
    borraSesion: 'Eso borra también la sesión de ese día.',
    siCambiar: 'Cambiarlo igual',
    // Futuro: el calendario no deja abrirlo, pero si llega, no se ofrece
    // corregir algo que todavía no pasó.
    futuro: 'Todavía no pasó.',
  },

  // Las zonas del selector de ejercicios. Van en minúscula porque son
  // etiquetas de navegación, no títulos.
  ejercicios: {
    superior: 'Tren superior',
    inferior: 'Tren inferior',
    core: 'Core',
  },

  general: {
    entendido: 'Entendido',
    cerrar: 'Cerrar',
    fotos: 'Fotos',
    // El huso para escribir horas. Cambia junto con el idioma.
    locale: 'es-UY',
    guardar: 'Guardar',
    borrar: 'Borrar',
    ajustes: 'Ajustes',
    volver: '← Volver',
    cancelar: 'Cancelar',
    noSePudo: 'No se guardó. Prueba de nuevo.',
    // Los avisos de escritura fallada. Antes todos empezaban con "No se pudo",
    // que es la voz de un formulario y además la información menos útil: que
    // algo no se pudo ya se sabe, porque el aviso está ahí.
    //
    // Ahora cada uno dice QUÉ ES CIERTO AHORA — "el punto sigue donde estaba",
    // "esa foto la sigue viendo quien la veía antes" — que es lo que la persona
    // necesita para decidir si tiene que hacer algo. Y "Probá de nuevo" quedó
    // solo donde reintentar es de verdad el arreglo.
    falloFoto: 'La foto no llegó a subir. Quédate conectado y prueba de nuevo.',
    falloPreferencia: 'Ese ajuste no se guardó: quedó como estaba.',
    falloVisibilidad: 'Esa foto la sigue viendo quien la veía antes.',
    falloDescansos: 'Tus días de descanso quedaron como estaban.',
    falloPunto: 'El punto del gimnasio sigue donde estaba.',
    // Se dice "preparar" y no "subir" porque no llegó a subirse nada: la
    // foto se recodifica antes de salir del teléfono para sacarle los datos
    // de ubicación, y si eso falla NO se manda el original.
    falloFotoPreparar: 'Esa foto no se pudo preparar. Prueba con otra, o sácala de nuevo.',
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
    sumarSerie: 'Sumar una serie',
    // La nota de arriba está debajo del contador y se lee tarde: la primera
    // vez, el + aparece sin ninguna explicación y parece un botón de confirmar.
    // Esto se dice una sola vez, arriba, donde se está mirando.
    globoSeries:
      'Elige el ejercicio y cuántas series. Cada + suma una y arranca el descanso.',
    // Un cronómetro que aparece andando sin que lo hayas tocado se lee como un
    // error de la app. Con una línea deja de serlo.
    sesionSola: 'Arrancó sola cuando llegaste. Se corta al irte, o cuando quieras.',
    yaHabiaSesion: 'Ya tenías una corriendo. Seguimos con esa.',
    diaDeshecho: 'Muy corta para contar como día. Se deshizo.',
    sacarSerie: 'Sacar una serie',
    // Discreto y permanente mientras no haya punto: es el diferencial de la
    // app y vivía escondido en Ajustes.
    gimnasioRecordatorio: 'Marca tu gimnasio: el día entra al abrir la app estando ahí.',
    // Y acá sí se insiste, porque es el único momento en que es probable que
    // la persona esté parada en el gimnasio. NUNCA al empezar la sesión:
    // ahí casi nunca está ahí todavía.
    gimnasioAhora: '¿Estás en el gimnasio ahora?',
    gimnasioAhoraPie: 'Márcalo una vez y listo: el día entra con abrir la app en el gimnasio.',
    // POR QUÉ SE ACLARA EL "POR AHORA". El texto decía que el día entra solo
    // "con abrir la app", y eso hace que marcar el punto parezca inútil: si hay
    // que abrir la app igual, se registra a mano y listo. La web no puede hacer
    // más —el navegador no despierta a nadie— pero la app del teléfono sí, y no
    // decirlo hace parecer diseño lo que es un techo temporal.
    gimnasioPorAhora: 'Por ahora hay que abrir la app. En la del teléfono va a entrar solo.',
    gimnasioAhoraNo: 'Ahora no',
    noCargo: 'No se pudieron traer tus datos. Puede ser la conexión.',
    reintentar: 'Reintentar',
    vacioTitulo: 'Todavía no hay nada aquí.',
    vacioPie: 'Registra tu primer día y algo se empieza a formar.',
    vacio: 'Todavía no hay nada aquí.\nRegistra tu primer día y algo se empieza a formar.',
  },

  // ---------------------------------------------------------------
  // LA PANTALLA DE ENTRADA: lo primero que ve alguien que abre la app, y una
  // sola vez en su vida. Cuatro pantallas; la cuarta no tiene texto porque la
  // animación dice lo que hay que decir y cualquier frase encima le compite.
  //
  // REGLA DURA: no se promete ningún resultado físico ni ningún cambio de
  // vida. Eso lo dice cualquier app de gimnasio y no es lo que hace esta.
  // Todo lo que se afirma acá, la app lo cumple: anota los días, las series y
  // los pesos, y los pone al lado de los de otros.
  //
  // Y NINGÚN RANGO SE NOMBRA (§7): se ven los objetos, no sus nombres.
  bienvenida: {
    saludoTitulo: 'Empiezas desde el polvo',
    saludoBajada: 'Cada día que entrenas te acerca a algo más grande.',
    registroTitulo: 'Se anota todo',
    registroBajada: 'Los días, las series y los pesos. Lo que hiciste queda, no se recuerda.',
    genteTitulo: 'Alguien más está entrenando ahora mismo',
    genteBajada: 'Mide tu racha contra la de tus amigos, o contra la de todo el universo.',
    // Sobre el cielo que vuelve después del trago. No repite el polvo: eso ya
    // lo dijo la primera pantalla, y decirlo dos veces lo gasta.
    cierre: 'Tu viaje empieza ahora mismo',
    crear: 'Crear cuenta',
    entrar: 'Ya tengo cuenta',
    siguiente: 'Siguiente',
    saltar: 'Saltar',
    // La racha que sube en la cuarta pantalla.
    racha: 'Racha',
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
    primeraVez: '¿Primera vez? Crear cuenta',
    olvide: 'Olvidé mi contraseña',
    volverAEntrar: 'Volver a entrar',
    revisaCorreo: 'Listo. Revisa tu correo para confirmar la cuenta.',
    // No se dice si el mail existe: eso filtra quién tiene cuenta.
    siTieneCuenta: 'Si esa dirección tiene cuenta, le llega un correo para cambiar la contraseña.',
    paraRecuperar: 'Te mandamos un enlace para elegir una contraseña nueva.',
    malConfigurada: 'Falta configurar algo de la app. Esto lo tengo que arreglar yo.',
    malConfiguradaDetalle:
      'La app no puede conectarse al servidor. Hasta que se arregle, nada de aquí funciona.',

    elegiNombre: 'Elige tu nombre',
    elegiNombreSub: 'Así te van a encontrar tus amigos.',
    empezar: 'Empezar',
    nombreFormato: 'Entre 3 y 20 letras, números o guion bajo.',
  },

  // ---------------------------------------------------------------
  // EL RECORRIDO DE LA PRIMERA VEZ (`nucleo/recorrido.ts`). Una línea por
  // pantalla, mirando la pantalla de la que habla. El gimnasio primero: es lo
  // que hace distinta a la app. REGLA DURA de siempre: ningún rango nombrado.
  recorrido: {
    titulo: 'Recorrido por la app',
    gimnasio: 'Lo primero: marca tu gimnasio. Al llegar, el día se registra solo.',
    inicio: 'Tu racha. En el gimnasio tocas Iniciar y cuentas tus series.',
    stats: 'Tus números: constancia, series por músculo y tus mejores pesos.',
    album: 'Una foto por día, si quieres. Solo la ves tú, salvo que la compartas.',
    ranking: 'Tu racha y la de tus amigos. Desde aquí los buscas y agregas.',
    siguiente: 'Siguiente',
    listo: 'Listo',
    saltar: 'Saltar',
    ir: 'Ir',
  },

  // ---------------------------------------------------------------
  // Contraseña nueva, desde el correo de recuperación o desde Ajustes.
  clave: {
    titulo: 'Contraseña nueva',
    sub: 'Al menos 6 caracteres.',
    nueva: 'Contraseña nueva',
    repetir: 'Repítela',
    corta: 'Esa es muy corta: mínimo 6.',
    noCoinciden: 'Las dos no coinciden.',
    esLaMisma: 'Esa ya es tu contraseña actual.',
    noSePudo: 'No se cambió. Pide el correo otra vez.',
    cambiada: 'Contraseña cambiada.',
    enlaceVencido: 'El enlace ya venció o se abrió en otro navegador.',
    enlaceVencidoPie: 'Pide uno nuevo desde la pantalla de entrada.',
    irAEntrar: 'Ir a entrar',
  },

  // ---------------------------------------------------------------
  // La guarda de las 20 horas por cambio de zona (§12b). Tiene que decir dos
  // cosas y las dos importan: que el día NO se perdió, y cuándo entra. Un
  // rechazo mudo con la racha en juego se lee como que la app está rota.
  bloqueo: {
    sinHora: 'Tu día quedó anotado y se suma solo en cuanto la app lo pueda confirmar.',
    aLaHora: (hora: string) =>
      `Cambiaste de zona horaria: tu día se suma solo a las ${hora}. No lo perdiste.`,
    enMinutos: (min: number) =>
      `Cambiaste de zona horaria: tu día se suma solo en ${min} min. No lo perdiste.`,
  },

  // ---------------------------------------------------------------
  fuerza: {
    titulo: 'Fuerza',
    misMarcas: 'Mis marcas',
    anotarMarca: 'Anotar una marca',
    lasTresQueCuentan: 'Las tres que cuentan',
    dondeEstoy: 'Dónde estoy',
    // Estaban escritos a mano en el JSX de la web; se mudaron acá al portar
    // la sección a la app nativa, para que no queden escritos dos veces.
    entreAmigos: 'Entre amigos',
    dotsPie: (total: string) => `DOTS · ${total} de total`,

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

    // Cambió con la migración 28: antes los amigos veían una banda.
    loVenTusAmigos: 'Tus amigos ven este número. Con él pueden estimar cuánto pesas.',
    faltaPara: (peso: string) => `Te faltan ${peso} para principiante`,
    faltaParaUno: (peso: string) => `Te falta ${peso} para principiante`,

    muestraFina:
      'Hay pocos datos de mujeres: tómalo como orientación, no como medición.',
    fueraDeTabla:
      'Tu peso queda fuera de la tabla: se compara con el extremo más cercano.',


    // El DOTS necesita las TRES. El PORQUÉ vive en Ajustes ("Cómo se compara
    // la fuerza"), donde puede ser largo: el que abre eso lo está buscando.
    // Acá va el hecho y un link, y nada más.
    faltanMarcas: (n: number) => `Con ${n} de 3 todavía no hay número.`,
    yaEstanLasTres: 'Ya están las tres.',
    // Partido en dos porque en el medio va el link a Ajustes.
    faltaSexo: 'Para el número falta cargar el sexo en',
    faltaSexoFin: ': la fórmula usa dos juegos de coeficientes y no se asume ninguno.',
    faltaPeso:
      'Falta tu peso corporal: sin él no se comparan personas de distinto tamaño.',

    // En Stats no hay cuántas van cargadas a mano, así que ahí va la corta.
    faltanMarcasCorto: 'Faltan marcas: el número sale de las tres, y con dos no se compara con nada.',
    // Partido en dos porque en el medio va el link a Mis marcas.
    faltaPesoEnMarcas: 'Falta tu peso corporal, que se anota en',
    faltaPesoEnMarcasFin: '. Solo lo ves tú.',
    loDemas: 'Lo demás',
    loDemasNota: 'Anotalas todas las que quieras. Estas no entran al número.',
    ningunaCargada: 'Sentadilla, press de banca y peso muerto. Ninguna cargada todavía.',
    esLaUnica: 'Es la única que anotaste.',
    cuantasAnotaste: (n: number) => `Anotaste ${n}. Vale la mejor.`,
    otraDe: (nombre: string) => `Otra de ${nombre}`,
    vacioTitulo: 'Todavía no cargaste ninguna.',
    vacioPie: 'Sentadilla, banca y peso muerto son las tres que arman tu número.',
    sinNada:
      'Sentadilla, banca y peso muerto arman un número comparable con tus amigos.',
  },

  // ---------------------------------------------------------------
  ajustes: {
    titulo: 'Ajustes',
    // El peso por serie se puede apagar entero: el que no quiere anotar nada no
    // tiene por qué ver un campo vacío en cada bloque.
    pesoPorSerie: 'Peso de cada serie',
    pesoPorSerieSi: 'Anotarlo',
    pesoPorSerieNo: 'No anotarlo',
    pesoPorSerieNota: 'Si lo apagas, el campo de peso no aparece al entrenar. Lo que ya anotaste se queda.',
    // Tres cosas que cambian cómo funciona la app y que nadie encuentra si
    // no se las nombra una vez.

    diasDescanso: 'Días de descanso',
    diasDescansoNota: 'Esos días puedes faltar sin perder la racha.',


    descansoEntreSeries: 'Descanso entre series',
    descansoNota: 'Mientras descansas lo puedes cambiar ahí mismo.',
    sonidoPrendido: 'Sonido al terminar ✓',
    sonidoApagado: 'Sonido al terminar — apagado',
    vibra: 'Vibra al terminar, con la app abierta. Si la cierras, no avisa.',
    noVibra: 'Tu teléfono no vibra desde la web: el aviso es visual, con la app abierta.',
    // Las dos frases decían lo contrario de lo que ahora hace la app: el
    // aviso CORTA la música a propósito, porque con auriculares no se escucha
    // de ninguna otra forma.
    sonidoRespeta: 'Corta tu música el instante que dura el aviso y la deja volver sola.',
    sonidoCorta: 'En este teléfono el sonido puede taparse si tienes música fuerte.',

    gimnasio: 'Mi gimnasio',
    gimnasioMarcar: 'Marcar el punto',
    gimnasioRemarcar: 'Volver a marcar el punto',
    gimnasioBuscando: 'Buscando…',
    gimnasioBorrar: 'Borrar el punto',
    gimnasioComo: 'Márcalo parado en la puerta de tu gimnasio.',
    gimnasioParaQue: 'Después, abrir la app estando ahí registra el día sin que aprietes nada.',
    gimnasioTecho: 'Por ahora hay que abrir la app. En la del teléfono va a entrar solo.',
    gimnasioListo: (metros: number) => `Listo, con ${metros} m de precisión.`,
    gimnasioPuesto: 'Ya está marcado. Nadie más lo ve: no se comparte con tus amigos.',
    gimnasioSinGps: 'Este teléfono no da la ubicación.',
    gimnasioSinPermiso:
      'No se pudo leer la ubicación. Fíjate que le hayas dado permiso a la app.',
    // No dice "error": dice qué pasó y qué hacer. Marcar el punto con esta
    // precisión guardaría el barrio en vez del gimnasio, y eso no se nota
    // hasta semanas después, cuando los días entran solos desde tu casa.
    gimnasioImpreciso: (metros: number) =>
      `Te ubica con ${metros} m de error. Sal a la vereda y prueba de nuevo.`,

    // EL FONDO. El motor cuesta tres segundos de arranque, medidos: se puede
    // apagar. No dice "gráficos" ni "calidad": dice qué es y qué cuesta.
    fondo: 'El fondo del espacio',
    fondoAuto: 'Automático',
    fondoSiempre: 'Siempre',
    fondoNunca: 'Nunca',
    // El automático DICE qué decidió: "automático" a secas es pedir que
    // confíes a ciegas en algo que te cambia la app.
    fondoAutoBueno: 'Tu equipo lo aguanta: está prendido. La app tarda unos segundos más en abrir.',
    fondoAutoFlojo: 'Tu equipo va justo: está apagado y la app abre al instante.',
    fondoAutoNoSe: 'No se sabe cuánto aguanta tu equipo: está prendido. Si tarda en abrir, apágalo.',
    fondoNota: 'Apagado, la app abre al instante y el degradado queda igual.',

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
    // El aviso va donde se ACTIVA el DOTS, que es el único momento en que
    // todavía se puede decidir no hacerlo. Dice la consecuencia completa:
    // el DOTS es una función del peso corporal y del total, así que con los
    // dos a la vista el peso se despeja. No es un riesgo, es aritmética.
    sexoAviso:
      'Con el DOTS activado, tus amigos ven tu número exacto y pueden deducir cuánto pesas.',

    sugerencias: 'Sugerencias',
    sugerenciasPlaceholder: '¿Algo anda mal? ¿Se te ocurrió algo? Cuenta aquí.',
    mandar: 'Mandar',
    sugerenciaEnviada: 'Gracias. Lo leo yo.',

    instalar: 'Instalar',
    instalarBoton: 'Instalar Ascent en este teléfono',
    // Partido en tres porque el nombre del botón de iOS va destacado.
    instalarIOS: 'En iPhone: toca el botón de compartir en Safari y elige',
    instalarIOSAccion: '“Agregar a inicio”',
    instalarIOSFin: '. Queda como una app más.',
    instalarNota: 'Desde el menú del navegador puedes agregar Ascent a la pantalla de inicio.',

    misDatos: 'Mis datos',
    exportar: 'Exportar mis datos',
    exportarNota: 'Todo tu historial, en un archivo.',

    verGuia: 'Volver a ver la guía',
    cambiarClave: 'Cambiar contraseña',
    cerrarSesion: 'Cerrar sesión',
    eliminarCuenta: 'Eliminar mi cuenta',

    exportando: 'Armando el archivo…',
    exportarError: 'El archivo no se armó. Prueba de nuevo.',


    nombrePlaceholder: 'nombre_de_usuario',
    nombreFormato: 'Entre 3 y 20 letras, números o guion bajo.',
    nombreTomado: 'Ese nombre ya está tomado.',

    tuPerfil: 'Tu foto, tus fotos compartidas y tus amigos',

    // ELIMINAR, como el botón: la cuenta tenía dos verbos, "se borra" acá y
    // "Eliminar para siempre" abajo (regla 4: un verbo por acción).
    bajaQueSeElimina: (dias: number) =>
      `Se elimina todo: ${dias} días de racha, fotos, pesos, marcas y amigos. No se recupera.`,
    // Partido en dos porque en el medio va el nombre en negrita.
    bajaEscribe: 'Si quieres seguir, escribe',
    bajaEscribiFin: 'aquí abajo.',
    bajaEliminando: 'Eliminando…',
    bajaConfirmar: 'Eliminar para siempre',
    mejorNo: 'Mejor no',

    comoSeCompara: 'Cómo se compara la fuerza',
    estancamiento: 'Avisos de estancamiento',
    estancamientoSi: 'Sí',
    estancamientoNo: 'No',
    semanas: (n: number) => `${n} semanas`,
    estancamientoNota: (n: number) =>
      `Una señal por vez, en Stats, cuando algo lleva ${n} semanas sin moverse.`,

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
      'Apriétalo en la puerta: dice a cuántos metros te ve.',
    diagVacia: 'Todavía no hay nada anotado.',
    diagRefrescar: 'Refrescar',
    diagBorrar: 'Borrar lo anotado',
  },

  // ---------------------------------------------------------------
  stats: {
    // LAS DOS PESTAÑAS. "General" es lo que Stats ya era, intacto: quién sos
    // en la app. "Entrenamiento" es qué venís haciendo, y ahí va a crecer lo
    // del peso por serie.
    pestanaGeneral: 'General',
    pestanaEntrenamiento: 'Entrenamiento',
    titulo: 'Stats',
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
    // Las ventanas del gráfico. Cortas: son botones chicos en fila.
    pesoMes: '1 mes',
    pesoTresMeses: '3 meses',
    pesoTodo: 'Todo',
    // Los bordes del dibujo NO son datos: la versión anterior mostraba
    // `min - 0.5` y `max + 0.5` como si fueran dos pesos reales. Lo único que
    // se puede afirmar además del de hoy es cuánto cambió.
    pesoCambio: (dias: number, delta: string, unidad: string) =>
      `${dias} ${dias === 1 ? 'anotación' : 'anotaciones'} · ${delta} ${unidad}`,
    pesoUnoMas: 'Con uno más aparece la tendencia. Solo la ves tú.',
    pesoVacio: 'Anota tu peso y aquí aparece la tendencia. Solo la ves tú.',
    sinDuracion_: (n: number) => `${n} sin duración`,
    masCortas: (n: number) => `${n} de menos de 5 min`,
    rachaDe: (dias: string) => `racha de ${dias}`,
    diaN: (n: number) => `día ${n}`,
    laEscalera: 'La escalera',
    acaEstas: 'aquí estás',
  },

  // ---------------------------------------------------------------
  // EL VOLUMEN, en la pestaña Entrenamiento y en el resumen de cada día. Ver
  // `nucleo/volumen.ts`. Describe, no juzga y no receta: ni "bien", ni "bajó",
  // ni "deberías".
  volumen: {
    // NO DICE "VOLUMEN": quien va al gimnasio sabe qué es una serie y no qué
    // es volumen. La pantalla lo muestra con barras y no lo explica.
    titulo: 'Series por músculo',
    enSeries: 'Series',
    enKilos: 'Kilos',
    semanaDel: (fecha: string) => `Semana del ${fecha}`,
    // La semana de hoy no terminó: dicho, para que no se lea como una caída.
    estaSemana: 'Esta semana, hasta hoy',
    // Debajo de la última barra.
    esta: 'esta',
    conTotal: (cuando: string, total: string) => `${cuando} · ${total}`,
    kilosYSeries: (kilos: string, unidad: string, series: number) =>
      `${series === 1 ? '1 serie' : `${series} series`} · ${kilos} ${unidad}`,
    soloSeries: (series: number) => (series === 1 ? '1 serie' : `${series} series`),
    nada: '—',
    nadaDesde: (fecha: string) => `nada desde el ${fecha}`,
    notaSeries: 'Cada barra es una semana. Toca una para ver cuántas hiciste.',
    notaKilos: 'Los kilos de todas las series de la semana, sumados.',
    // Sin nada: se dice qué lo llena, sin pedirlo.
    vacio: 'Aparece cuando eliges el ejercicio al entrenar.',

    // Todo el catálogo, como el selector; lo que nunca se hizo lleva un guion.
    maximos: 'Peso máximo por ejercicio',
    maximosNota: 'Lo más pesado que moviste, en una serie o en una marca.',
    conPesoDe: (n: number, total: number) => `${n} de ${total}`,
    // LOS QUE NUNCA HICISTE, detrás de un toque.
    //
    // Antes un grupo abierto mostraba TODAS sus filas: con un ejercicio de
    // pecho anotado de doce, eran doce filas y once guiones. Por seis grupos,
    // la pantalla entera, y hay que bajar muchísimo para pasar de largo.
    //
    // Los vacíos siguen estando —ver el hueco es lo que le da sentido al aviso
    // de estancamiento— pero dejan de ser lo primero que aparece.
    verLosOtros: (n: number) => `Ver los otros ${n}`,
    ocultarLosOtros: 'Ocultar los que no hiciste',

    // En el resumen de un día.
    porMusculo: 'Por músculo',

    // LOS PESOS DE ANTES DE LOS MODOS (migración 39). Una vez, con lo que hay
    // que hacer; después quedan marcados en el calendario.
    revisarAviso: (n: number) =>
      `${n === 1 ? 'Un día tiene' : `${n} días tienen`} pesos de antes de la etiqueta. Si sumaste las dos mancuernas, revísalos.`,
    revisarEntendido: 'Entendido',
    revisarTitulo: 'Por revisar',
    revisarNota: 'Se anotó antes de que existiera la etiqueta. ¿Qué significaba el número?',
    estaBien: 'Está bien así',
    leyendaRevisar: 'por revisar',
  },

  // ---------------------------------------------------------------
  descanso: {
    // Antes decía "Saltar" y saltaba de verdad: el que abría esta pantalla
    // para cambiar la duración y quería volver perdía el descanso. La salida
    // normal de una pantalla es cerrarla, no cancelar lo que estaba haciendo.
    // Limpiar un descanso YA TERMINADO sigue estando, en "Seguir".
    saltar: 'OK',
    cerrar: 'Cerrar',
    // El + sin salir del descanso. Dice lo que pasó, no lo que hace el
    // botón: "hice la serie" es lo que la persona acaba de vivir.
    serieHecha: '+ Serie hecha',
    listoPie: 'Listo. Cuando quieras, la que sigue.',
    seguir: 'Seguir',
  },

  // ---------------------------------------------------------------
  sesion: {
    terminar: 'Terminar',
    // Sin señal, en vez de un botón que no hace nada.
    noEmpezo: 'Sin señal no arrancó. Prueba de nuevo cuando vuelva.',
    noTermino: 'Sin señal no se cerró: la sesión sigue. Prueba de nuevo.',
    label: 'Sesión',
    descansar: 'Descansar',
    listo: 'Listo',
    // PREGUNTA ANTES DE TERMINAR. "Terminar" es el botón sólido y ancho de
    // abajo, o sea el más fácil de tocar sin querer con el teléfono en la
    // mano, y lo que hace no se puede deshacer: cierra la sesión y fija la
    // duración. El precio de preguntar es un toque; el de no preguntar es el
    // entrenamiento.
    terminarPregunta: '¿Terminar la sesión?',
    terminarLlevas: (series: number, tiempo: string) =>
      series === 1 ? `1 serie, ${tiempo}.` : `${series} series, ${tiempo}.`,
    seguir: 'Seguir entrenando',
    guardando: 'Guardando…',
    // LA SESIÓN QUE SE CERRÓ SOLA (migración 37). Dice qué pasó, cuánto quedó,
    // y qué hacer si seguías: iniciar otra suma al mismo día, y el rato
    // muerto del medio no cuenta en ninguna de las dos.
    seCerroSola: (hora: string, duracion: string) =>
      `La sesión se cerró sola a las ${hora} y duró ${duracion}. Si sigues, inicia otra.`,
    seCerroSinDuracion:
      'Se cerró sola tras dos horas sin tocar nada: queda sin duración. El día cuenta.',
    nuevoRango: 'Nuevo rango',
    // QUÉ GANASTE, dicho (15/9). Antes aparecía el nombre y nada más: se subía
    // de rango y no se enteraba nadie.
    rangoDia: (dias: number) => `Día ${dias}`,
    rangoDesde: (antes: string) => `Dejaste atrás ${antes.toLowerCase()}.`,
    rangoSeguir: 'Toca para seguir',

    // EL RESUMEN DEL FINAL. Terminar un entrenamiento era el momento más
    // vacío de la app: la hoja se cerraba y no pasaba nada. Es el instante de
    // más satisfacción ganada del día y no decía una palabra.
    //
    // Se dicen DOS números y nada más. Ni felicitaciones ni consejos: el
    // mérito ya es de quien entrenó, y una app que aplaude de más se vuelve
    // ruido a la tercera vez.
    // EL BLOQUE. "Voy a hacer tres de esto" y la app cuenta hacia ahí.
    queEstasHaciendo: 'En qué estás',
    // No dice "ninguno" ni "sin elegir": elegir ejercicio es opcional de
    // verdad, y las dos palabras suenan a que falta algo.
    sinEjercicio: 'Cualquier cosa',
    cuantasVasAHacer: 'Cuántas vas a hacer',

    // CAMBIÉ DE EJERCICIO / ME EQUIVOQUÉ DE EJERCICIO. Son dos cosas
    // distintas y la app no puede adivinar cuál fue: si ya hay series
    // contadas, pregunta. Sin nada contado no pregunta nada — las dos
    // respuestas harían lo mismo.
    deCual: (n: number) =>
      `Llevas ${n} ${n === 1 ? 'serie' : 'series'} sin cerrar. ¿De cuál eran?`,
    eranDe: (nombre: string) => `Eran de ${nombre}`,
    deMeta: (hechas: number, meta: number) => `${hechas} de ${meta}`,
    totalHoy: (n: number) => `${n} en total`,
    // Aparece recién con la meta cumplida. No dice "terminar" porque no
    // termina nada: abre el siguiente.
    // EL PESO DEL BLOQUE. Sin rótulo largo: el campo al lado del ejercicio con
    // la unidad adentro ya dice qué es. Lo que no se ve solo —que vale para
    // las series QUE VIENEN— lo dice el globo de la primera vez.
    pesoDelBloque: 'Peso de las próximas series',
    pesoSubir: 'Más peso',
    pesoBajar: 'Menos peso',
    pesoDeSerie: (n: number) => `Peso de la serie ${n}`,
    sinPeso: '—',
    // QUÉ SIGNIFICA EL NÚMERO (migración 38). Va pegado al campo, después de la
    // unidad: "30 kg · por mancuerna". Nunca pide discos ni hace sumar: se
    // escribe lo que está impreso en lo que agarraste.
    carga: {
      total: 'en total',
      par: 'por mancuerna',
      parPolea: 'de cada lado',
      // NO DICE "una mancuerna". El modo sirve para cualquier ejercicio a un
      // lado por vez —una extensión de cuádriceps unilateral es una máquina, y
      // ninguna mancuerna—, y el nombre viejo la dejaba afuera.
      una: 'un lado por vez',
      lastre: 'de lastre',
    },
    // Al tocar la etiqueta. Dicen QUÉ número escribir, no el nombre del modo.
    cargaOpcion: {
      total: 'Barra o máquina: el total',
      par: 'Dos mancuernas: el peso de una',
      parPolea: 'Dos poleas: el de cada lado',
      una: 'Un lado por vez: ese peso',
      lastre: 'Lastre: sin contar tu peso',
    },
    cargaCambiar: 'Qué significa este número',
    // Debajo del campo, solo cuando lo escrito no es el total. Además de
    // informar, delata al que escribió la suma: "120 kg en total" en un curl
    // se ve raro enseguida.
    enTotal: (n: string, unidad: string) => `${n} ${unidad} en total`,
    // LA PREGUNTA DE LA PRIMERA VEZ, para los ejercicios cuyo nombre no dice
    // con qué se hacen. Una vez, y se recuerda.
    conQueLoHaces: (nombre: string) => `¿Con qué haces ${nombre.charAt(0).toLowerCase()}${nombre.slice(1)}?`,
    conQueNota: 'Se pregunta una vez. Si un día cambia, toca la etiqueta del peso.',
    respuestaCarga: {
      par: 'Dos mancuernas',
      total: 'Barra o máquina',
      una: 'Un lado por vez',
    },
    // CON LA META CUMPLIDA, el + se convierte en esto y lleva a la lista.
    // Antes acá decía "Siguiente", que no dice de qué es siguiente y encima
    // vivía en un botón de texto que no se veía.
    terminarSerie: 'Terminar serie',
    // Y sumar otra sigue estando, en el lugar secundario: pasarse de la
    // meta es normal y la app no puede dejar de permitirlo solo porque el
    // botón grande cambió de trabajo.
    sumarOtra: 'Sumar otra',

    // LA LISTA DE LO HECHO. El − solo arregla el bloque en curso; si te
    // equivocaste hace veinte minutos no había forma de volver.
    verLista: 'Ver lista',
    listaTitulo: 'Lo que llevas hoy',
    listaVacia: 'Todavía no contaste ninguna serie.',
    listaAhora: 'en curso',
    listaQuitar: 'Quitar este bloque',
    // El nombre del ejercicio de un bloque cerrado se toca para corregirlo:
    // "anoté press de banca y era inclinado". Las series y los pesos se quedan.
    listaCambiarEjercicio: (nombre: string) => `${nombre}: cambiar el ejercicio`,
    listaQuitarPregunta: '¿Quitar?',

    resumenTitulo: 'Listo por hoy.',
    resumenMinutos: 'minutos',
    resumenSeries: (n: number) => (n === 1 ? 'serie' : 'series'),
    // Cuando la cerró la salida del gimnasio, no un botón.
    resumenSolo: 'Se cerró cuando saliste.',
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
    privado: 'Solo lo ves tú. Nunca se comparte ni se muestra.',
  },

  // ---------------------------------------------------------------
  // La hoja que registra el día.
  registrar: {
    sumarAlDia: 'Sumar al día',
    diaN: (n: number) => `Día ${n}`,
    corregirDia: 'Corregir día',
    foto: 'Foto',
    agregarFoto: 'Agregar foto',
    // En la app nativa son dos puertas: la cámara y la galería.
    sacarFoto: 'Sacar foto',
    elegirFoto: 'Elegir de la galería',
    quitarFoto: 'Quitar la foto',
    laVenAmigos: 'La ven tus amigos ✓',
    soloLaVesVos: 'Solo la ves tú — toca para compartirla',
    peso: 'Peso',
    diaYaRegistrado: 'Este día ya está registrado.',
  },

  // ---------------------------------------------------------------
  // "¿LO GUARDO COMO MARCA?", al terminar (`nucleo/marcaSugerida.ts`). Con el
  // dato ya escrito: la única pregunta es a cuántas repeticiones.
  marcaSugerida: {
    // NO DICE "más que tu marca", y ese cambio es del 16/9/2026. Antes lo
    // afirmaba porque comparaba el peso crudo contra el 1RM de la marca, o sea
    // mal. Ahora se pregunta cuando PUEDE serlo y quien contesta las
    // repeticiones es quien lo define: el texto no puede prometer más que eso.
    puedeSerMarca: (peso: string, unidad: string, nombre: string) =>
      `Hiciste ${peso} ${unidad} en ${minuscula(nombre)}. Puede ser marca nueva.`,
    primera: (peso: string, unidad: string, nombre: string) =>
      `Hiciste ${peso} ${unidad} en ${minuscula(nombre)}. ¿La guardo como marca?`,
    cuantas: 'A cuántas repeticiones:',
    no: 'No',
    guardada: 'Guardada como marca.',
    // Cuando el número que eligió la persona SÍ superó la marca anterior.
    guardadaEsNueva: 'Guardada. Es tu marca nueva.',
    fallo: 'No se guardó. La puedes cargar desde Fuerza.',
  },

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
    sesionCerrada: 'Se cerró la sesión. Vuelve a entrar.',
  },

  // ---------------------------------------------------------------
  // El recorte de la foto de perfil.
  recorte: {
    titulo: 'Encuadrá tu foto',
    sub: 'Arrastrala y agrandala hasta que quede como quieres.',
    etiqueta: 'Recortar la foto',
    acercar: 'Acercar',
    trabajando: 'Recortando…',
    usar: 'Usar esta foto',
    noSeAbre: 'Esa imagen no se abre.',
    noSeRecorta: 'El recorte no salió.',
  },

  // ---------------------------------------------------------------
  album: {
    titulo: 'Álbum',
    vacioTitulo: 'Ninguna foto todavía.',
    vacioPie: 'Al registrar un día puedes sumar una: queda pegada al planeta de ese día.',
    // Para una foto el verbo es QUITAR, nunca borrar ni sacar (regla 4 de
    // spec/idioma.md). Decía "Borrar" hasta el 18/9; §54 lo mira ahora.
    quitarPregunta: '¿Quitar?',
    si: 'Sí',
    no: 'No',
    soloVos: 'Solo tú',
    amigos: 'Amigos',
    quitarFoto: 'Quitar foto',
    noSeQuito: 'Esa foto sigue ahí. Prueba de nuevo.',
    vacio: 'Todavía no hay fotos.',
    // El visor. La grilla ahora solo muestra: todo lo que se hace con una
    // foto se hace con la foto en grande.
    anterior: 'Foto anterior',
    siguiente: 'Foto siguiente',
    deSubida: 'Subiste de rango',
  },

  // ---------------------------------------------------------------
  social: {
    titulo: 'Ranking',
    amigos: 'Amigos',
    buscarGente: 'Buscar gente',
    // El título decía "Leaderboard" mientras la barra de abajo decía
    // "Ranking": la misma pantalla con dos nombres. Manda el de la barra.
    // Solo para quien lee la pantalla en voz alta: el punto de la barra no
    // tiene texto, y sin esto sería un elemento mudo.
    tePidieron: (n: number) =>
      n === 1 ? 'Tienes 1 cosa sin responder' : `Tienes ${n} cosas sin responder`,
    aceptar: 'Aceptar',
    no: 'No',
    teReto: (nombre: string) => `${nombre} te retó a 7 días: quien entrene más, gana.`,
    acepto: 'Acepto',
    paso: 'Paso',
    vos: 'tú',
    yoEnLista: (nombre: string) => `${nombre} (tú)`,
    vacioTitulo: 'Tu cielo todavía está vacío.',
    vacioPie: 'Busca a alguien más abajo y empieza la constelación.',
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
  },

  // ---------------------------------------------------------------
  // Errores de auth. Lo importante: NO todos los fallos son "contraseña
  // equivocada"; decirlo cuando no hay red manda a probar contraseñas para
  // siempre.
  errores: {
    malConfigurada:
      'La app no está bien configurada y no puede hablar con el servidor. No es tu contraseña.',
    sinConexion: 'No hay conexión con el servidor. Fíjate si tienes internet y prueba de nuevo.',
    sinConfirmar: 'Falta confirmar la cuenta desde el correo que te llegó.',
    demasiadosIntentos: 'Demasiados intentos seguidos. Espera unos minutos.',
    noCoinciden: 'Ese correo y esa contraseña no coinciden.',
    yaHayCuenta: 'Ya hay una cuenta con ese correo. Prueba entrar, o pide una contraseña nueva.',
    claveCorta: 'La contraseña tiene que tener al menos 6 caracteres.',
    noEsImagen: 'Eso no parece una imagen.',
    imagenPesada: 'La imagen pesa demasiado. Prueba con una más liviana.',
    noSubioFoto: 'La foto no subió. Prueba de nuevo.',
    fotoSinGuardar: 'La foto subió pero no quedó guardada. Prueba de nuevo.',
    noSeQuitaronFotos: 'No se pudieron quitar tus fotos. Prueba de nuevo.',
    noSeElimino: 'La cuenta sigue aquí: no se eliminó. Prueba de nuevo.',
    algoFallo: 'Algo falló al entrar. Prueba de nuevo en un momento.',
  },

  // ---------------------------------------------------------------
  yo: {
    // El globo de la primera vez. Desde el 19/9 el perfil muestra las fotos
    // como las ve un amigo y no se administran acá: lo que no se entiende solo
    // es eso, y dónde se elige.
    globo: 'Aquí ves tus fotos como las ven tus amigos. Cuáles compartes se elige en el Álbum.',
    cambiarFoto: 'Cambiar la foto de perfil',
    subiendoFoto: 'subiendo la foto…',
    deRacha: (n: number) => `${n} de racha`,
    fotoActualizada: 'Foto actualizada.',
    noSePudoEliminar: 'No se eliminó. Prueba de nuevo.',
    fotosPie: 'Son las que ven tus amigos. Cuáles compartes se elige en el Álbum.',
    sinFotos: 'Tus amigos todavía no ven ninguna foto tuya. Cuáles compartes se elige en el Álbum.',

    amigos: 'Amigos',
    eliminar: 'Eliminar',
    no: 'No',
    quitar: 'Quitar',
    // El link para buscar está justo arriba: repetir dónde se buscan sobraba.
    sinAmigos: 'Todavía no agregaste a nadie.',
    noSeSumoLaFoto: 'La foto no se sumó al día. Prueba de nuevo.',
    // Nace compartida: es la única puerta para sumar una foto sin registrar
    // el día, y vive en la pantalla de lo que ven tus amigos.
    sumarFotos: 'Sumar una foto',
  },

  // ---------------------------------------------------------------
  // LA CAJA NEGRA de la app nativa (`movil/src/cajaNegra.ts`): lo que se ve
  // cuando algo falla al arrancar, en vez de una pantalla negra.
  diagnostico: {
    boton: 'Diagnóstico',
    fallo: 'Algo falló',
    noArranco: 'La app no terminó de arrancar',
    explica: 'Esto es lo que pasó, en orden. Compártelo para saber qué arreglar.',
    compartir: 'Compartir el detalle',
    seguir: 'Seguir igual',
    cerrar: 'Cerrar',
  },
} as const;
