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
// EL INGLÉS (14/10/2026): esto es `ES`, y `textos-en.ts` tiene la misma forma
// (`Textos`): el tipo obliga al otro a estar completo, así que no se puede
// olvidar una clave. `T` es el que se usa; `usarTextos` lo pisa EN SU LUGAR
// —los objetos y los arreglos son los mismos, cambia lo de adentro—, así que
// ningún componente cambia y lo que guardó una referencia (`DIAS_SEMANA`) se
// entera solo.
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

const ES = {
  // En qué idioma están estos textos: se lo dice a la base para los avisos push (migración 77).
  idioma: 'es' as 'es' | 'en',
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
    // Desde la migración 79 (15/10) vuelven todas juntas al cerrarse el ciclo.
    notaJuntas: 'Si faltas un día se usa una y la racha sigue. A los 30 días vuelven todas juntas.',
    vuelvenJuntas: (dia: string, n: number) => (n <= 1 ? `Vuelve el ${dia}.` : `Vuelven las ${n} juntas el ${dia}.`),

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
      // EL AVISO NUEVO (19/10, a pedido): colores fijos, dos botones redondeados y el link.
      // El día o los días llegan ya escritos («16 de octubre», «15, 16 y 17 de octubre»).
      textoUno: (dia: string) => `No registraste el ${dia}. Usa la vida para no perder la racha.`,
      textoVarios: (dias: string) => `No registraste los días ${dias}. Usa la vida para no perder la racha.`,
      usarVida: 'Usar vida',
      guardarVida: 'Guardar vida',
      bajaDiez: '(la racha baja 10 días)',
      // El globito, cuando la vida ya se plantó en el día.
      vidaGastada: 'Salvaste un día, pero pierdes una vida.',
      // LA TERCERA SALIDA (18/10, a pedido): "Fui" en los días del aviso, sin gastar la vida.
      // «Corregí» a pedido: es la única excepción a la regla del voseo de test:db.
      // Con varios días, en plural (19/10).
      fuiCorregi: (n: number) => (n === 1 ? 'Fui. Corregir día' : 'Fui. Corregir días'),
      corregidaTitulo: 'Fuiste.',
      corregidaDetalle: (n: number) =>
        n === 1 ? 'Día corregido, no se gastó ninguna vida.' : 'Días corregidos, no se gastó ninguna vida.',
      listo: 'Listo',
      noSeCorrigio: 'Sin señal no se corrigió: la vida sigue usada. Prueba de nuevo.',
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
    // Un día que faltaste y cubrió una vida (15/10): que se note en el calendario.
    leyendaVida: 'Vida usada',
    // El botón que abre el calendario del mes, debajo del año (15/10).
    corregirDias: 'Corregir días',
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
    noCargo: 'No se pudo cargar este día. Revisa la conexión y vuelve a abrirlo.',
    series: (n: number) => (n === 1 ? '1 serie' : `${n} series`),
    // Series que se contaron sin decir en qué. Existen y suman; solo no se
    // sabe de qué fueron.
    sinEjercicio: 'Sin ejercicio',
    // "60, 60 kg" · "30, 30 kg por mancuerna". El modo sale del bloque, no del
    // catálogo: es lo que quedó escrito ese día.
    pesosDeSeries: (lista: string, unidad: string, carga: 'total' | 'par' | 'parPolea' | 'una' | 'lastre' | 'corporal' = 'total') =>
      `${lista} ${unidad}${
        { total: '', par: ' por mancuerna', parPolea: ' de cada lado', una: ', un lado por vez', lastre: ' de lastre', corporal: '' }[carga]
      }`,
    // Al lado del nombre, en la lista de ejercicios: "60 kg" · "30 kg c/u".
    // Corto a propósito: es para leer de un vistazo, no una explicación.
    pesoEnLista: (peso: string, carga: 'total' | 'par' | 'parPolea' | 'una' | 'lastre' | 'corporal') =>
      peso + { total: '', par: ' c/u', parPolea: ' c/lado', una: '', lastre: ' de lastre', corporal: '' }[carga],
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
    cardio: 'Cardio',
    buscar: 'Buscar ejercicio',
    parecidos: 'Entrenan lo mismo',
    nadaConEseNombre: 'Ninguno con ese nombre.',
    agregarPropio: (nombre: string) => `+ Agregar «${nombre}»`,
    nuevoPropio: '+ Ejercicio propio',
    nombreDelPropio: 'Nombre del ejercicio',
    // LOS PROPIOS SON DE QUIEN LOS CREÓ (15/10): el de otra persona se ve así, sin nombre.
    propioAjeno: 'Ejercicio propio',
    // ¿YA ESTÁ? Antes de crear uno que significa lo mismo que otro ("press plano" y Press de banca).
    yaEsta: (nombre: string) => `Ya está: «${nombre}».`,
    usarEse: 'Usar ese',
    crearIgual: 'Crear igual',
    queMusculo: '¿Qué entrena?',
    crear: 'Agregar',
    seMideEnMinutos: 'Se anota en minutos.',
    grupos: {
      pecho: 'Pecho',
      espalda: 'Espalda',
      hombros: 'Hombros',
      brazos: 'Brazos',
      piernas: 'Piernas',
      core: 'Core',
      cardio: 'Cardio',
    } as Record<string, string>,
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
    // El día uno: el botón invita a empezar en vez de nombrar una tarea. En
    // tú neutro (§54), como el resto de la app.
    registrarPrimerDia: 'Registra tu primer día',
    diaRegistrado: 'Día registrado',
    // CUANTO DURO, debajo del rotulo (25/9). "Me gustaba que apareciera el
    // tiempo". Las series no: el bloque ya las cuenta mientras entrenas y, una
    // vez terminado el dia, el numero que queda diciendo algo es el rato que
    // estuviste.
    minutosDeHoy: (n: number) => `${n} minutos hoy`,
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
    // El renglón de pasos de hoy, debajo del número de la racha. Compacto y en
    // voz baja: no es la racha, es el dato que el teléfono ya tiene. Solo
    // aparece si Health está conectado y hay pasos que mostrar.
    pasosHoy: (hechos: string, meta: string) => `${hechos} de ${meta} pasos`,
    // Los pasos con barra (5.1): el número es tuyo, la meta va chica al lado, y
    // al llegar la meta se convierte en un ✓ que se celebra.
    pasosUnidad: 'pasos',
    pasosMetaChica: (meta: string) => `meta ${meta}`,
    pasosMetaLlego: '✓ meta',
    // EL FESTEJO (15/10): la primera vez del día que Inicio la ve cumplida.
    pasosFestejo: '¡Meta de pasos!',
    pasosCambiarMeta: 'Cambiar la meta de pasos',
    // El resumen de hoy queda a un toque, después de registrar el día: ya no se
    // borra solo al tocarlo, y si lo cerraste podés volver a abrirlo (1.2/5.4).
    verResumen: 'Ver lo que hiciste hoy',
    diaPendiente: 'Tu día de hoy quedó anotado y se suma solo. No lo perdiste.',
    sumarSerie: 'Sumar una serie',
    // La nota de arriba está debajo del contador y se lee tarde: la primera
    // vez, el + aparece sin ninguna explicación y parece un botón de confirmar.
    // Esto se dice una sola vez, arriba, donde se está mirando.
    // UN RENGLÓN (15/10): el globito flota y da calidad, no explica.
    globoSeries: 'Toca + al terminar cada serie.',
    // El atajo de las teclas, como SEGUNDO renglón del mismo globo. Aparte y
    // no metido en la frase de arriba: esa ya explicaba el +, y sumarle el
    // atajo adentro la volvía un párrafo. Un globo aparte sería un segundo
    // cartel que sacarse de encima.
    // Un cronómetro que aparece andando sin que lo hayas tocado se lee como un
    // error de la app. Con una línea deja de serlo.
    sesionSola: 'Arrancó sola cuando llegaste. Se corta al irte, o cuando quieras.',
    diaDeshecho: 'Muy corta para contar como día. Se deshizo.',
    sacarSerie: 'Sacar una serie',
    // Discreto y permanente mientras no haya punto: es el diferencial de la
    // app y vivía escondido en Ajustes.
    gimnasioRecordatorio: 'Marca tu gimnasio: el día entra al abrir la app estando ahí.',
    // EL MISMO RECORDATORIO, SIN EL TECHO DE LA WEB (24/9). Acá el día entra
    // de verdad con la app cerrada, así que decir "al abrir la app" sería
    // vender de menos justo lo que diferencia a esta app.
    gimnasioRecordatorioNativo: 'Marca tu gimnasio: el día entra solo al llegar.',
    // LA INSISTENCIA, justo después de registrar el día a mano. Dice lo que
    // acaba de pasar y lo que podría pasar la próxima; no promete nada que la
    // app no haga ya, y no reta a nadie por no haberlo marcado antes.
    // Un renglón que lleva a Ajustes y resalta el botón de marcar (15/10).
    insistirGimnasio: 'Deja que se marque solo',
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
    // LA ENTRADA NUEVA (15/10): cuatro pantallas, una cosa real de la app cada una.
    // Los rangos se ven en el fondo y no se explican (§7).
    pesosTitulo: 'Ya no adivines los pesos',
    pesosBajada: 'Anota cada serie para la próxima vez que entrenes.',
    llegarTitulo: 'El día se anota solo al llegar',
    llegarBajada: 'Anota la ubicación del gimnasio para que se anote automático.',
    amigoTitulo: 'Entrena con un amigo y mira lo que hace, en vivo',
    amigoBajada: 'Su ejercicio, su serie y cuánto le queda de descanso.',
    rankingTitulo: 'Demuestra que eres el mejor de tus amigos',
    crear: 'Crear cuenta',
    entrar: 'Ya tengo cuenta',
    // El circulito que carga y deja pasar: no tiene texto, esto es para el lector de pantalla.
    siguiente: 'Siguiente',
    // Lo que se ve arriba de cada texto: un pedazo de la app, con datos de muestra.
    muestraEjercicio: 'Press de banca · pecho',
    muestraLaUltimaVez: 'la última vez',
    muestraDeCamino: 'De camino al gimnasio',
    muestraLlegaste: 'Llegaste al gimnasio · día anotado',
    muestraEntrenandoContigo: 'Entrenando contigo',
    muestraSentadilla: 'Sentadilla',
    muestraRemo: 'Remo con barra',
    muestraSerie: (ejercicio: string, n: number, de: number) => `${ejercicio} · serie ${n} de ${de}`,
    muestraDescanso: 'descanso',
    muestraHaciendoLaSerie: 'haciendo la serie',
    muestraDescansa: 'descansa',
    muestraAhora: 'ahora',
  },

  // ---------------------------------------------------------------
  // LA TARJETA DE LA PANTALLA BLOQUEADA (build 8, 15/10): la manda la app ya
  // armada, en su idioma. Los rótulos van en mayúsculas, como en la app.
  tarjeta: {
    descanso: 'DESCANSO',
    listo: 'LISTO',
    entrenando: 'ENTRENANDO',
    serie: (n: number, de: number) => (de > 0 ? `Serie ${n} de ${de}` : `Serie ${n}`),
    pasos: (n: number) => `${n.toLocaleString('es')} pasos`,
    // EL CARDIO (20/10): en vez de la cuenta del descanso, los pasos y los km de esta vuelta.
    cardio: 'CARDIO',
    pasosYKm: (n: number, km: string) => `${n.toLocaleString('es')} pasos · ${km} km`,
  },

  // ---------------------------------------------------------------
  // LOS GLOBITOS DE LA PRIMERA VEZ (15/10): uno por cosa, saliendo de lo que
  // explican. El del + es `inicio.globoSeries`.
  globos: {
    elegir: 'Busca el ejercicio o elígelo de la lista.',
    descanso: 'Tu descanso. Tócalo para cambiarlo.',
    amigos: 'Agrega amigos para seguir su progreso.',
    album: 'Aquí se ven las fotos de tu progreso.',
    rutina: 'Crea tu rutina',
  },

  // ---------------------------------------------------------------
  // Entrar, crear cuenta y elegir nombre.
  entrar: {
    marca: 'Ascent',
    entrar: 'Entrar',
    crearCuenta: 'Crear cuenta',
    enviarCorreo: 'Enviar correo',
    correo: 'Correo',
    // El ejemplo dentro del campo (21/10: estaba escrito a mano y salía igual en inglés).
    correoEjemplo: 'nombre@correo.com',
    contrasena: 'Contraseña',
    primeraVez: '¿Primera vez? Crear cuenta',
    // Una línea de qué es la app, solo en el alta: quien llega frío tiene que
    // saber qué está por crear antes de dar un correo.
    queEs: 'Ascent lleva tu racha en el gimnasio: un toque por día y no se corta.',
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
    inicio: 'Tu racha: sube con cada día que entrenas. Un toque y sigue.',
    entrenar: 'Arriba, Iniciar entrenamiento: eliges el ejercicio y cada + suma una serie.',
    gimnasio: 'Marca tu gimnasio y el día se registra solo al llegar.',
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
    ahoraNo: 'Ahora no',
    correoEnviado: 'Listo. Te llega un correo con el enlace para cambiarla.',
  },

  // ---------------------------------------------------------------
  // VINCULAR CON MOSS (D27 de Moss, 26/10): la fila de Ajustes › Perfil y su hoja. Vincular es
  // dar permiso para que cada app lea lo de la otra, y la hoja lo dice antes del botón.
  moss: {
    titulo: 'Moss',
    vincularConMoss: 'Vincular con Moss',
    vinculada: 'Vinculada con Moss',
    desvincular: 'Desvincular',
    tuMoss: 'Tu Moss en este iPhone',
    queSeComparte: 'Qué se comparte',
    mossLee: 'Moss lee de Ascent tus sesiones, tus marcas y tu peso.',
    ascentLee: 'Ascent lee de Moss tu sueño, tu comida y tu peso.',
    esPermiso: 'Vincular es dar permiso. Puedes desvincular cuando quieras, desde Ajustes.',
    vincular: 'Vincular',
    vinculando: 'Vinculando…',
    abreMoss: 'Abre Moss y vuelve',
    conseguirMoss: 'Conseguir Moss',
    // La sesión que dejó Moss ya no sirve: Moss la renueva al abrirse.
    vencida: 'La sesión de Moss en este iPhone ya venció. Abre Moss y vuelve.',
    noSeVinculo: 'No se vinculó. Prueba de nuevo.',
    sigueVinculada: 'Sigue vinculada con Moss. Prueba de nuevo.',
  },

  // ---------------------------------------------------------------
  // La guarda de las 20 horas por cambio de zona (§12b). Tiene que decir dos
  // cosas y las dos importan: que el día NO se perdió, y cuándo entra. Un
  // rechazo mudo con la racha en juego se lee como que la app está rota.
  // Sin la palabra "bloqueado" y sin acusar de nada: la persona tiene que
  // entender que su día ESTÁ guardado y que se va a contar, nada más. El caso
  // casi no aparece (el anti-trampa solo frena el flip-flop, no un viaje), pero
  // cuando aparece no puede leerse como que la app se rompió o la está acusando.
  bloqueo: {
    sinHora: 'Tu día de hoy ya quedó guardado y se cuenta solo en cuanto la app lo confirme.',
    aLaHora: (hora: string) =>
      `Tu día de hoy ya quedó guardado. Se cuenta solo a las ${hora}.`,
    enMinutos: (min: number) =>
      `Tu día de hoy ya quedó guardado. Se cuenta solo en ${min} min.`,
  },

  // ---------------------------------------------------------------
  // LAS MEDALLAS POR MARCA. Van al lado del nombre, en tu perfil y en el de
  // tus amigos. Reemplazaron a los retos, que salieron el 23/9: un reto
  // necesita un rival y esto funciona con un usuario o con cien.
  medallas: {
    // AL TOCAR UNA. Es impersonal a propósito: así sirve igual en tu perfil y
    // en el de un amigo, sin cambiar una letra. Una sola línea.
    //
    // DICE "ESA MARCA" Y NO "ESTE PESO" desde el 25/9, y es por el máximo
    // histórico: el percentil que se muestra es el mejor que se alcanzó
    // alguna vez, no el que da el peso corporal de hoy. "Este peso" sonaba a
    // lo que levantás ahora y podía quedar mintiendo; "esa marca" nombra la
    // que ganó la medalla, que es la verdad que el número cuenta.
    frase: (porciento: number) => `Solo el ${porciento}% levanta esa marca.`,
    // LA GALAXIA NO DICE PERCENTIL, dice qué la ganó. Con el percentil diría
    // "solo el 5%", el mismo número que estrella, y en el escalón más alto eso
    // queda plano. Acá tampoco va el rótulo del ejercicio arriba: la línea ya
    // nombra los tres.
    galaxia: 'Estrella en sentadilla, press de banca y peso muerto.',
    // EL MUSCULO, NO LA ZONA (25/9). Decian "Brazos" y "Piernas", que es el
    // cajon del selector de ejercicios y no lo que la medalla mide: la de
    // brazos se gana con curl con barra y la de piernas con sentadilla, o sea
    // biceps y cuadriceps. "Piernas" con una marca de sentadilla suena a que
    // incluye femoral y gemelo, que no participaron.
    //
    // JUNTAR VARIOS EJERCICIOS DEL MISMO MUSCULO EN UN PORCENTAJE no se puede
    // y se miro: las tablas de Strength Level son POR EJERCICIO, no por
    // musculo, asi que un percentil de "cuadriceps" no existe en ningun lado
    // y habria que inventarlo promediando. Queda el musculo del ejercicio, que
    // es exactamente lo que el numero dice.
    //
    // Las claves NO cambian: son las cinco zonas de `nucleo/medallas.ts` y del
    // dibujo. Lo que cambio es como se llaman en pantalla.
    zonas: {
      hombros: 'Hombros',
      brazos: 'Bíceps',
      pecho: 'Pecho',
      espalda: 'Espalda',
      piernas: 'Cuádriceps',
    },
    materiales: {
      luna: 'Luna',
      planeta: 'Planeta',
      estrella: 'Estrella',
      galaxia: 'Galaxia',
    },
    // Lo que lee un lector de pantalla, que no ve ni la forma ni el color.
    // NOMBRA EL MATERIAL aunque la frase ya no lo haga: para quien ve, el
    // material es el color y se ve; para quien no, es la unica forma de saber
    // que la de pecho es mas alta que la de hombros.
    etiqueta: (zona: string, material: string) => `${zona}, ${material.toLowerCase()}`,
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
    loDemasNota: 'Anótalas todas las que quieras. Estas no entran al número.',
    ningunaCargada: 'Sentadilla, press de banca y peso muerto. Ninguna cargada todavía.',
    esLaUnica: 'Es la única que anotaste.',
    cuantasAnotaste: (n: number) => `Anotaste ${n}. Vale la mejor.`,
    otraDe: (nombre: string) => `Otra de ${nombre}`,
    // Borrar una marca pregunta (4/10): en el teléfono se anota siempre con la
    // fecha de hoy, así que una marca vieja borrada sin querer no se rehace.
    borrarSeguro: 'La fecha no se puede volver a poner. ¿La borro igual?',
    borrarSi: 'Borrarla',
    noSeBorro: 'No se borró. Prueba de nuevo.',
    vacioTitulo: 'Todavía no cargaste ninguna.',
    vacioPie: 'Sentadilla, banca y peso muerto son las tres que arman tu número.',
    sinNada:
      'Sentadilla, banca y peso muerto arman un número comparable con tus amigos.',
  },

  // ---------------------------------------------------------------
  ajustes: {
    titulo: 'Ajustes',
    avanzados: 'Ajustes avanzados',
    // El peso por serie se puede apagar entero: el que no quiere anotar nada no
    // tiene por qué ver un campo vacío en cada bloque.
    pesoPorSerie: 'Peso de cada serie',
    pesoPorSerieSi: 'Anotarlo',
    pesoPorSerieNo: 'No anotarlo',
    pesoPorSerieNota: 'Si lo apagas, el campo de peso no aparece al entrenar. Lo que ya anotaste se queda.',
    // Tres cosas que cambian cómo funciona la app y que nadie encuentra si
    // no se las nombra una vez.

    comparteGimnasio: 'Avisar cuando entreno',
    comparteRutina: 'Mostrar mi rutina',
    diasDescanso: 'Días de descanso',
    diasDescansoNota: 'Esos días puedes faltar sin perder la racha.',


    // La seccion quedo con el sonido solo: los cinco presets de duracion se
    // sacaron el 23/9 y ya se elegian dentro de la pantalla del descanso.
    avisoDelDescanso: 'Aviso del descanso',
    descansoEntreSeries: 'Descanso entre series',
    descansoNota: 'Mientras descansas lo puedes cambiar ahí mismo.',
    sonidoPrendido: 'Sonido al terminar ✓',
    // Al lado de un interruptor (15/10): el estado lo dice el interruptor.
    sonidoAlTerminar: 'Sonido al terminar',
    // Al entrenar, debajo del ejercicio (20/10). Apagado de fábrica.
    mostrarUltimaVez: 'Mostrar la última vez',
    mostrarUltimaVezNota: 'Al entrenar, debajo del ejercicio: lo que hiciste la última vez.',
    // Al lado del peso, una por serie (21/10). Apagado de fábrica.
    registrarReps: 'Registrar repeticiones',
    registrarRepsNota: 'Al entrenar, al lado del peso: cuántas hiciste en cada serie.',
    // Las secciones de Ajustes (21/10).
    seccionEntrenamiento: 'Entrenamiento',
    seccionPerfil: 'Perfil',
    seccionGeneral: 'General',
    sonidoApagado: 'Sonido al terminar — apagado',
    vibra: 'Vibra al terminar, con la app abierta. Si la cierras, no avisa.',
    noVibra: 'Tu teléfono no vibra desde la web: el aviso es visual, con la app abierta.',
    // Las dos frases decían lo contrario de lo que ahora hace la app: el
    // aviso CORTA la música a propósito, porque con auriculares no se escucha
    // de ninguna otra forma.
    // DICE LO CONTRARIO QUE HASTA EL 25/9, y es el cambio, no una correccion
    // de estilo: la app cortaba la musica y ahora no la toca nunca.
    sonidoRespeta: 'Suena por encima de tu música. Nunca la frena ni la baja.',
    sonidoCorta: 'En este teléfono el sonido puede taparse si tienes música fuerte.',

    gimnasio: 'Mi gimnasio',
    gimnasioMarcar: 'Marcar gimnasio',
    // Debajo del botón: el punto se marca parado en el gimnasio (§13).
    gimnasioEstandoAhi: 'Hay que estar en el gimnasio para marcarlo.',
    gimnasioRemarcar: 'Volver a marcar el gimnasio',
    gimnasioBuscando: 'Buscando…',
    gimnasioBorrar: 'Borrar ubicación',
    gimnasioComo: 'Márcalo parado en la puerta de tu gimnasio.',
    gimnasioParaQue: 'Después, abrir la app estando ahí registra el día sin que aprietes nada.',
    gimnasioTecho: 'Por ahora hay que abrir la app. En la del teléfono va a entrar solo.',
    gimnasioListo: (metros: number) => `Listo, con ${metros} m de precisión.`,
    // En el teléfono, al marcar (14/10): sin nota fija debajo, el permiso se dice acá.
    gimnasioListoNativo: (metros: number) => `Listo, con ${metros} m de precisión. Para que entre solo: ubicación «Siempre».`,
    gimnasioPuesto: 'Ya está marcado. Nadie más lo ve: no se comparte con tus amigos.',
    gimnasioSinGps: 'Este teléfono no da la ubicación.',
    gimnasioSinPermiso:
      'No se pudo leer la ubicación. Fíjate que le hayas dado permiso a la app.',
    // No dice "error": dice qué pasó y qué hacer. Marcar el punto con esta
    // precisión guardaría el barrio en vez del gimnasio, y eso no se nota
    // hasta semanas después, cuando los días entran solos desde tu casa.
    gimnasioImpreciso: (metros: number) =>
      `Te ubica con ${metros} m de error. Sal a la vereda y prueba de nuevo.`,

    // LA SALUD DEL TELÉFONO (§13c). Solo existe en la app del teléfono: el
    // navegador no ve nada de esto, así que en la web esta sección no está.
    salud: 'Salud del teléfono',
    saludConectar: 'Conectar con Salud',
    saludConectando: 'Abriendo…',
    // NUNCA SE DICE "conectado y listo": iOS no cuenta qué concediste al
    // leer, así que afirmarlo sería inventar. Se manda a donde se ve.
    saludListo: 'Listo. En Salud → Ascent puedes ver y cambiar qué lee.',
    // YA CONECTADO. El boton decia "Conectar" para siempre: lo tocabas y no
    // pasaba nada, porque iOS no vuelve a mostrar la ventana una vez
    // contestada. Ahora la seccion dice en que estado esta.
    saludConectado: 'Conectado',
    // NO SE PUEDE AFIRMAR QUE HAY PERMISO: iOS no lo dice para lectura. Lo
    // unico honesto cuando no llega nada es decir donde se revisa.
    saludSinDatos:
      'No llega nada. Si no le diste permiso, está en Salud → Ascent.',
    saludNoHay: 'Este teléfono no tiene Salud.',
    metaPasosTitulo: 'Meta de pasos',
    metaPasosNota: 'Mueve la barra de Inicio y el gráfico de Stats. No entra en tu racha ni la ve nadie.',
    metaPasosFuera: 'Entre 1.000 y 100.000.',
    saludPasos: (pasos: string) => `Hoy llevas ${pasos} pasos.`,

    // EL FONDO. El motor cuesta tres segundos de arranque, medidos: se puede
    // apagar. No dice "gráficos" ni "calidad": dice qué es y qué cuesta.
    fondo: 'El fondo del espacio',
    calidad: 'Calidad del fondo',
    calidadAuto: 'Automática',
    calidadAlta: 'Alta',
    calidadBaja: 'Baja',
    fondoAuto: 'Automático',
    fondoSiempre: 'Siempre',
    fondoNunca: 'Nunca',
    // El automático DICE qué decidió: "automático" a secas es pedir que
    // confíes a ciegas en algo que te cambia la app.
    fondoAutoBueno: 'Tu equipo lo aguanta: está prendido. La app tarda unos segundos más en abrir.',
    fondoAutoFlojo: 'Tu equipo va justo: está apagado y la app abre al instante.',
    fondoAutoNoSe: 'No se sabe cuánto aguanta tu equipo: está prendido. Si tarda en abrir, apágalo.',
    fondoNota: 'Apagado, no se dibuja el espacio: fondo liso y la app abre al instante.',

    nombreUsuario: 'Nombre de usuario',
    nombreNota: 'Así te encuentran tus amigos.',
    nombreListo: 'Listo, ese es tu nombre ahora.',

    fotosNuevas: 'Quién ve tus fotos nuevas',
    soloYo: 'Solo yo',
    amigos: 'Amigos',

    peso: 'Peso',
    kilos: 'Kilos',
    libras: 'Libras',

    // El idioma (14/10). Los nombres de los idiomas van en su idioma, como en todos lados.
    idioma: 'Idioma',
    idiomaEs: 'Español',
    idiomaEn: 'English',

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
    noSeCerro: 'No se pudo cerrar la sesión. Prueba de nuevo con conexión.',
    eliminarCuenta: 'Eliminar mi cuenta',

    // Cuentas bloqueadas (migración 53)
    bloqueados: 'Cuentas bloqueadas',
    bloqueadosCuenta: (n: number) => (n === 1 ? '1 cuenta bloqueada' : `${n} cuentas bloqueadas`),
    bloqueadosVacio: 'No bloqueaste a nadie.',
    bloqueadosPie: 'A quien bloqueas no te ve ni te puede agregar. Puedes desbloquear cuando quieras.',
    desbloquear: 'Desbloquear',

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

    // LO QUE SOLO EXISTE EN EL TELÉFONO (23/9). La zona en el sistema
    // operativo es lo único de la app que sigue vivo con la app cerrada, y
    // por lo tanto lo único que puede estar apagado sin que se note: sin el
    // permiso de "siempre" la app anda igual y el día no entra solo.
    diagZona: 'Zona',
    diagZonaSi: 'registrada en el sistema',
    diagZonaNo: 'no quedó: falta el permiso siempre',
    diagRevisarZona: 'Revisar la zona (diagnóstico)',
    diagRemoto: 'Probar avisos remotos',
    diagRemotoPidiendo: 'Pidiendo el token…',
    diagRemotoNota: 'Le pide un token a Apple y a Expo. No manda ningún aviso ni pide permiso.',
    diagRemotoAparato: 'Apple (el aparato)',
    diagRemotoExpo: 'Expo',
    diagZonaNota:
      'Comprueba que el teléfono vaya a despertar a la app al llegar.',
    // COMPARTIR Y NO COPIAR: en un teléfono, seleccionar doce líneas con el
    // dedo para mandárselas a alguien es una pelea.
    diagCompartir: 'Compartir lo anotado',
    // Es lo unico de la app que solo se puede mirar una vez cada diez dias, y
    // ese ritmo no sirve para ajustar una animacion.
    diagVerSubida: 'Ver la subida de rango (diagnóstico)',
    // POR QUÉ ESTÁ. El gráfico de pasos salió vacío en un teléfono con Health
    // conectado y datos adentro, y desde una computadora no hay forma de ver
    // qué contestó HealthKit. Esto lo dice.
    diagPasos: 'Pasos leídos',
    diagPasosNada: 'todavía no se pidieron',
    // EL MOTOR DEL FONDO. En la web esto lo dice la galería; en el teléfono
    // no había dónde, y un cielo sin ningún cuerpo se ve igual esté apagado
    // a propósito o roto. Los cinco estados son los de
    // `movil/src/estadoDelMotor.ts`.
    diagMotor: 'El fondo',
    diagMotorAndando: 'andando',
    diagMotorApagado: 'apagado — está en "El fondo del espacio", más arriba',
    diagMotorArrancando: 'arrancando',
    diagMotorNoArranco: 'NO arrancó: el teléfono no dio contexto de dibujo',
    diagMotorSinPedido: 'todavía no se pidió',

    // ¿DEJASTE QUE AVISE? El permiso se pide recién al programar el primer
    // descanso, o sea en el gimnasio y con el dedo apurado. Un "no" de hace
    // semanas se ve, desde afuera, igual que una campana rota.
    diagAvisos: 'Avisos',
    diagAvisosSi: 'sí',
    diagAvisosNo: 'NO — hay que prenderlos en Ajustes del teléfono',
    diagAvisosSinDecidir: 'todavía no se preguntó',
    diagAvisosNoSe: 'no se pudo averiguar',

    // EL MEDIDOR DE CUADROS. Los scripts de medir corren Chromium con la CPU
    // frenada y lo dicen ellos mismos: son un piso, no una medición. Y dos de
    // los tirones que hay que revisar —deslizar entre pestañas y el globo de
    // la medalla— solo existen en la app nativa, que esos scripts no abren.
    diagCuadros: 'Medir los cuadros (20 s)',
    diagCuadrosMidiendo: 'Midiendo… usa la app',
    // LA INSTRUCCIÓN ES LA MITAD DE LA HERRAMIENTA: medir la app quieta da 60
    // y no dice nada. Lo que hay que hacer es usarla mientras mide.
    diagCuadrosNota: 'Sal de Ajustes y usa la app: desliza, abre una foto, toca una medalla.',
    // Los tres números van juntos a propósito: un segundo trabado repartido
    // entre veinte buenos da un promedio lindo y se ve horrible. Lo que se
    // siente es el peor cuadro.
    diagCuadrosListo: (fps: number, peor: number, largos: number) =>
      `${fps} cuadros por segundo · el peor tardó ${peor} ms · ${largos} largos`,
    // DÓNDE CAYERON, que es lo que decide si hay algo que arreglar: los mismos
    // largos amontonados al principio son el arranque; repartidos, son la app.
    diagCuadrosArranque: (enElArranque: number, largos: number) =>
      `${enElArranque} de ${largos} fueron en los primeros segundos`,
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
    esteAno: 'Este año',
    // La cuarta celda: la cuenta regresiva de la próxima vida (5.3).
    proximaVidaDias: 'Días · próxima vida',
    proximaVidaDia: 'Día · próxima vida',
    vidasLlenas: 'Vidas al máximo',
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
    // La ventana elegida ("1 mes") no tiene dos anotaciones: antes el gráfico
    // desaparecía entero, con los botones para volver.
    pesoSinVentana: 'En este período no hay dos anotaciones: con menos no se ve una tendencia.',
    pesoVacio: 'Anota tu peso y aquí aparece la tendencia. Solo la ves tú.',
    // EL OBJETIVO DE PESO: un número, no una dirección (ver `pesoObjetivo.ts`).
    objetivoPoner: 'Pon un objetivo de peso',
    objetivoEs: (n: string, u: string) => `Objetivo: ${n} ${u} · cambiar`,
    objetivoLlegado: 'Estás en tu objetivo:',
    objetivoPlaceholder: (u: string) => `Objetivo en ${u}`,
    objetivoFuera: 'Pon un peso entre 20 y 400.',
    objetivoQuitar: 'Quitar',
    objetivoUltimos: 'Últimos registros',
    // LOS PASOS. Son de Apple Health, TODOS los días y no solo los de
    // entrenamiento: un día de descanso con 12.000 pasos es información.
    pasosTendencia: 'Pasos — tendencia 7 días',
    pasosDia: (n: string) => `${n} pasos`,
    pasosPromedio: (dias: number, n: string) => `${dias} días · ${n} por día`,
    // No dice que entrenaste: dice cuánto te moviste. La diferencia está en
    // `plataforma/salud.ts` y también se cuenta acá, porque quien lo mira no
    // leyó ese archivo.
    pasosNota: 'De Apple Health, todos los días. No cuentan como entrenamiento.',
    // LA META DEL DÍA. Es una preferencia de pantalla y se dice como tal: no
    // entra en la racha, no se compara con nadie.
    // ES UN BOTON, no un rotulo: se toca y se cambia la meta ahi mismo. "No la
    // encuentro" fue el reporte, y estaba en Ajustes — o sea, a cuatro toques y
    // dos pantallas de la unica pantalla donde el numero significa algo.
    pasosMeta: (n: string) => `Meta: ${n} por día · cambiar`,
    // Las tres ventanas de los pasos. No son las del peso: la semana con siete
    // barras es una pregunta distinta —"¿cuanto camine CADA dia?"— y por eso
    // tiene su propio dibujo.
    pasosSemana: 'Semana',
    pasosMes: 'Mes',
    pasosAno: 'Año',
    // EL PROMEDIO DE LA SEMANA, arriba y grande (16/10): antes era un renglón chico debajo de las barras.
    pasosPromedioRotulo: 'Promedio diario de pasos',
    pasosPromedioCuando: 'Los últimos 7 días, sin contar hoy',
    pasosSobreMeta: (n: string, meta: string) => `${n} más que tu meta de ${meta}`,
    pasosBajoMeta: (n: string, meta: string) => `${n} menos que tu meta de ${meta}`,
    pasosEnMeta: (meta: string) => `Justo en tu meta de ${meta}`,
    pasosFaltan: (n: string) => `Te faltan ${n}`,
    pasosLlegaste: 'Llegaste a tu meta de hoy.',
    sinDuracion_: (n: number) => `${n} sin duración`,
    masCortas: (n: number) => `${n} de menos de 5 min`,
    rachaDe: (dias: string) => `racha de ${dias}`,
    diaN: (n: number) => `día ${n}`,
    laEscalera: 'Rangos',
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
    // LOS CUATRO DE ABAJO SON DE LA WEB Y NADA MAS. El telefono dejo de tener
    // el selector series/kilos el 25/9 —los kilos por musculo no se pueden
    // comparar entre si— y paso a la pista con la franja de referencia. La web
    // se quedo como estaba a pedido, asi que sus textos se quedan tambien.
    enSeries: 'Series',
    enKilos: 'Kilos',
    notaSeries: 'Cada barra es una semana. Toca una para ver cuántas hiciste.',
    notaKilos: 'Los kilos de todas las series de la semana, sumados.',
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
    // Las repeticiones con el peso máximo (21/10): «60 kg × 8».
    conReps: (n: number) => ` × ${n}`,
    nadaDesde: (fecha: string) => `nada desde el ${fecha}`,
    // LA NOTA EXPLICA LA FRANJA, que es lo unico de la pantalla que hay que
    // explicar una vez. Dice "referencia" y no "meta" a proposito: la app no
    // felicita ni reta a nadie, pinta donde caes y se calla.
    semanaAnterior: 'Semana anterior',
    semanaSiguiente: 'Semana siguiente',
    notaRango: 'La franja es la referencia: 10 a 20 series por músculo cada semana.',
    // Debajo de la nota, para el que se pregunte de donde sale el numero.
    notaRangoPorque: 'Es el tramo donde casi todos progresan. No es una meta.',
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
    // El gráfico de abajo (15/10): los kilos de todas las series de cada semana.
    kilosPorSemana: 'Peso total por semana',

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
    // Desde el botón «Descansar» (21/10): el reloj quieto hasta que se toca esto.
    empezar: 'Empezar descanso',
    // EL TIEMPO A MANO (15/10), hasta una hora: "4" son cuatro minutos y "1:30", uno y medio.
    aMano: 'Poner el tiempo a mano',
    aManoEjemplo: 'Minutos (4 o 1:30)',
    aManoUsar: 'Usar',
    aManoMal: 'Hasta una hora: 4 o 1:30.',
    listoPie: 'Listo. Cuando quieras, la que sigue.',
    seguir: 'Seguir',
    // La pantalla nueva del descanso (12/10): qué se estaba haciendo, arriba.
    rotulo: 'DESCANSO',
    serieDe: (serie: number, meta: number) => (meta >= serie ? `serie ${serie} de ${meta}` : `serie ${serie}`),
    deMas: 'de más',
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
    // De dónde venías NO se dice, en ninguna de las dos apps (teléfono el
    // 23/9, web el 24/9). El texto se borró y no se comentó: uno sin
    // usar es un texto que alguien vuelve a poner dentro de seis meses.
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
    // LA RUTINA QUE SE PROPONE SOLA: lo sugerido se muestra distinto de lo hecho.
    sugerido: 'Sugerido',
    sugeridoNota: 'De tu rutina. Cuenta la primera serie para confirmarlo.',
    // Debajo del ejercicio (19/10): la última sesión que lo tuvo. El detalle viene armado.
    ultimaVez: (fecha: string, detalle: string) => `La última vez, ${fecha}: ${detalle}`,
    // Al elegir el ejercicio (20/10): las series de esa sesión, el peso de la primera y, si esa
    // sesión tuvo marca, sus repeticiones con su peso.
    laPrimeraCon: (peso: string) => `, la primera con ${peso}`,
    conRepeticiones: (n: number, peso: string) => ` · ${n === 1 ? '1 repetición' : `${n} repeticiones`} con ${peso}`,

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
    // El cuadradito de repeticiones (21/10): la unidad va al lado, como el kg del peso.
    repsDeLaSerie: 'Repeticiones de esta serie',
    reps: 'reps',
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
      corporal: 'peso corporal',
    },
    // Al tocar la etiqueta. Dicen QUÉ número escribir, no el nombre del modo.
    cargaOpcion: {
      total: 'Barra o máquina: el total',
      par: 'Dos mancuernas: el peso de una',
      parPolea: 'Dos poleas: el de cada lado',
      // DICE 'DE UN LADO' Y NO 'ESE PESO' desde que 'una' multiplica por dos:
      // el numero que se escribe es el de UN lado, y el total es el doble.
      una: 'Un lado por vez: el de un lado',
      lastre: 'Lastre: sin contar tu peso',
      corporal: 'Peso corporal: sin número, solo las series',
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
    // El cardio (14/10): una vuelta se anota con los minutos, sin descanso después.
    cardioListo: 'Listo',
    // EL GLOBITO DE SUBIR (15/10): todas las series al mismo peso, dos sesiones seguidas.
    yaPuedesSubir: 'Ya puedes subir el peso',
    // Con la regla 2 por 2 (21/10): el rango sugerido, ya con la unidad.
    yaPuedesSubirRango: (desde: string, hasta: string, a: number, b: number) => `Ya puedes subir el peso: de ${desde} a ${hasta} (${a} a ${b} %).`,
    minutosDeCardio: 'Minutos',
    // EL CRONÓMETRO DEL CARDIO (15/10): arranca al elegirlo; "Listo" anota lo que corrió.
    cardioArrancar: 'Arrancar',
    cardioOtraVuelta: 'Otra vuelta',
    cardioTerminar: 'Terminar cardio',
    cardioCorriendo: 'Cardio en curso',
    // Un cronómetro y no un timer (21/10): antes de arrancar, el reloj en 0:00.
    cardioCuentaArriba: 'Cuenta desde cero',
    cardioMeta: (min: number) => `Meta: ${min} min`,
    distancia: 'Distancia',
    cardioSinCronometro: 'Anotar sin cronómetro',
    // Y sumar otra sigue estando, en el lugar secundario: pasarse de la
    // meta es normal y la app no puede dejar de permitirlo solo porque el
    // botón grande cambió de trabajo.
    sumarOtra: 'Sumar otra',
    // "LA PRÓXIMA, MÁS" (10/10): se ofrece al llegar a la meta con el mismo
    // peso en todas las series; la vez siguiente la app propone un disco más.
    proximaMas: 'La próxima, más',
    proximaMasMarcada: (peso: string) => `La próxima: ${peso} ✓`,
    subidaNota: (series: number, antes: string, ahora: string) => `La última: ${series} × ${antes}. Hoy prueba ${ahora}.`,

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
    resumenPasos: 'pasos',
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
    // Varios días del mismo mes (19/10): «15, 16 y 17 de octubre». Los días llegan ya juntados.
    diasDelMes: (dias: string, mes: string) => `${dias} de ${mes}`,
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
    // En la barra de abajo (15/10): la pestaña es más que la tabla. Arriba sigue diciendo Ranking.
    social: 'Social',
    album: 'Álbum',
    stats: 'Stats',
    ajustes: 'Ajustes',
    // No es una pestaña: es la etiqueta del acceso al perfil propio, que en
    // las dos apps vive en la cabecera de Inicio.
    yo: 'Tu perfil',
  },

  // ---------------------------------------------------------------
  peso: {
    titulo: 'Anotar peso',
    sub: 'Solo el peso. No registra el día ni toca la racha.',
    anotarPeso: 'Anotar peso',
    placeholder: (unidad: string) => `Tu peso en ${unidad}`,
    anotar: 'Anotar',
    noDa: 'Ese peso no da.',
    // La pantalla nueva (20/10): la última vez y los botones, para quien no ve la pantalla.
    ultima: (peso: string, unidad: string, fecha: string) => `La última: ${peso} ${unidad} · ${fecha}`,
    restar: (unidad: string) => `Restar 0,1 ${unidad}`,
    sumar: (unidad: string) => `Sumar 0,1 ${unidad}`,
    privado: 'Solo lo ves tú. Nunca se comparte ni se muestra.',
    // CORREGIR Y BORRAR (migración 45). Antes un número mal escrito se
    // quedaba para siempre torciendo la tendencia, que es lo único que ese
    // dato hace.
    anotados: 'Lo que anotaste',
    corregir: 'Corregir',
    borrar: 'Borrar',
    // BORRAR UN DÍA VIEJO NO SE DESHACE: anotar solo escribe hoy, así que
    // ese día no se puede volver a llenar. Se avisa antes, no después.
    borrarSeguro: 'Ese día no se puede volver a anotar. ¿Lo borro igual?',
    borrarSi: 'Borrarlo',
    noSeCorrigio: 'Ese día ya no tiene peso anotado.',
  },

  // ---------------------------------------------------------------
  // La hoja que registra el día.
  registrar: {
    sumarAlDia: 'Sumar al día',
    // El aviso al subir de rango (4.4): se ofrece la foto, no se obliga.
    subioRangoFoto: '¡Subiste de rango! Es el momento de una foto — o no, como prefieras.',
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
    titulo: 'Encuadra tu foto',
    sub: 'Arrástrala y agrándala hasta que quede como quieras.',
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
    // EL ENCABEZADO DEL MES. Dice cuanto fuiste, que es lo que las fotos ya
    // sabian: una por dia entrenado.
    cuentaDelMes: (fotos: number, dias: number) =>
      `${fotos === 1 ? '1 foto' : `${fotos} fotos`} · ${dias === 1 ? '1 día' : `${dias} días`}`,
    laPrimera: 'La primera del mes',
    laUltima: 'La última del mes',
    quitarPregunta: '¿Quitar?',
    // EL BOTON DE CONFIRMAR DICE QUE HACE, no 'Si'. Con dos pildoras iguales
    // al lado, 'Si' y 'No' obligan a acordarse de la pregunta que ya no esta.
    quitarSi: 'Sí, quitarla',
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
    diaDeRacha: (n: number) => `día ${n}`,
  },

  // ---------------------------------------------------------------
  // LA RUTINA COMO ALGO PROPIO (14/10): varias guardadas, una activa, plegada por día.
  rutina: {
    titulo: 'Tu rutina',
    descanso: 'Descanso',
    sinCargar: 'Sin cargar',
    series: (n: number) => (n === 1 ? '1 serie' : `${n} series`),
    minutos: (n: number) => `${n} min`,
    activa: 'Activa',
    usarEsta: 'Usar esta',
    nueva: '+ Nueva',
    nombreBase: 'Entrenamiento',
    // AL TERMINAR, SI SE HIZO OTRO DÍA QUE EL DE LA RUTINA (16/10; ventana propia desde el 19/10).
    reemplazarDiaTitulo: (rutina: string) => `¿Reemplazar el día de la rutina «${rutina}»?`,
    // Dos frases, cada una en su renglón: juntas pasan de dos renglones (la regla de la sección 89).
    cambiarDiaTexto: 'Hoy hiciste distintos ejercicios a los de tu rutina de este día.',
    cambiarDiaPregunta: '¿Quieres reemplazarla o crear otra rutina con este entrenamiento?',
    crearRutinaNueva: 'Crear rutina nueva',
    // AL FINAL DE LA VENTANA, APARTE (20/10): no cambia la rutina y ese día no vuelve a preguntar.
    olvidarDia: 'Olvidar este día',
    estasSeguro: '¿Estás seguro?',
    si: 'Sí',
    no: 'No',
    editar: 'Editar',
    listo: 'Listo',
    borrar: 'Borrar rutina',
    borrarPregunta: (nombre: string) => `¿Borrar ${nombre}? No se puede deshacer.`,
    cancelar: 'Cancelar',
    agregarEjercicio: '+ Ejercicio',
    diaDeDescanso: 'Día de descanso',
    // Prenderlo saca los ejercicios del día: se pregunta (cacería del 15/10).
    descansoPregunta: (dia: string) => `¿${dia} de descanso? Se sacan sus ejercicios.`,
    // COPIAR UN DÍA (16/10): a otro día de esta rutina o de otra.
    copiarEsteDia: 'Copiar este día',
    pegarDia: (origen: string) => `Pegar ${origen}`,
    origenDia: (dia: string, rutina: string) => `el ${dia.toLowerCase()} de «${rutina}»`,
    diaCopiado: 'Copiado. Abre otro día —de esta rutina o de otra— y toca Pegar.',
    diaCopiadoDeAmigo: 'Copiado. Pégalo en un día de tu rutina, en Stats → Entrenamiento.',
    yaTieneEjercicios: (dia: string) => `${dia} ya tiene ejercicios.`,
    reemplazar: 'Reemplazar',
    agregarAlFinal: 'Agregar al final',
    deducida: 'Armada con lo que entrenaste las últimas cuatro semanas.',
    guardarDeducida: 'Guardarla como rutina',
    armarNueva: 'Armar una de cero',
    copiar: 'Copiar esta rutina',
    // Copiar por días (19/10): un círculo por día, y se copian los marcados.
    eligeDias: 'Elige los días que quieres copiar.',
    copiarDias: (n: number) => (n === 0 ? 'Copiar' : n === 1 ? 'Copiar 1 día' : `Copiar ${n} días`),
    // Dice cuál quedó activa, y se puede volver a la de antes con un toque (15/10).
    copiada: (nombre: string) => `Copiada como «${nombre}», junto a las tuyas. La eliges en Stats, en Entrenamiento.`,
    copiadaActiva: (nombre: string) => `Copiada y activa: «${nombre}». La cambias en Stats, en Entrenamiento.`,
    deAlguien: (nombre: string) => `Rutina de ${nombre}`,
    vacia: 'Todavía no hay rutina: entrena unos días o arma una.',
    // El título del día ("Pecho, hombro y brazo"): el músculo en singular y la "y" del final.
    musculos: { pecho: 'pecho', espalda: 'espalda', hombros: 'hombro', brazos: 'brazo', piernas: 'pierna', core: 'core', cardio: 'cardio' } as Record<string, string>,
    y: 'y',
    // ARRASTRAR (15/10): lo que dice el lector de pantalla; con el dedo, se aprieta largo.
    arrastrarAyuda: 'Mantén apretado y arrastra para cambiar el orden.',
    arrastrarPista: 'Mantén apretado un ejercicio para moverlo.',
    subir: 'Subir',
    bajar: 'Bajar',
    // EN INICIO (15/10): el renglón que abre la rutina.
    hoy: (titulo: string) => `Hoy: ${titulo}`,
    armarSemana: 'Arma tu semana',
    // El chip de las repeticiones objetivo (21/10): para el lector de pantalla.
    objetivo: (n?: number) => (n ? `Repeticiones objetivo: ${n}. Toca para cambiarlas` : 'Sin repeticiones objetivo. Toca para poner'),
    // Para el lector de pantalla, en los botones de cada ejercicio (21/10: estaban escritos a mano).
    menos: 'Una serie menos',
    mas: 'Una serie más',
    quitar: 'Quitar el ejercicio',
    hoyRotulo: 'Hoy',
  },

  social: {
    titulo: 'Ranking',
    amigos: 'Amigos',
    buscarGente: 'Buscar gente',
    buscarPie: 'Por nombre de usuario, para agregar.',
    invitar: 'Invitar con tu link',
    invitacion: (url: string) => `Agrégame en Ascent: ${url}`,

    suRutina: 'Su rutina',
    rutinaVacia: 'Todavía no anotó ejercicios en las últimas cuatro semanas.',
    // ENTRENAR CON OTRO (12/10), de a dos: ejercicio, serie y descanso.
    juntos: 'Entrenando contigo',
    unirse: 'Unirse',
    // Lo que contesta la base cuando no se pudo (migración 73). Es de a dos.
    // Desde los grupos (migración 88), "ocupado" es que el grupo llegó a diez.
    unirseOcupado: (nombre: string) => `El grupo de ${nombre} ya está lleno.`,
    unirseYaUnido: 'Ya estás entrenando con alguien. Sal de ese entrenamiento para unirte a otro.',
    unirseNoEntrena: (nombre: string) => `${nombre} ya no está entrenando.`,
    quiereUnirse: (nombre: string) => `${nombre} quiere unirse a tu entrenamiento`,
    esperandoA: (nombre: string) => `Esperando a ${nombre}`,
    salirDeUnion: 'Salir',
    // EL GRUPO (migración 88).
    invitarAlGrupo: 'Invitar al grupo',
    tiraSerie: (serie: number, meta: number) => `serie ${serie}/${meta}`,
    mensajeDeInvitacion: (url: string) => `Entrena conmigo en Ascent: ${url}`,
    sacarDelGrupo: 'Sacar',
    salirDelGrupo: 'Salir del grupo',
    armoElGrupo: 'armó el grupo',
    grupoEntraste: 'Entraste al grupo. Ya eres amigo de quien lo armó.',
    grupoVer: 'Ver el grupo',
    grupoYaEstas: 'Ya estás en ese grupo.',
    grupoLleno: 'Ese grupo ya está lleno.',
    grupoNoExiste: 'Ese link ya no sirve: el grupo terminó.',
    grupoUniendo: 'Entrando al grupo…',
    // La página de la web a la que cae el link del grupo.
    grupoEnlaceTitulo: 'Te invitan a entrenar juntos en Ascent',
    grupoEnlacePie: 'Ábrelo en la app: entras al grupo y quedas amigo de quien lo armó.',
    grupoEnlacePaso3: 'Vuelve a este mismo enlace y toca "Abrir en Ascent": ahí entras al grupo.',
    grupoEnlaceOjo: 'Sin ese último paso no entras.',
    grupoEnlaceMalo: 'Este enlace no lleva a ningún grupo.',
    enVivoSerie: (ejercicio: string, serie: number, meta: number) =>
      serie < 1 ? ejercicio : meta >= serie ? `${ejercicio} · serie ${serie} de ${meta}` : `${ejercicio} · serie ${serie}`,
    enVivoSinDatos: 'Todavía no empezó',
    enVivoDescansa: (falta: string) => `descansa ${falta}`,
    enVivoListo: 'listo',
    enVivoSinSenal: 'sin señal',
    avisoRutina: 'Novedad: tus amigos ahora ven tu rutina, ejercicios y series. Se apaga en Ajustes.',
    // No 'Entendido': así se llama el botón de la ventana de las vidas, y las sondas la cierran por ese texto.
    avisoEntreno: 'Novedad: tus amigos ven cuando estás entrenando, nunca dónde. Se apaga en Ajustes.',
    avisoRutinaEntendido: 'De acuerdo',
    avisoRutinaAjustes: 'Ir a Ajustes',
    enlacePaso1: 'Descárgala en el App Store',
    enlacePaso2: 'Crea tu cuenta.',
    // EL LINK NO SOBREVIVE A LA INSTALACIÓN (15/10): se dice el nombre para buscarlo a mano.
    enlacePaso3: (nombre: string) => `En la app, entra a Social y busca a ${nombre}.`,
    enlaceOjo: 'Su nombre en Ascent, para copiarlo:',
    cerrarFoto: 'Cerrar',
    // El corazón de la foto abierta (19/10): sin corazones no hay número.
    meGusta: 'Me gusta',
    quitarMeGusta: 'Quitar me gusta',
    cuantosMeGusta: (n: number) => (n === 1 ? '1 me gusta' : `${n} me gusta`),
    verFoto: (nombre: string) => `Ver la foto de ${nombre}`,
    // La página de la web a la que lleva el link de amigo.
    enlaceTitulo: (nombre: string) => `${nombre} te invita a Ascent`,
    enlacePie: 'Abre su perfil en la app para agregarlo.',
    enlaceAbrir: 'Abrir en Ascent',
    enlaceSinApp: '¿Todavía no tienes la app? Son tres pasos:',
    enlaceTienda: 'Descarga Ascent en el App Store',
    enlaceMalo: 'Este enlace no lleva a nadie.',
    sinResultado: 'No encontramos a nadie con ese nombre.',
    // El título decía "Leaderboard" mientras la barra de abajo decía
    // "Ranking": la misma pantalla con dos nombres. Manda el de la barra.
    // Solo para quien lee la pantalla en voz alta: el punto de la barra no
    // tiene texto, y sin esto sería un elemento mudo.
    tePidieron: (n: number) =>
      n === 1 ? 'Tienes 1 cosa sin responder' : `Tienes ${n} cosas sin responder`,
    aceptar: 'Aceptar',
    solicitudes: 'Te quieren agregar',
    // El cartel que baja de arriba (14/10): el nombre va en el renglón de arriba.
    cartelAmistad: 'Te quiere agregar',
    cartelUnion: 'Quiere unirse a tu entrenamiento',
    entrenandoAhora: 'Entrenando ahora',
    estaEntrenando: (nombre: string) => `${nombre} está entrenando`,
    // El aviso de la actividad en vivo, la primera vez en Ranking ya con el
    // gimnasio marcado. Explica la función y apunta al opt-in de Ajustes.
    avisoActividad: 'Aquí ves quién está entrenando ahora.',
    no: 'No',
    // "tú" para tu propia fila en el ranking de fuerza (SeccionFuerza).
    vos: 'tú',
    yoEnLista: (nombre: string) => `${nombre} (tú)`,
    vacioTitulo: 'Tu cielo todavía está vacío.',
    vacioPie: 'Busca a alguien más abajo y empieza la constelación.',
    actividad: 'Actividad',
    registroEl: (nombre: string, fecha: string) => `${nombre} registró el ${fecha}`,
    actividadMas: (n: number) => `Ver ${n} más`,
    actividadMenos: 'Ver menos',
    pedidoEnviado: 'Pedido enviado',
    agregar: 'Agregar',

    noExiste: 'Este usuario no existe.',
    pedidoDeAmistad: 'Pedido de amistad enviado',
    cuandoSeanAmigos: 'Cuando sean amigos vas a ver su semana y sus fotos.',
    dejanDeVer: 'Dejan de ver la actividad y las fotos del otro',
    eliminar: 'Eliminar',
    eliminarDeAmigos: 'Eliminar de mis amigos',
    // Denunciar y bloquear (migración 53)
    denunciar: 'Denunciar',
    denunciarOBloquear: 'Denunciar o bloquear',
    denunciaTitulo: '¿Por qué lo denuncias?',
    denunciaMotivos: {
      spam: 'Spam o publicidad',
      acoso: 'Acoso o insultos',
      inapropiado: 'Contenido inapropiado',
      suplantacion: 'Se hace pasar por otra persona',
      otro: 'Otra cosa',
    } as Record<string, string>,
    denunciaEnviada: 'Gracias. Lo vamos a revisar.',
    bloquear: 'Bloquear',
    bloquearTitulo: (nombre: string) => `¿Bloquear a ${nombre}?`,
    bloquearQue:
      'Se cancela la amistad y dejan de verse la actividad y las fotos. No puede volver a agregarte.',
    bloquearConfirmar: 'Bloquear',
    bloqueado: 'Bloqueado',
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
    // EL GLOBO DE LA PRIMERA VEZ, y quedó diciendo UNA sola cosa (26/9).
    //
    // Decía "Aquí ves tus fotos como las ven tus amigos. Cuáles compartes se
    // elige en el Álbum", que es la oración que se señaló: *"nadie habla
    // así"*. Se cambió el pie por un título de dos palabras —"Álbum
    // público"— y el globo quedó repitiendo la mitad de eso con la redacción
    // vieja, o sea las dos cosas en pantalla a la vez, que es peor que antes.
    //
    // Ahora el título dice QUÉ es y QUIÉN lo ve, y al globo le queda lo único
    // que el título no puede decir: dónde se elige.
    globo: 'Se elige en el Álbum.',
    cambiarFoto: 'Cambiar la foto de perfil',
    // Debajo de la foto en grande (14/10).
    cambiarFotoCorto: 'Cambiar foto',
    subiendoFoto: 'subiendo la foto…',
    deRacha: (n: number) => `${n} de racha`,
    // La medalla de Saturno (item 5): el texto del globo al tocarla.
    // Sin "Tu": el mismo globo sale en el perfil de un amigo y en Ranking (14/10).
    rachaMasLargaLarga: (n: number) => `Racha más larga: ${n} ${n === 1 ? 'día' : 'días'}`,
    fotoActualizada: 'Foto actualizada.',
    noSePudoEliminar: 'No se eliminó. Prueba de nuevo.',
    // EL ROTULO Y EL PIE, cortos (25/9). Decian "Son las que ven tus amigos.
    // Cuales compartes se elige en el Album." — dos oraciones, una subordinada
    // rara, y las dos explicando lo mismo que el globo de la primera vez ya
    // explica. Nadie habla asi.
    //
    // EL TITULO HACE EL TRABAJO: "Album publico" dice que es y quien lo ve, en
    // dos palabras. El pie queda para lo unico que el titulo no dice.
    fotosTitulo: 'Álbum público',
    fotosPie: 'Lo que ven tus amigos.',
    sinFotos: 'Todavía no compartiste ninguna.',

    amigos: 'Amigos',
    eliminar: 'Eliminar',
    no: 'No',
    quitar: 'Quitar',
    // El link para buscar está justo arriba: repetir dónde se buscan sobraba.
    sinAmigos: 'Todavía no agregaste a nadie.',
    noSeSumoLaFoto: 'La foto no se sumó al día. Prueba de nuevo.',
    noSePudoLaFoto: 'No se pudo cambiar la foto de perfil.',
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

    // LAS TRES FUENTES DE LA SESIÓN (22/9). Nació del bug de las series: el
    // total decía una cosa y los circulitos otra, y para saber cuál de los
    // tres lugares se había desviado había que verlos en el momento. Con esto
    // se abre el diagnóstico en el gimnasio y se saca la foto.
    sesionTitulo: 'La sesión, en tres lugares',
    sesionNota: 'Si los tres no dicen lo mismo, esta es la foto que sirve.',
    fuentePantalla: 'Pantalla',
    fuenteCache: 'Este teléfono',
    fuenteBase: 'La base',
    sinSesion: 'sin sesión',
    leyendo: 'Leyendo…',
    noSePudoLeer: 'No se pudo leer (¿sin señal?)',
    enTotal: (n: number) => `${n} en total`,
    deMeta: (hechas: number, meta: number) => `${hechas} de ${meta}`,
    // La base NO tiene la meta del bloque —"voy a hacer tres" es intención y
    // la base solo guarda lo que pasó—, así que de ese lado se cuentan las
    // series anotadas en los bloques y no se inventa un "de tres".
    enBloques: (n: number) => `${n} en bloques`,
    sinBloque: 'sin bloque',
    colaVacia: 'Cola vacía',
    colaCon: (n: number) => `Cola: ${n} ${n === 1 ? 'escritura esperando' : 'escrituras esperando'}`,
    releer: 'Volver a leer',
    // LAS ACTUALIZACIONES POR EL AIRE (23/9). Con ellas, "qué versión tienes"
    // dejó de ser obvio: el JS puede ser el de la build o uno bajado después.
    corriendo: (que: string) => `Corriendo: ${que}`,
    buscar: 'Buscar actualización',
    buscando: 'Buscando…',
    // HAY UNA BAJADA Y ESPERANDO. Sin decirlo, "no hay nada nuevo" y "hay
    // una lista que todavía no se aplicó" se ven igual — y la segunda es la
    // que hace que alguien reporte bugs de código viejo.
    hayEsperando: 'Hay una actualización bajada. Se aplica al reabrir la app.',
    sinNovedad: 'Ya tienes la última.',
  },
} as const;

/** La forma de los textos con cualquier texto en cada lugar: la que tiene que tener otro idioma. */
type Ancho<X> = X extends string
  ? string
  : X extends (...a: infer A) => infer R
    ? (...a: A) => Ancho<R>
    : X extends readonly (infer U)[]
      ? readonly Ancho<U>[]
      : X extends object
        ? { readonly [K in keyof X]: Ancho<X[K]> }
        : X;
export type Textos = Ancho<typeof ES>;
export const TEXTOS_ES: Textos = ES;

function copiar<X>(x: X): X {
  if (Array.isArray(x)) return x.map(copiar) as X;
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, copiar(v)])) as X;
  return x;
}
function pisar(destino: Record<string, unknown>, desde: Record<string, unknown>) {
  for (const [k, v] of Object.entries(desde)) {
    const d = destino[k];
    if (Array.isArray(v) && Array.isArray(d)) d.splice(0, d.length, ...v);
    else if (v && typeof v === 'object' && d && typeof d === 'object') pisar(d as Record<string, unknown>, v as Record<string, unknown>);
    else destino[k] = v;
  }
}

export const T: Textos = copiar(ES);

/** Cambia el idioma de `T` en su lugar. Lo que ya se dibujó se vuelve a dibujar aparte. */
export function usarTextos(textos: Textos): void {
  pisar(T as unknown as Record<string, unknown>, textos as unknown as Record<string, unknown>);
}
