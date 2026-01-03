import { useRef, useEffect, useState } from 'preact/compat';
import { importFromJson } from '@src/workspaceAPI/import';

const ImportPage = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Set up countdown timer
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    // Open file dialog after 5 seconds
    const dialogTimer = setTimeout(() => {
      fileInputRef.current?.click();
    }, 5000);

    // Cleanup timers
    return () => {
      clearInterval(timer);
      clearTimeout(dialogTimer);
    };
  }, []);

  const handleFileChange = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      await importFromJson(content);
      console.log('Import workspaces completed');
      window.close();
    } catch (error) {
      console.error('Failed to import workspaces:', error);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <main
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        margin: 0,
        background: '#f5f5f5',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '40px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: '0 0 20px 0', color: '#333', fontSize: '24px' }}>
          Import Workspace
        </h1>
        <p style={{ color: '#666', margin: '15px 0' }}>
          File dialog will open in:
        </p>
        <p
          style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: countdown <= 2 ? '#d32f2f' : '#0078d4',
            margin: '20px 0',
          }}
        >
          {Math.max(0, countdown)}
        </p>
        <p style={{ color: '#666', margin: '15px 0' }}>
          Or click the button below to open immediately:
        </p>
        <button
          onClick={handleClick}
          style={{
            background: '#0078d4',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={e =>
            (e.currentTarget.style.backgroundColor = '#106ebe')
          }
          onMouseLeave={e =>
            (e.currentTarget.style.backgroundColor = '#0078d4')
          }
        >
          Choose File
        </button>
        <input
          ref={fileInputRef}
          type='file'
          accept='.json'
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </main>
  );
};

export default ImportPage;
