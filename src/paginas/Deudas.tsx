import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  dinero,
  fechaHora,
  nombresMes,
  type AnulacionRegistrada,
  type DeudaPanel,
  type EstadoDeuda,
  type SocioPanel,
  type TotalMoneda,
  type VistaPreviaAnulacion,
} from '../api';

const RUTA = '/api/panel/obligaciones-anulaciones';

type Catalogos = { conceptos: { id: string; nombre: string; activo: boolean }[]; bloques: string[] };

type Filtros = {
  conceptoCobroId: string;
  anio: string;
  mes: string;
  socioId: string;
  socioNombre: string;
  caseta: string;
  bloque: string;
  estado: '' | EstadoDeuda;
};

type RespuestaDeudas = {
  total: number;
  mostradas: number;
  limite: number;
  resumen: { estado: EstadoDeuda; moneda: string; cantidad: number; monto: number }[];
  deudas: DeudaPanel[];
};

/** Lo que se quiere anular: deudas elegidas o todas las pendientes de unos filtros. */
type Pedido = { obligacionIds: string[] } | Omit<FiltrosApi, 'estado'>;
type FiltrosApi = { conceptoCobroId?: string; anio?: number; mes?: number; socioId?: string; caseta?: string; bloque?: string; estado?: string };

const vacios: Filtros = { conceptoCobroId: '', anio: '', mes: '', socioId: '', socioNombre: '', caseta: '', bloque: '', estado: 'Pendiente' };

function aApi(f: Filtros): FiltrosApi {
  return {
    conceptoCobroId: f.conceptoCobroId || undefined,
    anio: f.anio ? Number(f.anio) : undefined,
    mes: f.mes ? Number(f.mes) : undefined,
    socioId: f.socioId || undefined,
    caseta: f.caseta.trim() || undefined,
    bloque: f.bloque || undefined,
    estado: f.estado || undefined,
  };
}

function consulta(f: FiltrosApi) {
  return Object.entries(f)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
}

const totalesTexto = (t: TotalMoneda[]) => t.map((x) => dinero(x.total, x.moneda)).join(' + ') || '—';

export default function Deudas() {
  const [pestana, setPestana] = useState<'deudas' | 'historial'>('deudas');

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Deudas</h1>
          <p className="bajada">
            Anula una deuda o varias a la vez. La deuda no se borra: queda como «Anulada», deja de sumar en los saldos y
            guarda quién la anuló y cuándo. Solo se anulan deudas pendientes sin cobros ni comprobantes.
          </p>
        </div>
      </div>

      <div className="pestanas" role="tablist">
        <button role="tab" aria-selected={pestana === 'deudas'} className={`pestana${pestana === 'deudas' ? ' activa' : ''}`} onClick={() => setPestana('deudas')}>
          Buscar y anular
        </button>
        <button role="tab" aria-selected={pestana === 'historial'} className={`pestana${pestana === 'historial' ? ' activa' : ''}`} onClick={() => setPestana('historial')}>
          Historial de anulaciones
        </button>
      </div>

      {pestana === 'deudas' ? <BuscarYAnular /> : <Historial />}
    </>
  );
}

// ============================================================ BUSCAR Y ANULAR

function BuscarYAnular() {
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(vacios);
  const [aplicados, setAplicados] = useState<Filtros>(vacios);
  const [datos, setDatos] = useState<RespuestaDeudas | null>(null);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [verAnulacion, setVerAnulacion] = useState<string | null>(null);

  useEffect(() => {
    api.get<Catalogos>(`${RUTA}/catalogos`).then(setCatalogos).catch((e: Error) => setError(e.message));
  }, []);

  const buscar = useCallback(async (f: Filtros) => {
    setError(null);
    setDatos(null);
    setElegidas(new Set());
    try {
      setDatos(await api.get<RespuestaDeudas>(`${RUTA}/deudas?${consulta(aApi(f))}`));
      setAplicados(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar.');
    }
  }, []);

  useEffect(() => {
    void buscar(vacios);
  }, [buscar]);

  const anulables = useMemo(() => datos?.deudas.filter((d) => d.anulable) ?? [], [datos]);
  const hayFiltro = Boolean(aplicados.conceptoCobroId || aplicados.anio || aplicados.mes || aplicados.socioId || aplicados.caseta.trim() || aplicados.bloque);
  const totalElegidas = useMemo(() => {
    const porMoneda = new Map<string, number>();
    datos?.deudas.filter((d) => elegidas.has(d.id)).forEach((d) => porMoneda.set(d.moneda, (porMoneda.get(d.moneda) ?? 0) + d.monto));
    return [...porMoneda].map(([moneda, total]) => dinero(total, moneda)).join(' + ');
  }, [datos, elegidas]);

  const cambiar = (campo: keyof Filtros, valor: string) => setFiltros((f) => ({ ...f, [campo]: valor }));

  const alternar = (id: string) =>
    setElegidas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const anio = new Date().getFullYear();

  return (
    <>
      <form
        className="filtros no-imprimir"
        onSubmit={(e) => {
          e.preventDefault();
          setAviso(null);
          void buscar(filtros);
        }}>
        <label className="campo">
          <span>Concepto</span>
          <select id="f-concepto" value={filtros.conceptoCobroId} onChange={(e) => cambiar('conceptoCobroId', e.target.value)}>
            <option value="">Todos</option>
            {catalogos?.conceptos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.activo ? '' : ' (inactivo)'}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Mes</span>
          <select id="f-mes" value={filtros.mes} onChange={(e) => cambiar('mes', e.target.value)}>
            <option value="">Todos</option>
            {nombresMes.map((m, i) => (
              <option key={m} value={i + 1}>
                {m[0].toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Año</span>
          <select id="f-anio" value={filtros.anio} onChange={(e) => cambiar('anio', e.target.value)}>
            <option value="">Todos</option>
            {[anio + 1, anio, anio - 1, anio - 2, anio - 3, anio - 4].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <BuscarSocio
          socioId={filtros.socioId}
          nombre={filtros.socioNombre}
          alElegir={(id, nombre) => setFiltros((f) => ({ ...f, socioId: id, socioNombre: nombre }))}
        />
        <label className="campo">
          <span>Caseta</span>
          <input id="f-caseta" value={filtros.caseta} onChange={(e) => cambiar('caseta', e.target.value)} placeholder="Ej.: A-12" style={{ minWidth: 110, width: 110 }} />
        </label>
        <label className="campo">
          <span>Bloque</span>
          <select id="f-bloque" value={filtros.bloque} onChange={(e) => cambiar('bloque', e.target.value)}>
            <option value="">Todos</option>
            {catalogos?.bloques.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Estado</span>
          <select id="f-estado" value={filtros.estado} onChange={(e) => cambiar('estado', e.target.value)}>
            <option value="Pendiente">Pendientes</option>
            <option value="Pagada">Pagadas</option>
            <option value="Anulada">Anuladas</option>
            <option value="">Todas</option>
          </select>
        </label>
        <div className="campo">
          <span>&nbsp;</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="boton" type="submit">
              Buscar
            </button>
            <button
              className="boton secundario"
              type="button"
              onClick={() => {
                setFiltros(vacios);
                void buscar(vacios);
              }}>
              Limpiar
            </button>
          </div>
        </div>
      </form>

      {error ? <div className="aviso error">{error}</div> : null}
      {aviso ? <div className="aviso ok">{aviso}</div> : null}
      {datos === null && !error ? <p className="bajada">Buscando…</p> : null}

      {datos ? (
        <>
          <div className="resumen-deudas">
            {datos.resumen.length === 0 ? <span>No hay deudas con esos filtros.</span> : null}
            {(['Pendiente', 'Pagada', 'Anulada'] as const).map((estado) => {
              const filas = datos.resumen.filter((r) => r.estado === estado);
              if (filas.length === 0) return null;
              return (
                <span key={estado}>
                  <EstadoDeudaChip estado={estado} plural /> {filas.reduce((s, r) => s + r.cantidad, 0)} ·{' '}
                  {filas.map((r) => dinero(r.monto, r.moneda)).join(' + ')}
                </span>
              );
            })}
            {datos.mostradas < datos.total ? (
              <span className="ayuda">
                Se muestran las primeras {datos.mostradas} de {datos.total}; usa los filtros.
              </span>
            ) : null}
          </div>

          <div className="barra-anular no-imprimir">
            <label className="marcar-todas">
              <input
                type="checkbox"
                id="marcar-todas"
                disabled={anulables.length === 0}
                checked={anulables.length > 0 && anulables.every((d) => elegidas.has(d.id))}
                onChange={(e) => setElegidas(e.target.checked ? new Set(anulables.map((d) => d.id)) : new Set())}
              />
              Elegir todas las que se pueden anular ({anulables.length})
            </label>
            <div className="barra-anular-botones">
              <button className="boton peligro" disabled={elegidas.size === 0} onClick={() => setPedido({ obligacionIds: [...elegidas] })}>
                Anular elegidas{elegidas.size ? ` (${elegidas.size} · ${totalElegidas})` : ''}
              </button>
              <button
                className="boton peligro"
                disabled={!hayFiltro}
                title={hayFiltro ? undefined : 'Elige al menos un filtro (concepto, período, socio, caseta o bloque) y pulsa Buscar.'}
                onClick={() => {
                  const { estado: _estado, ...resto } = aApi(aplicados);
                  setPedido(resto);
                }}>
                Anular todas las pendientes de estos filtros
              </button>
            </div>
          </div>

          {datos.deudas.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="tabla deudas">
                <thead>
                  <tr>
                    <th aria-label="Elegir" />
                    <th>Caseta</th>
                    <th>Concepto</th>
                    <th>Período</th>
                    <th className="numero">Monto</th>
                    <th>Estado</th>
                    <th>Nota</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {datos.deudas.map((d) => (
                    <tr key={d.id} className={d.estado === 'Anulada' ? 'anulada' : undefined}>
                      <td>
                        <input type="checkbox" aria-label={`Elegir ${d.caseta} ${d.concepto} ${d.periodo}`} disabled={!d.anulable} checked={elegidas.has(d.id)} onChange={() => alternar(d.id)} />
                      </td>
                      <td className="sin-cortar">
                        <strong>{d.caseta}</strong>
                        {d.bloque ? <div className="ayuda">Bloque {d.bloque}</div> : null}
                      </td>
                      <td>{d.concepto}</td>
                      <td className="sin-cortar">{d.periodo}</td>
                      <td className="numero monto-deuda">{dinero(d.monto, d.moneda)}</td>
                      <td>
                        <EstadoDeudaChip estado={d.estado} />
                      </td>
                      <td className="nota-deuda">
                        {d.anulacion ? (
                          <>
                            Anulada el {fechaHora(d.anulacion.fecha)} por {d.anulacion.responsable}.<br />
                            <em>«{d.anulacion.motivo}»</em>
                          </>
                        ) : d.estado === 'Pendiente' ? (
                          d.motivoNoAnulable
                        ) : null}
                      </td>
                      <td className="acciones-fila">
                        {d.anulable ? (
                          <button className="boton peligro" onClick={() => setPedido({ obligacionIds: [d.id] })}>
                            Anular
                          </button>
                        ) : d.anulacion ? (
                          <button className="boton secundario" onClick={() => setVerAnulacion(d.anulacion!.anulacionId)}>
                            Ver anulación
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}

      {pedido ? (
        <ConfirmarAnulacion
          pedido={pedido}
          alCerrar={() => setPedido(null)}
          alTerminar={async (mensaje) => {
            setPedido(null);
            await buscar(aplicados);
            setAviso(mensaje);
          }}
        />
      ) : null}

      {verAnulacion ? <DetalleAnulacion id={verAnulacion} alCerrar={() => setVerAnulacion(null)} /> : null}
    </>
  );
}

function BuscarSocio({ socioId, nombre, alElegir }: { socioId: string; nombre: string; alElegir: (id: string, nombre: string) => void }) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<SocioPanel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (socioId)
    return (
      <div className="campo">
        <span>Socio (titular)</span>
        <div className="socio-elegido">
          {nombre}
          <button type="button" className="boton secundario" onClick={() => alElegir('', '')} aria-label="Quitar socio">
            Quitar
          </button>
        </div>
      </div>
    );

  const buscar = async () => {
    setError(null);
    if (texto.trim().length < 2) return setResultados(null);
    try {
      setResultados(await api.get<SocioPanel[]>(`/api/panel/socios?buscar=${encodeURIComponent(texto.trim())}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar.');
    }
  };

  return (
    <div className="campo buscar-socio">
      <span>Socio (titular)</span>
      <input
        id="f-socio"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void buscar();
          }
        }}
        onBlur={() => void buscar()}
        placeholder="Nombre o CI, y Enter"
      />
      {error ? <div className="ayuda" style={{ color: 'var(--rojo)' }}>{error}</div> : null}
      {resultados ? (
        <div className="sugerencias" role="listbox">
          {resultados.length === 0 ? <div className="ayuda">Sin resultados.</div> : null}
          {resultados.slice(0, 8).map((s) => (
            <button
              type="button"
              key={s.id}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setResultados(null);
                setTexto('');
                alElegir(s.id, s.nombre);
              }}>
              {s.nombre} <span className="ayuda">· CI {s.documento} · {s.casetas.join(', ') || 'sin casetas'}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================ CONFIRMAR

function ConfirmarAnulacion({ pedido, alCerrar, alTerminar }: { pedido: Pedido; alCerrar: () => void; alTerminar: (mensaje: string) => Promise<void> }) {
  const [previa, setPrevia] = useState<VistaPreviaAnulacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  // Una clave por confirmación: si el envío se repite (doble clic), la API no anula dos veces.
  const [clave] = useState(() => crypto.randomUUID());

  const cargar = useCallback(async () => {
    setError(null);
    setPrevia(null);
    try {
      setPrevia(await api.post<VistaPreviaAnulacion>(`${RUTA}/vista-previa`, pedido));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar la vista previa.');
    }
  }, [pedido]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const puede = previa !== null && previa.cantidad > 0 && !trabajando;

  const anular = async () => {
    if (!previa || !puede) return;
    setTrabajando(true);
    setError(null);
    try {
      const r = await api.post<{ mensaje: string }>(RUTA, {
        ...pedido,
        motivo: motivo.trim(),
        confirmo: true,
        claveOperacion: clave,
        huella: previa.huella,
        cantidadEsperada: previa.cantidad,
      });
      await alTerminar(r.mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo anular.');
      setTrabajando(false);
    }
  };

  return (
    <div className="ventana-fondo" role="dialog" aria-modal="true" aria-labelledby="titulo-anular">
      <div className="ventana ancha">
        <h2 id="titulo-anular">{previa?.tipo === 'Individual' ? 'Anular deuda' : 'Anular deudas'}</h2>
        <p className="bajada">Revisa qué se anulará. Nada cambia hasta que pulses el botón rojo. Queda en el historial a tu nombre.</p>

        {error ? (
          <div className="aviso error" style={{ marginTop: 12 }}>
            {error}{' '}
            {previa ? (
              <button className="enlace" onClick={() => void cargar()}>
                Actualizar la vista previa
              </button>
            ) : null}
          </div>
        ) : null}
        {previa === null && !error ? <p className="bajada">Preparando la vista previa…</p> : null}

        {previa ? (
          <>
            <div className="previa-resumen">
              <div>
                <div className="indicador-titulo">Deudas a anular</div>
                <div className="indicador-valor">{previa.cantidad}</div>
              </div>
              <div>
                <div className="indicador-titulo">Monto total</div>
                <div className="indicador-valor">{totalesTexto(previa.totales)}</div>
              </div>
            </div>
            <p className="ayuda" style={{ marginTop: 0 }}>
              {previa.filtros}
            </p>

            {previa.deudas.length > 0 ? (
              <div className="lista-previa">
                <table className="tabla simple">
                  <tbody>
                    {previa.deudas.map((d) => (
                      <tr key={d.id}>
                        <td className="sin-cortar">{d.caseta}</td>
                        <td>{d.concepto}</td>
                        <td className="sin-cortar">{d.periodo}</td>
                        <td className="numero">{dinero(d.monto, d.moneda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {previa.bloqueadas.length > 0 ? (
              <div className="aviso info" style={{ marginTop: 12 }}>
                <strong>
                  {previa.bloqueadas.length === 1 ? '1 deuda no se anulará:' : `${previa.bloqueadas.length} deudas no se anularán:`}
                </strong>
                <ul className="lista-bloqueadas">
                  {previa.bloqueadas.slice(0, 20).map((b) => (
                    <li key={b.id}>
                      {b.caseta} · {b.concepto} {b.periodo} · {dinero(b.monto, b.moneda)}: {b.motivo}
                    </li>
                  ))}
                  {previa.bloqueadas.length > 20 ? <li>… y {previa.bloqueadas.length - 20} más.</li> : null}
                </ul>
              </div>
            ) : null}

            {previa.cantidad === 0 ? (
              <div className="aviso error" style={{ marginTop: 12 }}>
                No hay deudas que se puedan anular.
              </div>
            ) : (
              <>
                <label className="campo" style={{ marginTop: 14 }}>
                  <span>Motivo (opcional)</span>
                  <textarea
                    id="motivo-anulacion"
                    value={motivo}
                    maxLength={500}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej.: caseta cerrada en octubre"
                  />
                </label>
              </>
            )}
          </>
        ) : null}

        <div className="botones-ventana">
          <button className="boton secundario" onClick={alCerrar} disabled={trabajando}>
            Cancelar
          </button>
          {previa && previa.cantidad > 0 ? (
            <button className="boton rojo" disabled={!puede} onClick={() => void anular()}>
              {trabajando ? 'Anulando…' : previa.cantidad === 1 ? 'Anular 1 deuda' : `Anular ${previa.cantidad} deudas`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ============================================================ HISTORIAL

function Historial() {
  const [lista, setLista] = useState<AnulacionRegistrada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ver, setVer] = useState<string | null>(null);

  useEffect(() => {
    api.get<AnulacionRegistrada[]>(`${RUTA}/historial`).then(setLista).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <>
      {error ? <div className="aviso error">{error}</div> : null}
      {lista === null && !error ? <p className="bajada">Cargando…</p> : null}
      {lista?.length === 0 ? (
        <div className="tarjeta vacio">
          <strong>Todavía no se anuló ninguna deuda</strong>
          Cada anulación aparecerá aquí con su motivo y responsable.
        </div>
      ) : null}
      {lista?.length ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Responsable</th>
                <th>Tipo</th>
                <th className="numero">Deudas</th>
                <th className="numero">Monto</th>
                <th>Motivo y filtros</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td className="sin-cortar">{fechaHora(a.fecha)}</td>
                  <td>{a.responsable}</td>
                  <td>{a.tipo}</td>
                  <td className="numero">{a.cantidad}</td>
                  <td className="numero">{totalesTexto(a.totales)}</td>
                  <td className="detalle-cambio">
                    «{a.motivo}»{a.filtros ? <div className="ayuda">{a.filtros}</div> : null}
                  </td>
                  <td className="acciones-fila">
                    <button className="boton secundario" onClick={() => setVer(a.id)}>
                      Ver deudas
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {ver ? <DetalleAnulacion id={ver} alCerrar={() => setVer(null)} /> : null}
    </>
  );
}

type Detalle = AnulacionRegistrada & {
  deudas: { obligacionId: string; caseta: string; concepto: string; periodo: string; monto: number; moneda: string; estadoAnterior: string; estadoActual: EstadoDeuda }[];
};

function DetalleAnulacion({ id, alCerrar }: { id: string; alCerrar: () => void }) {
  const [d, setD] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Detalle>(`${RUTA}/${id}`).then(setD).catch((e: Error) => setError(e.message));
  }, [id]);

  return (
    <div className="ventana-fondo" role="dialog" aria-modal="true" aria-labelledby="titulo-detalle" onClick={alCerrar}>
      <div className="ventana ancha" onClick={(e) => e.stopPropagation()}>
        <h2 id="titulo-detalle">Anulación de deudas</h2>
        {error ? <div className="aviso error">{error}</div> : null}
        {d ? (
          <>
            <dl className="datos">
              <dt>Fecha</dt>
              <dd>{fechaHora(d.fecha)}</dd>
              <dt>Responsable</dt>
              <dd>{d.responsable}</dd>
              <dt>Tipo</dt>
              <dd>{d.tipo}</dd>
              <dt>Motivo</dt>
              <dd>«{d.motivo}»</dd>
              {d.filtros ? (
                <>
                  <dt>Filtros</dt>
                  <dd>{d.filtros}</dd>
                </>
              ) : null}
              <dt>Total</dt>
              <dd>
                {d.cantidad} {d.cantidad === 1 ? 'deuda' : 'deudas'} · {totalesTexto(d.totales)}
              </dd>
            </dl>
            <div className="lista-previa">
              <table className="tabla simple">
                <tbody>
                  {d.deudas.map((x) => (
                    <tr key={x.obligacionId}>
                      <td className="sin-cortar">{x.caseta}</td>
                      <td>{x.concepto}</td>
                      <td className="sin-cortar">{x.periodo}</td>
                      <td className="numero">{dinero(x.monto, x.moneda)}</td>
                      <td>
                        <EstadoDeudaChip estado={x.estadoActual} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : !error ? (
          <p className="bajada">Cargando…</p>
        ) : null}
        <div className="botones-ventana">
          <button className="boton secundario" onClick={alCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function EstadoDeudaChip({ estado, plural = false }: { estado: EstadoDeuda; plural?: boolean }) {
  const tono = estado === 'Pagada' ? 'verde' : estado === 'Anulada' ? 'gris' : 'ambar';
  const texto = plural ? { Pendiente: 'Pendientes', Pagada: 'Pagadas', Anulada: 'Anuladas' }[estado] : estado;
  return <span className={`chip ${tono}`}>{texto}</span>;
}
