import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const invoicesApi = {
  list: () => api.get('/invoices'),
  get: (id) => api.get(`/invoices/${id}`),
  ocr: (formData) => api.post('/invoices/ocr', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  create: (data) => api.post('/invoices', data),
  updateStatus: (id, status) => api.put(`/invoices/${id}/status`, { status }),
  delete: (id) => api.delete(`/invoices/${id}`)
};

export const productsApi = {
  list: () => api.get('/products'),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`)
};

export const suppliersApi = {
  list: () => api.get('/suppliers'),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`)
};

export const stockApi = {
  list: () => api.get('/stock'),
  alerts: () => api.get('/stock/alerts'),
  movements: (params) => api.get('/stock/movements', { params }),
  summary: () => api.get('/stock/summary'),
  adjustment: (data) => api.post('/stock/adjustment', data)
};

export const recipesApi = {
  list: () => api.get('/recipes'),
  get: (id) => api.get(`/recipes/${id}`),
  create: (data) => api.post('/recipes', data),
  update: (id, data) => api.put(`/recipes/${id}`, data),
  delete: (id) => api.delete(`/recipes/${id}`)
};

export const salesApi = {
  list: (params) => api.get('/sales', { params }),
  get: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  report: (params) => api.get('/sales/report/summary', { params })
};

export default api;
