import { useState } from 'react';
import API from '../api';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';

const AddCandidate = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setError('');
        setResult(null);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return setError("Please select a PDF file.");

        const formData = new FormData();
        formData.append('cv', file);

        setLoading(true);
        try {
            const res = await API.post('/admin/upload-cv', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResult(res.data);
        } catch (err) {
            setError(err.response?.data?.error || "Upload failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '20px' }}>📄 AI Resume Onboarding</h2>
            <div style={{ background: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                
                <div style={{ border: '2px dashed #ccc', padding: '40px', textAlign: 'center', borderRadius: '8px', cursor: 'pointer', background: '#fafafa' }}>
                    <input type="file" accept=".pdf" onChange={handleFileChange} style={{ display: 'none' }} id="cv-upload" />
                    <label htmlFor="cv-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Upload size={48} color="#007bff" />
                        <p style={{ marginTop: '10px', fontWeight: 'bold' }}>{file ? file.name : "Click to Upload Candidate CV (PDF)"}</p>
                    </label>
                </div>

                {error && <div style={{ marginTop: '20px', padding: '10px', background: '#ffebeb', color: '#d9534f', borderRadius: '5px', display: 'flex', gap: '10px' }}><AlertCircle size={20}/> {error}</div>}

                <button 
                    onClick={handleUpload} 
                    disabled={loading || !file}
                    style={{ marginTop: '20px', width: '100%', padding: '12px', background: loading ? '#ccc' : '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                    {loading ? "Analyzing & Uploading..." : "Process Candidate"}
                </button>

                {result && (
                    <div style={{ marginTop: '30px', padding: '20px', background: '#f0fff4', border: '1px solid #c3e6cb', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#28a745', marginBottom: '15px' }}>
                            <CheckCircle /> <strong>Candidate Onboarded!</strong>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            <li><strong>Name:</strong> {result.detectedData.name}</li>
                            <li><strong>Email:</strong> {result.detectedData.email}</li>
                            <li><strong>Phone:</strong> {result.detectedData.phone || "Not detected"}</li>
                            <li style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                                Default Password set to: <code>HireHive123</code>
                            </li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddCandidate;