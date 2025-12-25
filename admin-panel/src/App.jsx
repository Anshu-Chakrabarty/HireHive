import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddCandidate from './pages/AddCandidate';

// Simple protection wrapper
const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('adminToken');
    return token ? children : <Navigate to="/" />;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Login Page is the default */}
                <Route path="/" element={<Login />} />
                
                {/* Protected Dashboard */}
                <Route path="/dashboard" element={
                    <PrivateRoute>
                        <Dashboard />
                    </PrivateRoute>
                } />
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