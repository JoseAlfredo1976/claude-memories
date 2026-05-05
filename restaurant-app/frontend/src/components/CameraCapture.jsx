import { useState, useRef, useCallback } from 'react';

export default function CameraCapture({ onCapture }) {
  const [mode, setMode] = useState('idle'); // idle | camera | preview
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMode('camera');
    } catch {
      setError('No se pudo acceder a la cámara. Usa el botón de subir archivo.');
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      const file = new File([blob], `factura_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      setPreview(url);
      setMode('preview');
      stopCamera();
      onCapture(file);
    }, 'image/jpeg', 0.9);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setMode('preview');
    onCapture(file);
  };

  const reset = () => {
    stopCamera();
    setMode('idle');
    setPreview(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="camera-container">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {mode === 'idle' && (
        <>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>📷</div>
          <p className="text-muted text-sm" style={{ marginBottom: '16px' }}>
            Toma una foto de la factura o sube una imagen
          </p>
          {error && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{error}</div>}
          <div className="camera-actions">
            <button className="btn btn-primary" onClick={startCamera}>📷 Usar cámara</button>
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              📁 Subir archivo
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleFileChange} />
        </>
      )}

      {mode === 'camera' && (
        <>
          <video ref={videoRef} className="camera-preview" autoPlay playsInline muted />
          <div className="camera-actions">
            <button className="btn btn-primary" onClick={capture}>📸 Capturar</button>
            <button className="btn btn-secondary" onClick={reset}>Cancelar</button>
          </div>
        </>
      )}

      {mode === 'preview' && preview && (
        <>
          <img src={preview} className="camera-preview" alt="Factura capturada" />
          <div className="camera-actions">
            <button className="btn btn-secondary btn-sm" onClick={reset}>🔄 Nueva foto</button>
          </div>
        </>
      )}
    </div>
  );
}
