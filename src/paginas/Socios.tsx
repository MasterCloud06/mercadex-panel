import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, fechaHora, type SocioPanel } from '../api';

const estados: Record<SocioPanel['estadoApp'], { texto: string; tono: string }> = {
  'sin-acceso': { texto: 'Sin acceso', tono: 'gris' },
  activa: { texto: 'Usa la app', tono: 'verde' },
  'codigo-pendiente': { texto: 'Código entregado', tono: 'ambar' },
  'codigo-vencido': { texto: 'Código vencido', tono: 'rojo' },
};

type Codigo = { codigo: string; documento: string; socio: string; expira: string };

export default function Socios() {
  const [buscar, setBuscar] = useState('');
  const [socios, setSocios] = useState<SocioPanel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<Codigo | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async (texto: string) => {
    setError(null);
    try {
      setSocios(await api.get<SocioPanel[]>(`/api/panel/socios?buscar=${encodeURIComponent(texto)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.');
    }
  }, []);

  useEffect(() => {
    void cargar('');
  }, [cargar]);

  const enviarBusqueda = (e: FormEvent) => {
    e.preventDefault();
    void cargar(buscar);
  };

  const generar = async (s: SocioPanel) => {
    if (
      s.estadoApp === 'activa' &&
      !window.confirm(`${s.nombre} ya usa la app. Con un código nuevo su contraseña deja de funcionar y debe activarla otra vez.\n\n¿Continuar?`)
    )
      return;
    setOcupado(s.id);
    setAviso(null);
    try {
      setCodigo(await api.post<Codigo>(`/api/panel/cuentas/${s.id}/codigo`));
      await cargar(buscar);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el código.');
    } finally {
      setOcupado(null);
    }
  };

  const retirar = async (s: SocioPanel) => {
    if (!window.confirm(`${s.nombre} ya no podrá ingresar a la app y se cerrarán sus sesiones.\n\n¿Retirar el acceso?`)) return;
    setOcupado(s.id);
    try {
      const r = await api.post<{ mensaje: string }>(`/api/panel/cuentas/${s.id}/desactivar`);
      setAviso(r.mensaje);
      await cargar(buscar);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo retirar el acceso.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Socios y acceso</h1>
          <p className="bajada">
            Genera el código de activación para que un socio use la app. El socio entra con su carnet y ese código, y crea su contraseña.
          </p>
        </div>
      </div>

      <form className="buscador" onSubmit={enviarBusqueda} role="search">
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre o carnet" aria-label="Buscar socio" />
        <button className="boton">Buscar</button>
      </form>

      {error ? <div className="aviso error">{error}</div> : null}
      {aviso ? <div className="aviso ok">{aviso}</div> : null}
      {socios === null && !error ? <p className="bajada">Cargando…</p> : null}

      {socios?.length === 0 ? (
        <div className="tarjeta vacio">
          <strong>Ningún socio coincide</strong>
          Los socios se registran en Mercadex (escritorio), menú Socios.
        </div>
      ) : null}

      {socios?.length ? (
        <table className="tabla">
          <thead>
            <tr>
              <th>Socio</th>
              <th>Carnet</th>
              <th>Casetas</th>
              <th>App</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {socios.map((s) => {
              const estado = estados[s.estadoApp];
              const sinCarnet = !s.documento || s.documento === 'SIN_DOCUMENTO';
              return (
                <tr key={s.id}>
                  <td>
                    <strong>{s.nombre}</strong>
                    {s.telefono ? <div className="ayuda">Tel. {s.telefono}</div> : null}
                  </td>
                  <td>{sinCarnet ? <span className="chip rojo">Falta carnet</span> : s.documento}</td>
                  <td>{s.casetas.length ? s.casetas.join(', ') : <span className="ayuda">Sin casetas</span>}</td>
                  <td>
                    <span className={`chip ${estado.tono}`}>{estado.texto}</span>
                    {s.ultimoAcceso ? <div className="ayuda">Último ingreso: {fechaHora(s.ultimoAcceso)}</div> : null}
                  </td>
                  <td className="acciones-fila">
                    <button className="boton" disabled={ocupado === s.id || sinCarnet} onClick={() => void generar(s)}>
                      {s.estadoApp === 'sin-acceso' ? 'Dar acceso' : 'Código nuevo'}
                    </button>
                    {s.estadoApp !== 'sin-acceso' ? (
                      <button className="boton peligro" disabled={ocupado === s.id} onClick={() => void retirar(s)}>
                        Retirar
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}

      {codigo ? <VentanaCodigo codigo={codigo} alCerrar={() => setCodigo(null)} /> : null}
    </>
  );
}

function VentanaCodigo({ codigo, alCerrar }: { codigo: Codigo; alCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const formateado = codigo.codigo.length === 8 ? `${codigo.codigo.slice(0, 4)} ${codigo.codigo.slice(4)}` : codigo.codigo;

  return (
    <div className="ventana-fondo" role="dialog" aria-modal="true" aria-labelledby="titulo-codigo">
      <div className="ventana">
        <h2 id="titulo-codigo">Código de activación</h2>
        <p className="bajada">
          {codigo.socio} · Carnet {codigo.documento}
        </p>
        <div className="codigo">{formateado}</div>
        <p className="ayuda">
          Vale hasta el {fechaHora(codigo.expira)} y se usa una sola vez. Entrégalo solo al socio: no se volverá a mostrar.
        </p>
        <div className="aviso info" style={{ marginTop: 14 }}>
          El socio abre la app Mercadex, elige <strong>Activar mi cuenta</strong>, escribe su carnet y este código, y crea su contraseña.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            className="boton secundario"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(codigo.codigo);
                setCopiado(true);
              } catch {
                setCopiado(false);
              }
            }}>
            {copiado ? 'Copiado' : 'Copiar código'}
          </button>
          <button className="boton" onClick={alCerrar} autoFocus>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
