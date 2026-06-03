// api-keys.js — Public keys + backend URL
// Các key bí mật (OpenWeather, GNews) chỉ lưu trên server (file .env)
window.EcoLensApiKeys = {
  SUPABASE_URL: 'https://bbpmkmmmsqurszpnvsba.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicG1rbW1tc3F1cnN6cG52c2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODAxMDAsImV4cCI6MjA5NjA1NjEwMH0.xmqP2dZ2O4G9RONrmSdk4GG5_7aXPa4C2maePw3rNIE',
  // Đổi URL này thành backend của bạn sau khi deploy
  BACKEND_URL: window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://ecolens-backend-0w25.onrender.com',
};
