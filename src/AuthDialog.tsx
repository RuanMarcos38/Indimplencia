import { useEffect, useState, type FormEvent } from 'react';
import { api } from './client';

export default function AuthDialog() {
  const [pending, setPending] = useState<{ resolve: (value: unknown) => void; reject: (reason: unknown) => void } | null>(null);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const listener = (event: Event) => { setMessage(''); setPending((event as CustomEvent).detail); };
    window.addEventListener('qf-sign-in', listener);
    return () => window.removeEventListener('qf-sign-in', listener);
  }, []);
  if (!pending) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage('');
    try {
      const result = await api.post('/api/auth/' + (register ? 'register' : 'login'), {
        email: form.get('email'), password: form.get('password'), name: form.get('name'),
      });
      pending?.resolve(result.data); setPending(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao entrar.');
    } finally { setBusy(false); }
  }
  return <div className="auth-overlay">
    <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className="auth-dialog">
      <h2 id="auth-title">{register ? 'Criar conta' : 'Entrar no QuitaFácil'}</h2>
      <p>Conta independente da versão AppDeploy. Seus dados ficam separados por usuário.</p>
      <form onSubmit={submit}>
        {register && <label>Nome<input name="name" autoComplete="name" maxLength={80} required /></label>}
        <label>E-mail<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        <label>Senha<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : 1} maxLength={128} required /></label>
        {register && <small>Use pelo menos 12 caracteres.</small>}
        {message && <p role="alert">{message}</p>}
        <button disabled={busy} type="submit">{busy ? 'Aguarde...' : register ? 'Criar conta' : 'Entrar'}</button>
      </form>
      <button disabled={busy} onClick={() => { setRegister(!register); setMessage(''); }}>
        {register ? 'Já tenho uma conta' : 'Criar minha conta'}
      </button>
      <p>gov.br: aguardando credenciamento. Serasa e SPC: aguardando contratação.</p>
      <button disabled={busy} onClick={() => { pending.reject(new Error('Entrada cancelada.')); setPending(null); }}>Cancelar</button>
    </section>
  </div>;
}

