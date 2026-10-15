import { useState, type FormEvent } from 'react';
import { ingresar, type Sesion } from '../api';

export default function Ingreso({ alIngresar }: { alIngresar: (s: Sesion) => void }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      alIngresar(await ingresar(usuario.trim(), password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ingresar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="ingreso">
      <form className="tarjeta" onSubmit={enviar}>
        <div className="sello">M</div>
        <h1>Caja · App de socios</h1>
        <p className="bajada" style={{ marginBottom: 20 }}>
          Revisa los comprobantes que envían los socios y da acceso a la app.
        </p>
        {error ? <div className="aviso error" role="alert">{error}</div> : null}
        <label className="campo">
          <span>Usuario</span>
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <div className="clave">
            <input
              type={verClave ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="ojo"
              onClick={() => setVerClave((v) => !v)}
              aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={verClave}
              title={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {verClave ? <path d="M4 4l16 16" /> : null}
              </svg>
            </button>
          </div>
        </label>
        <button className="boton ancho" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="ayuda" style={{ marginTop: 14 }}>Usa el usuario administrador de Mercadex.</p>
      </form>
    </div>
  );
}
