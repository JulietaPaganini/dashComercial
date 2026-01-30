import React, { useCallback, useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { parseExcelFiles } from '../../services/ExcelParser';
import { processDataset } from '../../services/DataProcessor';

const FileDropzone = ({ onDataProcessed }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    };

    const processFiles = async (fileList) => {
        setIsLoading(true);
        setError(null);
        try {
            const validFiles = Array.from(fileList).filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
            if (validFiles.length === 0) throw new Error('Por favor subí archivos Excel (.xlsx)');

            setFiles(validFiles);

            // 1. Parse raw
            const rawData = await parseExcelFiles(validFiles);

            // 2. Process & Model
            const modelData = processDataset(rawData);

            onDataProcessed(modelData);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    };

    const handleChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processFiles(e.target.files);
        }
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                style={{
                    border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: isDragging ? 'rgba(0, 224, 255, 0.05)' : 'var(--bg-panel)',
                    padding: '4rem 2rem',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    cursor: isLoading ? 'wait' : 'pointer',
                    position: 'relative'
                }}
            >
                <input
                    type="file"
                    multiple
                    accept=".xlsx, .xls"
                    onChange={handleChange}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    disabled={isLoading}
                />

                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <Loader2 size={48} className="spin" color="var(--color-primary)" />
                        <p style={{ color: 'var(--text-muted)' }}>Procesando archivos...</p>
                    </div>
                ) : (
                    <>
                        <div style={{
                            width: '80px', height: '80px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem auto'
                        }}>
                            <UploadCloud size={32} color="var(--color-primary)" />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Arrastrá tus archivos Excel acá</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>o hacé click para seleccionar (Cotizaciones y Clientes)</p>

                        {files.length > 0 && (
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                {files.map((f, i) => (
                                    <div key={i} className="glass-panel" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                        <FileSpreadsheet size={16} color="var(--color-success)" />
                                        {f.name}
                                    </div>
                                ))}
                            </div>
                        )}

                        {error && (
                            <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255, 0, 85, 0.1)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                <AlertTriangle size={16} />
                                {error}
                            </div>
                        )}
                    </>
                )}
            </div>

            <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
};

export default FileDropzone;
