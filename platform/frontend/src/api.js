import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE || '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('keyan_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('keyan_token');
      localStorage.removeItem('keyan_user');
      if (!location.pathname.includes('/login')) location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
