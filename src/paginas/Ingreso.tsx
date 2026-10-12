import { useState, type FormEvent } from 'react';
import { ingresar, type Sesion } from '../api';

export default function Ingreso({ alIngresar }: { alIngresar: (s: Sesion) => void }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
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
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="boton ancho" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="ayuda" style={{ marginTop: 14 }}>Usa el usuario administrador de Mercadex.</p>
      </form>
    </div>
  );
}
