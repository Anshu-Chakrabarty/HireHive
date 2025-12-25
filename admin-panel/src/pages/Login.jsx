import { useState } from 'react';
import API from '../api';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            // We use the same login route as the main app
            const { data } = await API.post('/auth/login', { email, password });
            
            // Check if user is actually an admin
            if (['admin', 'super_admin', 'sales'].includes(data.user.role)) {
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('adminName', data.user.name);
                navigate('/dashboard'); // Go to the dashboard
            } else {
                alert("Access Denied: You are not an Admin!");
            }
        } catch (err) {
            alert('Login Failed: ' + (err.response?.data?.message || 'Server Error'));
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f4f6f8' }}>
            <form onSubmit={handleLogin} style={{ padding: '40px', background: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <h2 style={{ marginBottom: '20px', color: '#333' }}>Admin Portal 🔒</h2>
                <input 
                    type="email" placeholder="Admin Email" value={email} onChange={(e) => setEmail(e.target.value)} 
                    style={{ display: 'block', width: '100%', padding: '10px', marginBottom: '10px' }}
                />
                <input 
                    type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} 
                    style={{ display: 'block', width: '100%', padding: '10px', marginBottom: '20px' }}
                />
                <button type="submit" style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Login to Dashboard
                </button>
            </form>
        </div>
    );
};

export default Login;