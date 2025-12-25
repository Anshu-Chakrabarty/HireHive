import axios from 'axios';

// 1. Point to your Backend Server
const API = axios.create({
    baseURL: 'https://hirehive-api.onrender.com/api',

});

// 2. Automatically add Token to requests
API.interceptors.request.use((req) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
});

export default API;