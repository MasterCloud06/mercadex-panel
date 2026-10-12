import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, type ConfiguracionPago } from '../api';

export default function DatosPago() {
  const [banco, setBanco] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [titular, setTitular] = useState('');
  const [instrucciones, setInstrucciones] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [qrNuevo, setQrNuevo] = useState<string | null>(null);
  const [quitarQr, setQuitarQr] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api
      .get<ConfiguracionPago>('/api/panel/configuracion-pago')
      .then((c) => {
        setBanco(c.banco ?? '');
        setCuenta(c.numeroCuenta ?? '');
        setTitular(c.titularCuenta ?? '');
        setInstrucciones(c.instrucciones ?? '');
        setQr(c.qrBase64);
      })
      .catch((e: Error) => setMensaje({ texto: e.message, tipo: 'error' }));
  }, []);

  const elegirQr = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (archivo.size > 2 * 1024 * 1024) {
      setMensaje({ texto: 'La imagen pesa más de 2 MB. Usa una captura más liviana.', tipo: 'error' });
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const base64 = String(lector.result).split(',')[1] ?? '';
      setQrNuevo(base64);
      setQuitarQr(false);
      setMensaje(null);
    };
    lector.readAsDataURL(archivo);
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    try {
      const r = await api.put<{ mensaje: string }>('/api/panel/configuracion-pago', {
        banco,
        numeroCuenta: cuenta,
        titularCuenta: titular,
        instrucciones,
        qrBase64: qrNuevo,
        quitarQr,
      });
      if (qrNuevo) setQr(qrNuevo);
      if (quitarQr) setQr(null);
      setQrNuevo(null);
      setQuitarQr(false);
      setMensaje({ texto: r.mensaje, tipo: 'ok' });
    } catch (err) {
      setMensaje({ texto: err instanceof Error ? err.message : 'No se pudo guardar.', tipo: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const vista = quitarQr ? null : qrNuevo ?? qr;

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Datos de pago</h1>
          <p className="bajada">Lo que ven los socios en la app al pulsar «Pagar». Carga la imagen del QR de cobro que te da el banco de la asociación.</p>
        </div>
      </div>

      {mensaje ? <div className={`aviso ${mensaje.tipo}`}>{mensaje.texto}</div> : null}

      <form className="datos-pago" onSubmit={guardar}>
        <div className="tarjeta">
          <label className="campo">
            <span>Banco</span>
            <input value={banco} onChange={(e) => setBanco(e.target.value)} maxLength={80} placeholder="Ej.: Banco Unión" />
          </label>
          <label className="campo">
            <span>Número de cuenta</span>
            <input value={cuenta} onChange={(e) => setCuenta(e.target.value)} maxLength={60} />
          </label>
          <label className="campo">
            <span>Titular de la cuenta</span>
            <input value={titular} onChange={(e) => setTitular(e.target.value)} maxLength={120} placeholder="A nombre de" />
          </label>
          <label className="campo">
            <span>Instrucciones para el socio</span>
            <textarea value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} maxLength={600} placeholder="Ej.: Paga el monto exacto y anota el número de transacción." />
          </label>
          <button className="boton" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

        <div>
          {vista ? (
            <img className="qr-vista" src={`data:image/*;base64,${vista}`} alt="QR de cobro" />
          ) : (
            <div className="qr-vacio">Sin QR. Los socios verán solo los datos de la cuenta.</div>
          )}
          <p className="ayuda">{qrNuevo ? 'QR nuevo: se aplica al guardar.' : quitarQr ? 'El QR se quitará al guardar.' : 'PNG o JPG, hasta 2 MB.'}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <label className="boton secundario" style={{ flex: 1 }}>
              Elegir imagen
              <input type="file" accept="image/png,image/jpeg" onChange={elegirQr} hidden />
            </label>
            {vista ? (
              <button
                type="button"
                className="boton peligro"
                onClick={() => {
                  setQrNuevo(null);
                  setQuitarQr(true);
                }}>
                Quitar
              </button>
            ) : null}
          </div>
        </div>
      </form>
    </>
  );
}
