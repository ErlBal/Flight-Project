import axios, { AxiosRequestConfig } from 'axios'

const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const api = axios.create({ baseURL })

api.interceptors.request.use((config: AxiosRequestConfig) => {
	const token = localStorage.getItem('auth_token')
	if (token) {
		config.headers = config.headers || {}
		config.headers['Authorization'] = `Bearer ${token}`
	}
	return config
})

export default api
