import { api } from './client';
import type { ApplicationView, Trip, TripMember, User } from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: User }>('/users/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, nickname: string, password: string) =>
    api<User>('/users/register', { method: 'POST', body: JSON.stringify({ email, nickname, password }) })
};

export const tripApi = {
  list: () => api<Trip[]>('/trips'),
  create: (payload: Partial<Trip>) => api<Trip>('/trips', { method: 'POST', body: JSON.stringify(payload) })
};

export const matchApi = {
  score: (candidate: { destination: string; budgetMax: number }, target: { destination: string; budgetMax: number }) =>
    api<{ score: number }>('/companions/score', { method: 'POST', body: JSON.stringify({ candidate, target }) })
};

export const applicationApi = {
  apply: (tripId: number, message: string) =>
    api<ApplicationView>('/applications', { method: 'POST', body: JSON.stringify({ tripId, message }) }),
  listMine: () => api<ApplicationView[]>('/applications/mine'),
  listReceived: () => api<ApplicationView[]>('/applications/received'),
  approve: (id: number) => api<ApplicationView>(`/applications/${id}/approve`, { method: 'POST' }),
  reject: (id: number) => api<ApplicationView>(`/applications/${id}/reject`, { method: 'POST' })
};

export const memberApi = {
  list: (tripId: number) => api<TripMember[]>(`/trips/${tripId}/members`)
};
