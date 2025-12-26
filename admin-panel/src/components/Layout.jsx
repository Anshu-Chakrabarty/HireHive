import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UserPlus, LogOut } from 'lucide-react';

const Layout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        navigate('/');
    };

    // Styling for menu links
    const getLinkStyle = (path) => ({
        display: 'flex',
        alignItems: 'center',
        padding: '12px 20px',
        color: location.pathname === path ? '#fff' : '#94a3b8',
        background: location.pathname === path ? '#2563eb' : 'transparent',
        textDecoration: 'none',
        borderRadius: '8px',
        margin: '8px 0',
        fontWeight: location.pathname === path ? '600' : 'normal',
        transition: 'all 0.2s'
    });

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
            {/* SIDEBAR */}
            <div style={{ 
                width: '260px', 
                background: '#0f172a', 
                padding: '25px', 
                display: 'flex', 
                flexDirection: 'column', 
                color: 'white', 
                position: 'fixed', 
                height: '100vh',
                boxShadow: '4px 0 10px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ marginBottom: '40px', fontSize: '22px', fontWeight: 'bold', letterSpacing: '0.5px', color: '#fff' }}>
                    🛡️ HireHive
                </h2>
                
                <nav style={{ flex: 1 }}>
                    <Link to="/dashboard" style={getLinkStyle('/dashboard')}>
                        <LayoutDashboard size={20} style={{ marginRight: '12px' }} /> 
                        Dashboard
                    </Link>
                    <Link to="/add-candidate" style={getLinkStyle('/add-candidate')}>
                        <UserPlus size={20} style={{ marginRight: '12px' }} /> 
                        Add Candidate
                    </Link>
                </nav>

                <button onClick={handleLogout} style={{ 
                    display: 'flex', alignItems: 'center', padding: '12px', 
                    background: '#dc2626', color: 'white', border: 'none', 
                    borderRadius: '8px', cursor: 'pointer', marginTop: 'auto',
                    fontWeight: 'bold'
                }}>
                    <LogOut size={20} style={{ marginRight: '10px' }} /> Logout
                </button>
            </div>

            {/* MAIN CONTENT AREA */}
            <div style={{ flex: 1, marginLeft: '260px', padding: '40px', overflowY: 'auto' }}>
                {children}
            </div>
        </div>
    );
};

export default Layout;