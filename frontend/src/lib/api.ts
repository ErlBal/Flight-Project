import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

// Используем прод домен как fallback, чтобы исключить обращения к localhost в собранном билде.
// Для локальной разработки всё равно выставляй VITE_API_BASE=http://localhost:8000
const baseURL = import.meta.env.VITE_API_BASE || 'https://flight-project-production.up.railway.app'

const api = axios.create({ baseURL })

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
	const url = config.url || ''
	// не добавляем токен на эндпоинты логина/регистрации
	if (/\/auth\/(login|login-json|register)/.test(url)) return config
	const token = localStorage.getItem('auth_token')
	if (token) {
		config.headers = config.headers || {}
		;(config.headers as any)['Authorization'] = `Bearer ${token}`
	}
	return config
})

// Global response interceptor: handle 401 + normalize error detail
api.interceptors.response.use(
	(r: any) => r,
	(error: AxiosError<any>) => {
		if (error.response?.status === 401) {
			// токен протух или неверен
			localStorage.removeItem('auth_token')
			if (location.pathname !== '/login') {
				location.href = '/login'
			}
		}
		return Promise.reject(error)
	}
)

export function extractErrorMessage(data: any): string {
	if (!data) return 'Ошибка'
	const detail = (data as any).detail
	if (!detail) return typeof data === 'string' ? data : 'Ошибка'
	if (typeof detail === 'string') return detail
	if (Array.isArray(detail)) {
		const first = detail[0]
		if (first) {
			if (typeof first === 'string') return first
			if (first.msg) return first.msg
			return JSON.stringify(first)
		}
	}
	if (typeof detail === 'object') {
		if ((detail as any).msg) return (detail as any).msg
		try { return JSON.stringify(detail) } catch { return 'Ошибка' }
	}
	return 'Ошибка'
}

export default api
