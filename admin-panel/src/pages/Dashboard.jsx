import { useEffect, useState } from 'react';
import API from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, Briefcase, DollarSign, UserCheck, AlertTriangle, X } from 'lucide-react';

const Dashboard = () => {
    const [stats, setStats] = useState({ totalClients: 0, totalCandidates: 0, activeJobs: 0, totalRevenue: 0 });
    const [chartData, setChartData] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    // --- MODAL STATE ---
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState("");
    const [modalData, setModalData] = useState([]);
    const [loadingModal, setLoadingModal] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('adminToken');
                if (!token) throw new Error("No token found");

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

    // --- HANDLE CARD CLICKS ---
    const handleCardClick = async (type) => {
        setModalOpen(true);
        setLoadingModal(true);
        setModalData([]); // Clear previous data

        try {
            let endpoint = '';
            let title = '';

            // Define endpoints based on card clicked
            if (type === 'clients') {
                endpoint = '/admin/users?role=employer'; 
                title = 'All Employers';
            } else if (type === 'candidates') {
                endpoint = '/admin/users?role=seeker';
                title = 'All Candidates';
            } else if (type === 'jobs') {
                endpoint = '/admin/jobs';
                title = 'Active Job Postings';
            } else {
                return; // Revenue doesn't open a list
            }

            setModalTitle(title);
            const res = await API.get(endpoint);
            
            // Adjust this based on your actual API response structure
            // Example: res.data might be the array, or res.data.users
            setModalData(Array.isArray(res.data) ? res.data : (res.data.users || res.data.jobs || []));

        } catch (error) {
            console.error("Error fetching details:", error);
            setModalData([]);
        } finally {
            setLoadingModal(false);
        }
    };

    if (loading) return <div style={{ padding: '50px', textAlign: 'center', minHeight: '100vh' }}>Loading Dashboard...</div>;

    if (errorMsg) return (
        <div style={{ padding: '50px', color: '#721c24', textAlign: 'center', minHeight: '100vh', background: '#f8d7da' }}>
            <AlertTriangle size={48} />
            <h3>Error Loading Dashboard</h3>
            <p>{errorMsg}</p>
        </div>
    );

    // --- UPDATED CARD COMPONENT (High Contrast) ---
    const StatCard = ({ title, value, icon: Icon, color, onClick }) => (
        <div 
            onClick={onClick}
            style={{ 
                background: color, // Use the color for the background
                color: '#fff',     // Force text to white
                padding: '20px', 
                borderRadius: '10px', 
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '15px',
                cursor: onClick ? 'pointer' : 'default', // Show hand cursor if clickable
                transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-5px)')}
            onMouseLeave={(e) => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
        >
            <div style={{ padding: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }}>
                <Icon size={24} color="#fff" />
            </div>
            <div>
                <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>{title}</p>
                <h3 style={{ margin: '5px 0 0', fontSize: '28px', fontWeight: 'bold' }}>{value}</h3>
            </div>
        </div>
    );

    return (
        <div style={{ padding: '30px', background: '#f8f9fa', minHeight: '100vh', width: '100%', boxSizing: 'border-box', position: 'relative' }}>
            <h1 style={{ marginBottom: '30px', color: '#333' }}>Dashboard Overview</h1>
            
            {/* 1. TOP STATS CARDS (Updated Colors) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                <StatCard 
                    title="Total Clients" 
                    value={stats.totalClients} 
                    icon={Users} 
                    color="#0d6efd" // Blue
                    onClick={() => handleCardClick('clients')}
                />
                <StatCard 
                    title="Active Jobs" 
                    value={stats.activeJobs} 
                    icon={Briefcase} 
                    color="#198754" // Green
                    onClick={() => handleCardClick('jobs')}
                />
                <StatCard 
                    title="Candidates" 
                    value={stats.totalCandidates} 
                    icon={UserCheck} 
                    color="#ffc107" // Yellow/Orange
                    onClick={() => handleCardClick('candidates')}
                />
                <StatCard 
                    title="Total Revenue" 
                    value={`₹${stats.totalRevenue?.toLocaleString()}`} 
                    icon={DollarSign} 
                    color="#dc3545" // Red (No Click Action)
                />
            </div>

            {/* 2. CHARTS & LOGS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                {/* Revenue Chart */}
                <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', minHeight: '400px' }}>
                    <h3 style={{ marginBottom: '20px' }}>Revenue Trends</h3>
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

                {/* Recent Activity */}
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

            {/* --- 3. DETAIL MODAL (The Popup) --- */}
            {modalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <div style={{
                        background: 'white', width: '90%', maxWidth: '800px', 
                        maxHeight: '80vh', overflowY: 'auto', borderRadius: '12px', padding: '25px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>{modalTitle}</h2>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={28} />
                            </button>
                        </div>

                        {loadingModal ? (
                            <div style={{ textAlign: 'center', padding: '30px' }}>Loading data...</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                                        <th style={{ padding: '12px', borderBottom: '2px solid #eee' }}>Name/Title</th>
                                        <th style={{ padding: '12px', borderBottom: '2px solid #eee' }}>Email/Company</th>
                                        <th style={{ padding: '12px', borderBottom: '2px solid #eee' }}>Status/Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modalData.length === 0 ? (
                                        <tr><td colSpan="3" style={{ padding: '20px', textAlign: 'center' }}>No records found.</td></tr>
                                    ) : (
                                        modalData.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                {/* Logic to handle different data types (User vs Job) */}
                                                <td style={{ padding: '12px' }}>
                                                    <strong>{item.name || item.title || "N/A"}</strong>
                                                </td>
                                                <td style={{ padding: '12px' }}>
                                                    {item.email || item.company_name || "N/A"}
                                                </td>
                                                <td style={{ padding: '12px' }}>
                                                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : 
                                                     item.posteddate ? new Date(item.posteddate).toLocaleDateString() : "N/A"}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;