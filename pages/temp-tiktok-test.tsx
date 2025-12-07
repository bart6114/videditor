export default function TempTikTokTest() {
  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>TikTok OAuth Debug</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Minimal test page - no auth, no database, just OAuth debugging
      </p>

      <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3 style={{ marginTop: 0 }}>Before testing:</h3>
        <ol style={{ paddingLeft: '20px' }}>
          <li>Go to TikTok Developer Console</li>
          <li>Add this redirect URI:<br/>
            <code style={{ background: '#fff', padding: '4px 8px', display: 'inline-block', marginTop: '8px' }}>
              [YOUR_NGROK_URL]/api/v1/social/tiktok/temp-callback
            </code>
          </li>
          <li>Click the button below</li>
          <li>After authorizing, you&apos;ll see JSON with full debug info</li>
        </ol>
      </div>

      <a
        href="/api/v1/social/tiktok/temp-connect"
        style={{
          display: 'inline-block',
          background: '#000',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 'bold',
        }}
      >
        Connect TikTok (Debug)
      </a>

      <div style={{ marginTop: '40px', fontSize: '14px', color: '#999' }}>
        <p><strong>What this tests:</strong></p>
        <ul>
          <li>OAuth authorization redirect</li>
          <li>Token exchange with TikTok API</li>
          <li>User info fetch (if token works)</li>
        </ul>
        <p>All results are returned as JSON - check the response for errors.</p>
      </div>
    </div>
  );
}
