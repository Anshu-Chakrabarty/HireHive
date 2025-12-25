import { useEffect, useState } from 'react';
import API from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, Briefcase, DollarSign, UserCheck } from 'lucide-react';

const Dashboard = () => {
    const [stats, setStats] = useState({ totalClients: 0, totalCandidates: 0, activeJobs: 0, totalRevenue: 0 });
    const [chartData, setChartData] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true); // Added Loading State

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Stats
                const statsRes = await API.get('/admin/stats');
                setStats(statsRes.data);

                // Fetch Chart Data
                const chartRes = await API.get('/admin/revenue-chart');
                setChartData(chartRes.data);

                // Fetch Logs
                const logsRes = await API.get('/admin/logs');
                setLogs(logsRes.data);
            } catch (err) {
                console.error("Failed to fetch dashboard data", err);
                // If 401, redirect to login might be needed, but for now just log it
                if (err.response && err.response.status === 401) {
                    alert("Session expired. Please login again.");
                    localStorage.removeItem('adminToken'); // Clear bad token
                    window.location.href = '/'; 
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

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

    if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading Admin Panel...</div>;

    return (
        <div style={{ padding: '30px', background: '#f8f9fa', minHeight: '100vh' }}>
            <h1 style={{ marginBottom: '30px' }}>Dashboard Overview</h1>
            
            {/* 1. TOP CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                <StatCard title="Total Clients" value={stats.totalClients} icon={Users} color="#007bff" />
                <StatCard title="Active Jobs" value={stats.activeJobs} icon={Briefcase} color="#28a745" />
                <StatCard title="Candidates" value={stats.totalCandidates} icon={UserCheck} color="#ffc107" />
                <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} color="#dc3545" />
            </div>

            {/* 2. CHARTS SECTION */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                
                {/* Revenue Graph */}
                <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', minHeight: '400px' }}>
                    <h3 style={{ marginBottom: '20px' }}>Revenue Trends</h3>
                    
                    {/* SAFE CHART RENDERING */}
                    <div style={{ width: '100%', height: '300px' }}>
                        {chartData.length > 0 ? (
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
                            <p style={{ padding: '20px', color: '#999', textAlign: 'center' }}>No revenue data yet</p>
                        )}
                    </div>
                </div>

                {/* Recent Logs */}
                <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginBottom: '20px' }}>Recent Activity</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {logs.length === 0 ? <p style={{color: '#999'}}>No recent activity</p> : logs.map((log, i) => (
                            <li key={i} style={{ padding: '10px 0', borderBottom: '1px solid #eee' }}>
                                <strong>{log.name}</strong> <span style={{ color: '#666' }}>{log.action}</span>
                                <div style={{ fontSize: '12px', color: '#999' }}>{new Date(log.created_at).toLocaleDateString()}</div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;