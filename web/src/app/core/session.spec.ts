import { TestBed } from '@angular/core/testing';
import { SessionStore } from './session';

function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
}

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(SessionStore);
  });

  it('empieza sin sesión', () => {
    expect(store.isAuthenticated()).toBe(false);
    expect(store.role()).toBeNull();
    expect(store.homePath()).toBe('/');
  });

  it('decodifica claims y expone rol y nombre', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    store.set(fakeJwt({ sub: 'u1', role: 'productor', name: 'Ana', exp }));
    expect(store.isAuthenticated()).toBe(true);
    expect(store.role()).toBe('productor');
    expect(store.nombre()).toBe('Ana');
    expect(store.homePath()).toBe('/p');
  });

  it('trata un token expirado como sin sesión', () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    store.set(fakeJwt({ sub: 'u1', role: 'admin', name: 'X', exp }));
    expect(store.isAuthenticated()).toBe(false);
  });

  it('homePath por rol', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    store.set(fakeJwt({ sub: 'a', role: 'transportista', name: 'T', exp }));
    expect(store.homePath()).toBe('/t');
    store.set(fakeJwt({ sub: 'a', role: 'admin', name: 'A', exp }));
    expect(store.homePath()).toBe('/a');
  });

  it('clear borra la sesión', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    store.set(fakeJwt({ sub: 'u1', role: 'productor', name: 'Ana', exp }));
    store.clear();
    expect(store.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('agroflete.token')).toBeNull();
  });
});
