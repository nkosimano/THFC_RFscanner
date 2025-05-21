import React, { useState, useRef } from 'react';
import { Camera, Save, X, Truck, Plus, Minus } from 'lucide-react';
import { submitCrateData } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import styles from './BarcodeScanner.module.css';

// For demo purposes - in production, use actual values from a database
const DEFAULT_BREAD_QUANTITY = 24;

const LOCAL_QUEUE_KEY = 'thfc_crate_queue';
const LOCAL_HISTORY_KEY = 'thfc_crate_history';

interface CrateHistoryItem {
  crateId: string;
  actualBreadQuantity: number;
  defaultBreadQuantity: number;
  status: 'sent' | 'pending' | 'failed';
  timestamp: number;
  error?: string;
}

const BarcodeScanner: React.FC = () => {
  const [crateId, setCrateId] = useState('');
  const [actualQuantity, setActualQuantity] = useState(DEFAULT_BREAD_QUANTITY);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [scanHistory, setScanHistory] = useState<CrateHistoryItem[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  useAuth(); // Only for auth context side effects, not using state
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Function to simulate starting the camera
  const startCamera = async () => {
    setIsCameraActive(true);
    
    // In a real implementation, this would access the device camera
    // For this demo, we'll simulate a barcode scan after a short delay
    setTimeout(() => {
      // Simulate scanning a barcode
      const fakeCrateId = `CRATE-${Math.floor(1000 + Math.random() * 9000)}`;
      setCrateId(fakeCrateId);
      setIsCameraActive(false);
      
      // Show success notification
      setNotification({
        type: 'success',
        message: `Successfully scanned crate ${fakeCrateId}`
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => setNotification(null), 3000);
    }, 2000);
  };
  
  // Function to handle manual input of crate ID
  const handleCrateIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCrateId(e.target.value);
  };
  
  // Functions to handle quantity changes
  const incrementQuantity = () => {
    setActualQuantity(prev => prev + 1);
  };
  
  const decrementQuantity = () => {
    setActualQuantity(prev => (prev > 0 ? prev - 1 : 0));
  };
  
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setActualQuantity(value);
    }
  };
  
  // Helper: Save queue to localStorage
  const saveQueue = (queue: CrateHistoryItem[]) => {
    localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(queue));
  };
  // Helper: Load queue from localStorage
  const loadQueue = (): CrateHistoryItem[] => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  };
  // Helper: Save history to localStorage
  const saveHistory = (history: CrateHistoryItem[]) => {
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));
  };
  // Helper: Load history from localStorage
  const loadHistory = (): CrateHistoryItem[] => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  };

  // Try to submit all queued crates
  const tryResubmitQueue = async () => {
    let queue = loadQueue();
    let updatedQueue: CrateHistoryItem[] = [];
    let updatedHistory = loadHistory();
    for (const item of queue) {
      try {

        const response = await submitCrateData({
          crate_id_input: item.crateId,
          bread_quantity: item.actualBreadQuantity
        });
        if (response.success) {
          updatedHistory.unshift({ ...item, status: 'sent', timestamp: Date.now() });
        } else {
          updatedQueue.push({ ...item, status: 'failed', error: response.error, timestamp: Date.now() });
          updatedHistory.unshift({ ...item, status: 'failed', error: response.error, timestamp: Date.now() });
        }
      } catch (error: any) {
        updatedQueue.push({ ...item, status: 'pending', error: error?.message, timestamp: Date.now() });
        updatedHistory.unshift({ ...item, status: 'pending', error: error?.message, timestamp: Date.now() });
      }
    }
    saveQueue(updatedQueue);
    saveHistory(updatedHistory.slice(0, 20)); // Keep last 20
    setScanHistory(updatedHistory.slice(0, 20));
  };

  // On mount: load history and queue, and try to resubmit if online
  React.useEffect(() => {
    setScanHistory(loadHistory());
    if (navigator.onLine) {
      tryResubmitQueue();
    }
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      tryResubmitQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line
  }, []);

  // Function to submit crate data
  const handleSubmit = async () => {
    if (!crateId.trim()) {
      setNotification({
        type: 'error',
        message: 'Please scan or enter a crate ID'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {

      const response = await submitCrateData({
        crate_id_input: crateId,
        bread_quantity: actualQuantity
      });
      let history = loadHistory();
      if (response.success) {
        setNotification({
          type: 'success',
          message: 'Crate data submitted successfully'
        });
        history.unshift({ crateId, actualBreadQuantity: actualQuantity, defaultBreadQuantity: DEFAULT_BREAD_QUANTITY, status: 'sent', timestamp: Date.now() });
        saveHistory(history.slice(0, 20));
        setScanHistory(history.slice(0, 20));
        resetForm();
      } else {
        setNotification({
          type: 'error',
          message: response.error || 'Failed to submit crate data'
        });
        // Save to queue for retry
        let queue = loadQueue();
        queue.push({ crateId, actualBreadQuantity: actualQuantity, defaultBreadQuantity: DEFAULT_BREAD_QUANTITY, status: 'pending', timestamp: Date.now(), error: response.error });
        saveQueue(queue);
        history.unshift({ crateId, actualBreadQuantity: actualQuantity, defaultBreadQuantity: DEFAULT_BREAD_QUANTITY, status: 'pending', timestamp: Date.now(), error: response.error });
        saveHistory(history.slice(0, 20));
        setScanHistory(history.slice(0, 20));
      }
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: 'Network error. Saved for retry.'
      });
      // Save to queue for retry
      let queue = loadQueue();
      queue.push({ crateId, actualBreadQuantity: actualQuantity, defaultBreadQuantity: DEFAULT_BREAD_QUANTITY, status: 'pending', timestamp: Date.now(), error: error?.message });
      saveQueue(queue);
      let history = loadHistory();
      history.unshift({ crateId, actualBreadQuantity: actualQuantity, defaultBreadQuantity: DEFAULT_BREAD_QUANTITY, status: 'pending', timestamp: Date.now(), error: error?.message });
      saveHistory(history.slice(0, 20));
      setScanHistory(history.slice(0, 20));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Function to reset the form
  const resetForm = () => {
    setCrateId('');
    setActualQuantity(DEFAULT_BREAD_QUANTITY);
    setIsCameraActive(false);
  };
  
  return (
    <div className={styles.scannerContainer}>
      {notification && (
        <div className={styles[notification.type]}>
          {notification.message}
        </div>
      )}
      
      <div className={isCameraActive ? styles.viewfinderActive : styles.viewfinder}>
        {isCameraActive ? (
          <video ref={videoRef} autoPlay playsInline />
        ) : (
          <div className={styles.viewfinderPlaceholder}>
            {crateId ? (
              <div>
                <Truck size={48} color="#93C5FD" />
                <p>Crate ID: {crateId}</p>
              </div>
            ) : (
              <div>
                <Camera size={48} color="#9CA3AF" />
                <p>Press "Scan Crate" to activate camera</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      <button 
        className={styles.scanButton}
        onClick={startCamera}
        disabled={isCameraActive || isSubmitting}
      >
        <Camera size={18} />
        Scan Crate
      </button>
      
      <div className={styles.formGroup}>
        <label htmlFor="crateId" className={styles.label}>Crate ID</label>
        <input
          id="crateId"
          type="text"
          className={styles.input}
          value={crateId}
          onChange={handleCrateIdChange}
          placeholder="Enter crate ID manually"
          disabled={isCameraActive || isSubmitting}
        />
      </div>
      
      <div className={styles.formGroup}>
        <label className={styles.label}>Default Bread Quantity</label>
        <input
          type="text"
          className={styles.input}
          value={DEFAULT_BREAD_QUANTITY}
          disabled
        />
      </div>
      
      <div className={styles.formGroup}>
        <label htmlFor="actualQuantity" className={styles.label}>Actual Bread Quantity</label>
        <div className={styles.quantityControl}>
          <button 
            type="button" 
            className={styles.quantityButton}
            onClick={decrementQuantity}
            disabled={isSubmitting}
          >
            <Minus size={18} />
          </button>
          <input
            id="actualQuantity"
            type="number"
            className={styles.quantityInput}
            value={actualQuantity}
            onChange={handleQuantityChange}
            min="0"
            disabled={isSubmitting}
          />
          <button 
            type="button" 
            className={styles.quantityButton}
            onClick={incrementQuantity}
            disabled={isSubmitting}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
      
      <button 
        className={styles.submitButton}
        onClick={handleSubmit}
        disabled={!crateId.trim() || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <span className={styles.loading}></span>
            <span>Submitting...</span>
          </>
        ) : (
          <>
            <Save size={18} />
            <span>Submit Crate</span>
          </>
        )}
      </button>
      
      <button 
        className={styles.clearButton}
        onClick={resetForm}
        disabled={isSubmitting}
      >
        <X size={18} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />
        Clear Form
      </button>
    {/* Scan History UI */}
    <div className={styles.historySection} style={{marginTop: '2rem'}}>
      <h3 style={{marginBottom: '0.5rem'}}>Scan History</h3>
      <ul style={{listStyle: 'none', padding: 0, maxHeight: 200, overflowY: 'auto'}}>
        {scanHistory.length === 0 && <li style={{color:'#888'}}>No scans yet.</li>}
        {scanHistory.map((item, idx) => (
          <li key={idx} style={{marginBottom: 6, color: item.status==='sent' ? 'green' : item.status==='failed' ? 'red' : 'orange', display: 'flex', alignItems: 'center'}}>
            <div style={{flex:1}}>
              <b>{item.crateId}</b> | Qty: {item.actualBreadQuantity} | <span style={{textTransform:'capitalize'}}>{item.status}</span>
              {item.error && <span style={{color:'#b91c1c'}}> ({item.error})</span>}
              <span style={{fontSize:12, color:'#888', marginLeft:8}}>{new Date(item.timestamp).toLocaleTimeString()}</span>
            </div>
            {(item.status === 'failed' || item.status === 'pending') && (
              <button
                style={{marginLeft:8, fontSize:12, padding:'2px 8px', borderRadius:4, border:'1px solid #ccc', background:'#f3f4f6', cursor:'pointer'}}
                onClick={async () => {
                  // Remove from queue/history first
                  let queue = loadQueue().filter(q => !(q.crateId === item.crateId && q.timestamp === item.timestamp));
                  saveQueue(queue);
                  let history = loadHistory().filter(h => !(h.crateId === item.crateId && h.timestamp === item.timestamp));
                  // Try to resubmit
                  try {
                    const response = await submitCrateData({
                      crate_id_input: item.crateId,
                      bread_quantity: item.actualBreadQuantity
                    });
                    if (response.success) {
                      history.unshift({ ...item, status: 'sent', error: undefined, timestamp: Date.now() });
                      setNotification({ type: 'success', message: 'Crate data resubmitted successfully' });
                    } else {
                      queue.push({ ...item, status: 'failed', error: response.error, timestamp: Date.now() });
                      history.unshift({ ...item, status: 'failed', error: response.error, timestamp: Date.now() });
                      setNotification({ type: 'error', message: response.error || 'Failed to resubmit crate data' });
                    }
                  } catch (error: any) {
                    queue.push({ ...item, status: 'pending', error: error?.message, timestamp: Date.now() });
                    history.unshift({ ...item, status: 'pending', error: error?.message, timestamp: Date.now() });
                    setNotification({ type: 'error', message: 'Network error. Still queued.' });
                  }
                  saveQueue(queue);
                  saveHistory(history.slice(0, 20));
                  setScanHistory(history.slice(0, 20));
                }}
                disabled={isSubmitting}
              >Retry</button>
            )}
          </li>
        ))}
      </ul>
      {!isOnline && <div style={{color:'#f59e42', fontSize:12, marginTop:4}}>Offline: new scans will be queued for later submission.</div>}
    </div>
    </div>
  );
};

export default BarcodeScanner;