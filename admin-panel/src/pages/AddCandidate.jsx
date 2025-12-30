import { useState, useEffect } from 'react';
import API from '../api';
import { Upload, CheckCircle, AlertCircle, Loader, FileText, X } from 'lucide-react';

const AddCandidate = () => {
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null); // To store the PDF preview link
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    // Handle File Selection & Create Preview
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.type === "application/pdf") {
            setFile(selectedFile);
            setResult(null);
            setError('');
            // Create a fake URL to preview the file immediately
            const objectUrl = URL.createObjectURL(selectedFile);
            setPreviewUrl(objectUrl);
        } else {
            setError("Please select a valid PDF file.");
        }
    };

    // Clean up memory when component closes
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return setError("Please select a PDF file.");

        const formData = new FormData();
        formData.append('cv', file);

        setLoading(true); // Start Buffer
        setError('');
        
        try {
            const res = await API.post('/admin/upload-cv', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResult(res.data);
            setFile(null); // Clear file after success
            setPreviewUrl(null); // Clear preview after success
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "Upload failed. Check backend logs.");
        } finally {
            setLoading(false); // Stop Buffer
        }
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '10px', color: '#333' }}>🚀 AI Candidate Onboarding</h1>
            <p style={{ color: '#666', marginBottom: '30px' }}>Upload a resume to auto-create an account.</p>

            <div style={{ display: 'grid', gridTemplateColumns: previewUrl ? '1fr 1fr' : '1fr', gap: '30px' }}>
                
                {/* LEFT SIDE: UPLOAD FORM */}
                <div style={{ background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', height: 'fit-content' }}>
                    
                    {/* Drop Zone */}
                    {!file ? (
                        <div style={{ border: '2px dashed #cbd5e1', padding: '40px', textAlign: 'center', borderRadius: '12px', cursor: 'pointer', background: '#f8fafc', transition: 'all 0.3s' }}>
                            <input type="file" accept=".pdf" onChange={handleFileChange} style={{ display: 'none' }} id="cv-upload" />
                            <label htmlFor="cv-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Upload size={50} color="#3b82f6" />
                                <p style={{ marginTop: '15px', fontWeight: '600', color: '#475569' }}>Click to Upload Resume</p>
                                <p style={{ color: '#94a3b8', fontSize: '13px' }}>PDF only (Max 5MB)</p>
                            </label>
                        </div>
                    ) : (
                        // File Selected View
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '15px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FileText color="#2563eb" />
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e40af' }}>{file.name}</div>
                                    <div style={{ fontSize: '12px', color: '#60a5fa' }}>Ready to process</div>
                                </div>
                            </div>
                            <button onClick={() => { setFile(null); setPreviewUrl(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#ef4444" /></button>
                        </div>
                    )}

                    {error && (
                        <div style={{ marginTop: '20px', padding: '15px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertCircle size={20}/> {error}
                        </div>
                    )}

                    <button 
                        onClick={handleUpload} 
                        disabled={loading || !file}
                        style={{ 
                            marginTop: '25px', width: '100%', padding: '14px', 
                            background: loading ? '#94a3b8' : '#2563eb', 
                            color: 'white', border: 'none', borderRadius: '8px', 
                            fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' 
                        }}
                    >
                        {loading ? (
                            <>
                                <Loader className="animate-spin" style={{animation: 'spin 1s linear infinite'}} /> 
                                Analyzing...
                            </>
                        ) : "✨ Process Candidate"}
                    </button>

                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>

                {/* RIGHT SIDE: PDF PREVIEW (Only shows when file is selected) */}
                {previewUrl && (
                    <div style={{ background: '#333', borderRadius: '12px', overflow: 'hidden', height: '500px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                        <div style={{ background: '#222', padding: '10px 15px', color: '#fff', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
                            DOCUMENT PREVIEW
                        </div>
                        <iframe src={previewUrl} width="100%" height="100%" style={{ border: 'none' }} title="PDF Preview" />
                    </div>
                )}
            </div>

            {/* SUCCESS RESULT (Below Everything) */}
            {result && (
                <div style={{ marginTop: '30px', padding: '25px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', animation: 'fadeIn 0.5s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#16a34a', marginBottom: '20px', fontSize: '18px' }}>
                        <CheckCircle size={28} /> <strong>Success! Account Created.</strong>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>FULL NAME</label>
                            <div style={{ fontSize: '16px', color: '#334155' }}>{result.detectedData.name}</div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>EMAIL ADDRESS</label>
                            <div style={{ fontSize: '16px', color: '#334155' }}>{result.detectedData.email}</div>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>PHONE</label>
                            <div style={{ fontSize: '16px', color: '#334155' }}>{result.detectedData.phone || "Not Detected"}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddCandidate;