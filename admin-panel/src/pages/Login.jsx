import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import { Loader } from 'lucide-react'; // Icon for buffer ring

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false); // NEW: Loading state
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true); // Start buffering

        try {
            const res = await API.post("/auth/login", { email, password });
            
            // Save token
            localStorage.setItem("adminToken", res.data.token);
            
            // Redirect to dashboard
            navigate("/dashboard");
        } catch (err) {
            setError(err.response?.data?.error || "Invalid Credentials");
        } finally {
            setLoading(false); // Stop buffering (success or fail)
        }
    };

    return (
        <div style={{ display: "flex", height: "100vh", justifyContent: "center", alignItems: "center", background: "#f0f2f5" }}>
            <div style={{ background: "white", padding: "40px", borderRadius: "10px", boxShadow: "0 4px 10px rgba(0,0,0,0.1)", width: "350px" }}>
                <h2 style={{ textAlign: "center", marginBottom: "20px", color: "#333" }}>🔐 Admin Login</h2>
                
                {error && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px", borderRadius: "5px", marginBottom: "15px", fontSize: "14px", textAlign: 'center' }}>{error}</div>}
                
                <form onSubmit={handleLogin}>
                    <input
                        type="email"
                        placeholder="Admin Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading} // Disable while loading
                        style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "5px", border: "1px solid #ddd", boxSizing: "border-box" }}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading} // Disable while loading
                        style={{ width: "100%", padding: "12px", marginBottom: "20px", borderRadius: "5px", border: "1px solid #ddd", boxSizing: "border-box" }}
                    />
                    
                    <button 
                        type="submit" 
                        disabled={loading} // Prevent double clicks
                        style={{ 
                            width: "100%", 
                            padding: "12px", 
                            background: loading ? "#94a3b8" : "#007bff", 
                            color: "white", 
                            border: "none", 
                            borderRadius: "5px", 
                            fontSize: "16px", 
                            cursor: loading ? "not-allowed" : "pointer",
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'background 0.3s'
                        }}
                    >
                        {loading ? (
                            <>
                                {/* This is the spinning buffer ring */}
                                <Loader className="animate-spin" size={20} style={{animation: 'spin 1s linear infinite'}} /> 
                                Signing in...
                            </>
                        ) : "Login"}
                    </button>
                    
                    {/* CSS Animation for the spinner */}
                    <style>{`
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    `}</style>
                </form>
            </div>
        </div>
    );
};

export default Login;