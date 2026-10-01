type User = { id: string; name: string; email: string };
async function request(method: string, url: string, body?: unknown) {
  const response = await fetch(url, {
    method, credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Falha na operação.'), { response: { data } });
  return { data };
}
export const api = {
  get: (url: string) => request('GET', url),
  post: (url: string, body?: unknown) => request('POST', url, body),
  put: (url: string, body?: unknown) => request('PUT', url, body),
  delete: (url: string) => request('DELETE', url),
};
export const auth = {
  getUser: async (): Promise<User | null> => (await api.get('/api/auth/user')).data.user,
  signIn: (): Promise<{ user: User }> => new Promise((resolve, reject) => {
    window.dispatchEvent(new CustomEvent('qf-sign-in', { detail: { resolve, reject } }));
  }),
  signOut: () => api.post('/api/auth/logout'),
};

