'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { crearCliente } from '@/lib/supabase/client';
import { miUsuario } from '@/lib/supabase/quienSoy';
import { fechaLinda, hoyISO } from '@nucleo/fechas';
import { RETOS_LISTOS } from '@nucleo/reglas';
import type { UsuarioPublico } from '@nucleo/tipos';
import {
  aceptarAmistad,
  buscarGente,
  cargarRanking,
  pedirAmistad as mandarPedido,
  rechazarAmistad,
  responderReto as contestarReto,
  astroDeAmigo,
  type Actividad,
  type RetoConNombre,
  type Solicitud,
} from '@compartido/ranking';
import FondoEspacial from '@/components/FondoEspacial';
import Insignia from '@/components/Insignia';
import Avatar from '@/components/Avatar';
import Nav from '@/components/Nav';
import PantallaDeslizable from '@/components/PantallaDeslizable';
import NoCargo from '@/components/NoCargo';
import { T } from '@nucleo/textos';
import { olvidarPendientes } from '@/lib/avisos';


export default function Social() {
  const [supabase] = useState(() => crearCliente());
  const [miId, setMiId] = useState('');
  const [amigos, setAmigos] = useState<UsuarioPublico[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [retos, setRetos] = useState<RetoConNombre[]>([]);
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<UsuarioPublico[]>([]);
  const [pedidosMandados, setPedidosMandados] = useState<Set<string>>(new Set());
  const [cargado, setCargado] = useState(false);
  const [noCargo, setNoCargo] = useState(false);
  const [miRango, setMiRango] = useState(1);
  const [miPlaneta, setMiPlaneta] = useState<string | null>(null);
  const busquedaRef = useRef('');

  // LAS CONSULTAS VIVEN EN `compartido/ranking.ts` desde el 18/9: las usa
  // también la app nativa, y escritas dos veces se iban a separar.
  const cargar = useCallback(async () => {
    const user = await miUsuario(supabase);
    if (!user) return;
    setMiId(user.id);

    const d = await cargarRanking(supabase, user.id);
    // Que la consulta falle no es lo mismo que no tener amigos. Decir "tu
    // cielo todavía está vacío" cuando lo que pasó es que no se pudo
    // preguntar es mentir sobre los datos de la persona.
    if (!d) {
      setNoCargo(true);
      return setCargado(true);
    }
    setNoCargo(false);
    setPedidosMandados(d.pedidosMandados);
    setMiRango(d.miRango);
    setMiPlaneta(d.miPlaneta);
    setAmigos(d.amigos);
    setSolicitudes(d.solicitudes);
    setRetos(d.retos);
    // SIEMPRE, aunque venga vacía. Antes solo se actualizaba con amigos, así
    // que quien se quedaba sin ninguno seguía viendo la actividad de antes.
    setActividad(d.actividad);
    setCargado(true);
  }, [supabase]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function buscar(texto: string) {
    setBusqueda(texto);
    busquedaRef.current = texto;
    if (texto.trim().length < 2) return setResultados([]);
    const encontrados = await buscarGente(supabase, texto, miId, new Set(amigos.map((a) => a.id)));
    if (busquedaRef.current !== texto) return;
    setResultados(encontrados);
  }

  async function pedirAmistad(destino: string) {
    if (!(await mandarPedido(supabase, miId, destino))) return cargar();
    setPedidosMandados(new Set([...pedidosMandados, destino]));
  }

  async function aceptar(id: string) {
    await aceptarAmistad(supabase, id);
    olvidarPendientes();
    cargar();
  }

  async function rechazar(id: string) {
    await rechazarAmistad(supabase, id);
    olvidarPendientes();
    cargar();
  }

  async function responderReto(id: string, acepta: boolean) {
    await contestarReto(supabase, id, acepta);
    olvidarPendientes();
    cargar();
  }

  const maxRacha = Math.max(1, ...amigos.map((a) => a.racha_actual));
  const hoy = hoyISO();
  // Con los retos escondidos las tres listas quedan vacías, y entonces no se
  // dibuja ninguna de sus secciones. Ver RETOS_LISTOS.
  const conRetos = RETOS_LISTOS ? retos : [];
  const retosPendientesMios = conRetos.filter((r) => r.estado === 'pendiente' && r.rival === miId);
  const retosActivos = conRetos.filter((r) => r.estado === 'activo');
  const retosCerrados = conRetos.filter((r) => r.estado === 'terminado').slice(0, 3);

  return (
    <>
      <FondoEspacial rango={miRango} planeta={miPlaneta} esquina="arriba-derecha" velo={0.68} />
      <PantallaDeslizable>
        <div className="titulo-pantalla">{T.social.titulo}</div>


        {noCargo && <NoCargo reintentar={cargar} />}

        {solicitudes.length > 0 && (
          <div className="tarjeta" style={{ marginBottom: 16 }}>
            {solicitudes.map((s) => (
              <div className="fila" key={s.id}>
                <Avatar url={s.de.avatar_url} nombre={s.de.username} />
                <span className="nombre">{s.de.username}</span>
                <button className="boton-texto" style={{ width: 'auto' }} onClick={() => aceptar(s.id)}>
                  {T.social.aceptar}
                </button>
                <button
                  className="boton-texto"
                  style={{ width: 'auto', color: 'var(--apagado)' }}
                  onClick={() => rechazar(s.id)}
                >
                  {T.social.no}
                </button>
              </div>
            ))}
          </div>
        )}

        {retosPendientesMios.map((r) => (
          <div className="tarjeta" key={r.id} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>
              {T.social.teReto(r.nombreRival)}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="boton-solido" style={{ flex: 1 }} onClick={() => responderReto(r.id, true)}>
                {T.social.acepto}
              </button>
              <button
                className="boton-fantasma"
                style={{ flex: 1, width: 'auto' }}
                onClick={() => responderReto(r.id, false)}
              >
                {T.social.paso}
              </button>
            </div>
          </div>
        ))}

        {amigos.length > 1 ? (
          <>
            {/* UNA sola vista. Antes eran dos —campo y lista— con un
                selector, y el campo venia primero: se entraba a una pantalla
                bonita y habia que tocar "Lista" para ver quien va ganando,
                que es a lo que se entra. Ahora la lista manda y el campo pasa
                a ser el fondo. Los astros siguen ahi, con su tamano y su
                brillo diciendo la racha de un vistazo, pero detras. */}
            <div className="ranking">
              <div className="campo-estelar de-fondo" aria-hidden>
                {amigos.map((a, i) => {
                  // Tamaño, lugar y brillo: `astroDeAmigo`, el mismo que usa
                  // la app nativa.
                  const astro = astroDeAmigo(i, a.racha_actual, maxRacha);
                  return (
                    // Sin nombre y sin enlace: de fondo, la etiqueta se
                    // pisaria con la fila que dice lo mismo, y un enlace
                    // debajo de la lista es una trampa para el dedo.
                    <div
                      key={a.id}
                      className="astro-amigo"
                      style={{
                        left: `${astro.x}%`,
                        top: `${astro.y}%`,
                        opacity: astro.opacidad,
                        animationDelay: `${astro.retraso}s`,
                      }}
                    >
                      <Insignia rango={a.rango_actual} tam={astro.tam} />
                    </div>
                  );
                })}
              </div>

              <div className="tarjeta ranking-lista">
                {amigos.map((a, i) => {
                  const fila = (
                    <>
                      <span className="dato" style={{ width: 20 }}>
                        {i + 1}
                      </span>
                      {/* GRANDE, y es el punto de la pantalla. A 24 px el
                          objeto de rango era un adorno al lado del nombre;
                          acá es lo que se viene a ver —quién es qué— y el
                          nombre es la etiqueta. Es la misma escalera que en
                          Inicio, vista en fila. */}
                      <Insignia rango={a.rango_actual} tam={38} />
                      <span className="nombre">{a.id === miId ? T.social.yoEnLista(a.username) : a.username}</span>
                      <span className="dato">{a.racha_actual}</span>
                    </>
                  );
                  return a.id === miId ? (
                    <div className="fila" key={a.id}>
                      {fila}
                    </div>
                  ) : (
                    <Link href={`/perfil/${a.id}`} className="fila" key={a.id}>
                      {fila}
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          cargado && (
            <div className="vacio-cosmico">
              <div className="particulas">
                <i /><i /><i /><i />
              </div>
              {T.social.vacioTitulo}
              <br />
              {T.social.vacioPie}
            </div>
          )
        )}

        {(retosActivos.length > 0 || retosCerrados.length > 0) && (
          <div className="seccion" style={{ marginTop: 24 }}>
            <h3>{T.social.retos}</h3>
            {retosActivos.map((r) => (
              <Link href={`/perfil/${r.idRival}`} className="fila" key={r.id}>
                <span className="nombre" style={{ fontSize: 14 }}>
                  {T.social.vs(r.nombreRival)}
                </span>
                <span className="dato" style={{ fontSize: 13 }}>
                  {r.hasta >= hoy ? T.social.hastaEl(fechaLinda(r.hasta)) : T.social.cerrando}
                </span>
              </Link>
            ))}
            {retosCerrados.map((r) => (
              <div className="fila" key={r.id}>
                <span className="nombre" style={{ fontSize: 14, color: 'var(--sub)' }}>
                  {T.social.vs(r.nombreRival)}
                </span>
                <span className="dato" style={{ fontSize: 13 }}>
                  {r.ganador === null
                    ? T.social.empate
                    : r.ganador === miId
                      ? T.social.ganaste
                      : T.social.gano(r.nombreRival)}
                </span>
              </div>
            ))}
          </div>
        )}

        {actividad.length > 0 && (
          <div className="seccion" style={{ marginTop: 24 }}>
            <h3>{T.social.actividad}</h3>
            {actividad.map((a, i) => (
              <Link href={`/perfil/${a.userId}`} className="fila" key={i}>
                <Avatar url={a.avatar} nombre={a.username} tam={28} />
                {a.foto && (
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      overflow: 'hidden',
                      flex: 'none',
                      border: '0.5px solid var(--linea)',
                    }}
                  >
                    {/* <img> y no next/image: son URLs firmadas de Supabase que vencen en una hora, y el optimizador las cachearia vencidas. */}
                    <img src={a.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </span>
                )}
                <span className="nombre" style={{ color: 'var(--sub)', fontSize: 14 }}>
                  {T.social.registroEl(a.username, fechaLinda(a.fecha))}
                </span>
              </Link>
            ))}
          </div>
        )}

        <div className="seccion buscar-gente" id="buscar">
          <h3>{T.social.buscarGente}</h3>
          {/* CON FORMA DE PASTILLA Y CON LUPA. Era el único rectángulo de una
              pantalla de objetos redondos y botones pastilla: un campo de
              formulario en una app espacial. Y sin nada que dijera "acá se
              busca". El margen de arriba se fue del JSX al CSS, donde vive el
              resto. */}
          <div className="campo-busqueda">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M16.5 16.5L21 21" strokeLinecap="round" />
            </svg>
            <input
              placeholder={T.ajustes.nombrePlaceholder}
              value={busqueda}
              onChange={(e) => buscar(e.target.value)}
              autoCapitalize="off"
            />
          </div>
          {resultados.map((u) => (
            <div className="fila" key={u.id}>
              <Avatar url={u.avatar_url} nombre={u.username} />
              <Link href={`/perfil/${u.id}`} className="nombre">
                {u.username}
              </Link>
              {pedidosMandados.has(u.id) ? (
                <span className="dato">{T.social.pedidoEnviado}</span>
              ) : (
                <button
                  className="boton-texto"
                  style={{ width: 'auto' }}
                  onClick={() => pedirAmistad(u.id)}
                >
                  {T.social.agregar}
                </button>
              )}
            </div>
          ))}
        </div>
      </PantallaDeslizable>
      <Nav />
    </>
  );
}
