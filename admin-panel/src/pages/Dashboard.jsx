import { useEffect, useState } from 'react';
import API from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, Briefcase, DollarSign, UserCheck, AlertTriangle } from 'lucide-react';

const Dashboard = () => {
    const [stats, setStats] = useState({ totalClients: 0, totalCandidates: 0, activeJobs: 0, totalRevenue: 0 });
    const [chartData, setChartData] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null); // To show debug info

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Check if token exists in browser
                const token = localStorage.getItem('adminToken');
                if (!token) throw new Error("No token found in LocalStorage");

                console.log("Using Token:", token.substring(0, 10) + "..."); // Debug log

                // Fetch Stats
                const statsRes = await API.get('/admin/stats');
                setStats(statsRes.data);

                // Fetch Chart Data
                const chartRes = await API.get('/admin/revenue-chart');
                setChartData(chartRes.data);

                // Fetch Logs
                const logsRes = await API.get('/admin/logs');
                setLogs(logsRes.data);
                
                setErrorMsg(null); // Clear errors if successful
            } catch (err) {
                console.error("Dashboard Error:", err);
                // SHOW THE ERROR ON SCREEN INSTEAD OF REDIRECTING
                const message = err.response?.data?.error || err.message || "Unknown Error";
                const status = err.response?.status;
                setErrorMsg(`Error ${status}: ${message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;

    // ERROR SCREEN (Debug Mode)
    if (errorMsg) {
        return (
            <div style={{ padding: '50px', textAlign: 'center', color: '#721c24', background: '#f8d7da', height: '100vh' }}>
                <AlertTriangle size={48} style={{ marginBottom: '20px' }} />
                <h1>Access Denied</h1>
                <h3 style={{ fontFamily: 'monospace', background: 'white', padding: '10px', display: 'inline-block' }}>
                    DEBUG INFO: {errorMsg}
                </h3>
                <p>Please check your Render Backend Logs for "Admin Auth Error"</p>
                <button onClick={() => window.location.href = '/'} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}>
                    Back to Login
                </button>
            </div>
        );
    }

    // NORMAL DASHBOARD
    return (
        <div style={{ padding: '30px', background: '#f8f9fa', minHeight: '100vh' }}>
            <h1 style={{ marginBottom: '30px' }}>Dashboard Overview</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <h3>Clients</h3>
                    <h2>{stats.totalClients}</h2>
                </div>
                <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <h3>Revenue</h3>
                    <h2>₹{stats.totalRevenue}</h2>
                </div>
            </div>
            {/* Charts Hidden for Debug Simplicity */}
             <div style={{ background: 'white', padding: '20px', borderRadius: '10px', height: '300px' }}>
                <h3>Revenue Chart</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#007bff" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default Dashboard;