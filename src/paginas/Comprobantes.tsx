import { useCallback, useEffect, useState } from 'react';
import { api, dinero, fechaHora, type PagoApp } from '../api';

type Filtro = 'pendiente' | 'aprobado' | 'rechazado' | 'todos';

const filtros: { id: Filtro; nombre: string }[] = [
  { id: 'pendiente', nombre: 'Por revisar' },
  { id: 'aprobado', nombre: 'Aprobados' },
  { id: 'rechazado', nombre: 'Rechazados' },
  { id: 'todos', nombre: 'Todos' },
];

const CLAVE_REVISOR = 'mercadex.panel.revisor';

function leerRevisor() {
  try {
    return localStorage.getItem(CLAVE_REVISOR) ?? '';
  } catch {
    return '';
  }
}

export default function Comprobantes({ alCambiar }: { alCambiar: () => void }) {
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [pagos, setPagos] = useState<PagoApp[] | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(
    async (seleccionar?: string) => {
      setError(null);
      try {
        const lista = await api.get<PagoApp[]>(`/api/panel/pagos?estado=${filtro}`);
        setPagos(lista);
        setElegido((actual) => {
          const quiero = seleccionar ?? actual;
          return lista.some((p) => p.id === quiero) ? quiero! : lista[0]?.id ?? null;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar.');
      }
    },
    [filtro],
  );

  useEffect(() => {
    setPagos(null);
    void cargar();
  }, [cargar]);

  const pago = pagos?.find((p) => p.id === elegido) ?? null;

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Comprobantes</h1>
          <p className="bajada">
            Pagos que los socios informaron desde la app. Antes de aprobar, verifica en el banco que el depósito llegó.
          </p>
        </div>
        <button className="boton secundario" onClick={() => void cargar()}>
          Actualizar
        </button>
      </div>

      <div className="pestanas" role="tablist">
        {filtros.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filtro === f.id}
            className={`pestana${filtro === f.id ? ' activa' : ''}`}
            onClick={() => {
              setAviso(null);
              setFiltro(f.id);
            }}>
            {f.nombre}
          </button>
        ))}
      </div>

      {error ? <div className="aviso error">{error}</div> : null}
      {aviso ? <div className="aviso ok">{aviso}</div> : null}

      {pagos === null && !error ? <p className="bajada">Cargando…</p> : null}

      {pagos?.length === 0 ? (
        <div className="tarjeta vacio">
          <strong>{filtro === 'pendiente' ? 'No hay comprobantes por revisar' : 'Sin pagos en esta lista'}</strong>
          Cuando un socio pague desde la app, su comprobante aparecerá aquí.
        </div>
      ) : null}

      {pagos?.length ? (
        <div className="revision">
          <div className="lista">
            {pagos.map((p) => (
              <button key={p.id} className={`fila-pago${p.id === elegido ? ' elegida' : ''}`} onClick={() => setElegido(p.id)}>
                <span className="monto">{dinero(p.monto, p.moneda)}</span>
                <EstadoChip estado={p.estado} />
                <span className="detalle">
                  Caseta {p.caseta} · {p.socio}
                  <br />
                  {fechaHora(p.fecha)}
                </span>
              </button>
            ))}
          </div>

          {pago ? (
            <Detalle
              key={pago.id}
              pago={pago}
              alTerminar={async (mensaje) => {
                setAviso(mensaje);
                await cargar(pago.id);
                alCambiar();
              }}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function EstadoChip({ estado }: { estado: PagoApp['estado'] }) {
  const tono = estado === 'Aprobado' ? 'verde' : estado === 'Rechazado' ? 'rojo' : 'ambar';
  return <span className={`chip ${tono}`}>{estado === 'Pendiente' ? 'Por revisar' : estado}</span>;
}

function Detalle({ pago, alTerminar }: { pago: PagoApp; alTerminar: (mensaje: string) => Promise<void> }) {
  const [imagen, setImagen] = useState<string | null>(null);
  const [errorImagen, setErrorImagen] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [revisor, setRevisor] = useState(leerRevisor);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    api
      .blob(`/api/panel/pagos/${pago.id}/comprobante`)
      .then((b) => {
        url = URL.createObjectURL(b);
        setImagen(url);
      })
      .catch((e: Error) => setErrorImagen(e.message));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [pago.id]);

  const revisar = async (accion: 'aprobar' | 'rechazar') => {
    setError(null);
    if (revisor.trim().length < 3) return setError('Escribe tu nombre en «Revisado por».');
    if (accion === 'rechazar' && motivo.trim().length < 5) return setError('Explica al socio por qué se rechaza.');
    if (
      accion === 'aprobar' &&
      !window.confirm(
        `¿Confirmas que el depósito de ${dinero(pago.monto, pago.moneda)} (transacción ${pago.referencia}) llegó a la cuenta de la asociación?\n\nSe emitirá el recibo y las deudas quedarán pagadas.`,
      )
    )
      return;

    setTrabajando(true);
    try {
      try {
        localStorage.setItem(CLAVE_REVISOR, revisor.trim());
      } catch {
        // No es crítico.
      }
      const r = await api.post<{ mensaje: string }>(`/api/panel/pagos/${pago.id}/${accion}`, {
        revisadoPor: revisor.trim(),
        motivo: motivo.trim(),
      });
      await alTerminar(r.mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar.');
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <section className="tarjeta detalle-pago" aria-label="Detalle del pago">
      <p className="grande">{dinero(pago.monto, pago.moneda)}</p>
      <EstadoChip estado={pago.estado} />

      <dl className="datos">
        <dt>Socio</dt>
        <dd>
          {pago.socio} · CI {pago.documento}
        </dd>
        <dt>Caseta</dt>
        <dd>
          {pago.caseta}
          {pago.bloque ? ` · Bloque ${pago.bloque}` : ''}
        </dd>
        <dt>Deudas</dt>
        <dd>{pago.deudas}</dd>
        <dt>Transacción</dt>
        <dd>
          <strong>{pago.referencia}</strong>
        </dd>
        <dt>Enviado</dt>
        <dd>{fechaHora(pago.fecha)}</dd>
        {pago.estado !== 'Pendiente' ? (
          <>
            <dt>Revisado por</dt>
            <dd>{pago.revisadoPor}</dd>
          </>
        ) : null}
        {pago.estado === 'Aprobado' ? (
          <>
            <dt>Recibo</dt>
            <dd>N.º {pago.numeroRecibo}</dd>
          </>
        ) : null}
        {pago.estado === 'Rechazado' ? (
          <>
            <dt>Motivo</dt>
            <dd>{pago.motivoRechazo}</dd>
          </>
        ) : null}
      </dl>

      {imagen ? (
        <img className="comprobante" src={imagen} alt={`Comprobante de ${pago.socio}`} onClick={() => setZoom(true)} />
      ) : (
        <div className="aviso info">{errorImagen ?? 'Cargando comprobante…'}</div>
      )}
      {zoom && imagen ? (
        <div className="zoom" onClick={() => setZoom(false)} role="dialog" aria-label="Comprobante ampliado">
          <img src={imagen} alt="Comprobante ampliado" />
        </div>
      ) : null}

      {pago.estado === 'Pendiente' ? (
        <>
          {error ? (
            <div className="aviso error" style={{ marginTop: 14 }}>
              {error}
            </div>
          ) : null}
          <label className="campo" style={{ marginTop: 16 }}>
            <span>Revisado por</span>
            <input value={revisor} onChange={(e) => setRevisor(e.target.value)} placeholder="Tu nombre" />
          </label>
          <div className="acciones">
            <div>
              <button className="boton verde ancho" disabled={trabajando} onClick={() => void revisar('aprobar')}>
                Aprobar y emitir recibo
              </button>
              <p className="ayuda">El cobro se registra como pago QR con este número de transacción.</p>
            </div>
            <div>
              <label className="campo" style={{ marginBottom: 8 }}>
                <span>Motivo del rechazo</span>
                <textarea
                  value={motivo}
                  maxLength={300}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej.: el monto depositado no coincide"
                />
              </label>
              <button className="boton peligro ancho" disabled={trabajando} onClick={() => void revisar('rechazar')}>
                Rechazar
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
