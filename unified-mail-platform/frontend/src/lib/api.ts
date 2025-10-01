import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};

// Accounts API
export const accountsAPI = {
  list: async () => {
    const response = await api.get('/accounts');
    return response.data;
  },

  get: async (accountId: string) => {
    const response = await api.get(`/accounts/${accountId}`);
    return response.data;
  },

  sync: async (accountId: string) => {
    const response = await api.post(`/accounts/${accountId}/sync`);
    return response.data;
  },

  delete: async (accountId: string) => {
    const response = await api.delete(`/accounts/${accountId}`);
    return response.data;
  },

  gmailAuth: async () => {
    const response = await api.get('/accounts/gmail/auth');
    return response.data;
  },
};

// Messages API
export const messagesAPI = {
  list: async (params?: {
    accountIds?: string[];
    folders?: string[];
    isRead?: boolean;
    isStarred?: boolean;
    page?: number;
    pageSize?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.accountIds) queryParams.set('accountIds', params.accountIds.join(','));
    if (params?.folders) queryParams.set('folders', params.folders.join(','));
    if (params?.isRead !== undefined) queryParams.set('isRead', String(params.isRead));
    if (params?.isStarred !== undefined) queryParams.set('isStarred', String(params.isStarred));
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));

    const response = await api.get(`/messages?${queryParams.toString()}`);
    return response.data;
  },

  search: async (params: {
    query?: string;
    accountIds?: string[];
    folders?: string[];
    page?: number;
    pageSize?: number;
  }) => {
    const response = await api.post('/messages/search', params);
    return response.data;
  },

  get: async (messageId: string) => {
    const response = await api.get(`/messages/${messageId}`);
    return response.data;
  },

  updateFlags: async (messageId: string, flags: { isRead?: boolean; isStarred?: boolean }) => {
    const response = await api.patch(`/messages/${messageId}`, flags);
    return response.data;
  },

  reply: async (
    messageId: string,
    data: { body: string; bodyHtml?: string; cc?: string[]; bcc?: string[] }
  ) => {
    const response = await api.post(`/messages/${messageId}/reply`, data);
    return response.data;
  },

  downloadAttachment: async (messageId: string, attachmentId: string) => {
    const response = await api.get(`/messages/${messageId}/attachments/${attachmentId}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
