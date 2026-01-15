import axios from 'axios';

const envBaseUrl = import.meta.env.VITE_API_URL;

// 외부 기기(같은 네트워크)에서 접속할 때 기본값이 localhost면 "그 기기 자신"을 가리켜 실패합니다.
// 따라서 기본 fallback은 현재 접속 hostname을 사용합니다.
//
// - 권장(배포/프록시): VITE_API_URL=/api/v1
// - 개발(분리 실행):  VITE_API_URL=http://<내IP>:8080/api/v1
const fallbackBaseUrl = `${window.location.protocol}//${window.location.hostname}:8080/api/v1`;
const API_BASE_URL = envBaseUrl || fallbackBaseUrl;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);
