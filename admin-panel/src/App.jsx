import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddCandidate from './pages/AddCandidate';
import Layout from './components/Layout'; // <--- Import the Sidebar we made

// Protection Wrapper + Layout Applicator
const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('adminToken');
    
    // If logged in, wrap the page in the Sidebar Layout
    // If not, kick them back to Login
    return token ? <Layout>{children}</Layout> : <Navigate to="/" />;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Login Page is the default (No Sidebar) */}
                <Route path="/" element={<Login />} />
                
                {/* Protected Dashboard (Has Sidebar) */}
                <Route path="/dashboard" element={
                    <PrivateRoute>
                        <Dashboard />
                    </PrivateRoute>
                } />

                {/* Protected Add Candidate Form (Has Sidebar) */}
                <Route path="/add-candidate" element={
                    <PrivateRoute>
                        <AddCandidate />
                    </PrivateRoute>
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;