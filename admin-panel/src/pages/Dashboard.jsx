import { useEffect, useState } from 'react';
import API from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, Briefcase, DollarSign, UserCheck, AlertTriangle } from 'lucide-react';

const Dashboard = () => {
    const [stats, setStats] = useState({ totalClients: 0, totalCandidates: 0, activeJobs: 0, totalRevenue: 0 });
    const [chartData, setChartData] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('adminToken');
                if (!token) throw new Error("No token found");

                // Fetch all data in parallel
                const [statsRes, chartRes, logsRes] = await Promise.all([
                    API.get('/admin/stats'),
                    API.get('/admin/revenue-chart'),
                    API.get('/admin/logs')
                ]);

                setStats(statsRes.data);
                setChartData(chartRes.data);
                setLogs(logsRes.data);
                setErrorMsg(null);
            } catch (err) {
                console.error("Dashboard Error:", err);
                const message = err.response?.data?.error || err.message;
                
                // If token is invalid (401), kick user out
                if (err.response?.status === 401) {
                    localStorage.removeItem('adminToken');
                    window.location.href = '/';
                } else {
                    setErrorMsg(message);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div style={{ padding: '50px', textAlign: 'center', minHeight: '100vh' }}>Loading Dashboard...</div>;

    if (errorMsg) return (
        <div style={{ padding: '50px', color: '#721c24', textAlign: 'center', minHeight: '100vh', background: '#f8d7da' }}>
            <AlertTriangle size={48} />
            <h3>Error Loading Dashboard</h3>
            <p>{errorMsg}</p>
        </div>
    );

    // Reusable Card Component
    const StatCard = ({ title, value, icon: Icon, color }) => (
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ padding: '15px', borderRadius: '50%', background: `${color}20`, color: color }}>
                <Icon size={24} />
            </div>
            <div>
                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{title}</p>
                <h3 style={{ margin: '5px 0 0', fontSize: '24px' }}>{value}</h3>
            </div>
        </div>
    );

    return (
        // MAIN CONTAINER: Ensuring it takes full width and height
        <div style={{ padding: '30px', background: '#f8f9fa', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
            <h1 style={{ marginBottom: '30px', color: '#333' }}>Dashboard Overview</h1>
            
            {/* 1. TOP STATS CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                <StatCard title="Total Clients" value={stats.totalClients} icon={Users} color="#007bff" />
                <StatCard title="Active Jobs" value={stats.activeJobs} icon={Briefcase} color="#28a745" />
                <StatCard title="Candidates" value={stats.totalCandidates} icon={UserCheck} color="#ffc107" />
                <StatCard title="Total Revenue" value={`₹${stats.totalRevenue?.toLocaleString()}`} icon={DollarSign} color="#dc3545" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                
                {/* 2. REVENUE CHART */}
                <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', minHeight: '400px' }}>
                    <h3 style={{ marginBottom: '20px' }}>Revenue Trends</h3>
                    
                    {/* Fixed Height Wrapper for Recharts */}
                    <div style={{ width: '100%', height: '300px' }}>
                        {chartData && chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="revenue" fill="#007bff" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p style={{ textAlign: 'center', color: '#888', marginTop: '100px' }}>No revenue data available yet</p>
                        )}
                    </div>
                </div>

                {/* 3. RECENT ACTIVITY LOGS */}
                <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginBottom: '20px' }}>Recent Activity</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {logs.length === 0 ? <p style={{color: '#999'}}>No recent activity</p> : logs.map((log, i) => (
                            <li key={i} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
                                <div style={{fontWeight: 'bold', color: '#333'}}>{log.name}</div>
                                <div style={{ fontSize: '14px', color: '#555' }}>{log.action}</div>
                                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                                    {new Date(log.created_at).toLocaleDateString()}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;