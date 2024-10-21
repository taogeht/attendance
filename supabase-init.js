// supabase-init.js
const supabaseUrl = 'https://wuesdslilzpgzpkvxrpj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1ZXNkc2xpbHpwZ3pwa3Z4cnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjkzMTMzNDksImV4cCI6MjA0NDg4OTM0OX0.RvUkGZI6OQOoobvL_f5wNMzWdbKkkZCYwQ3FV4hHLBo';


// Initialize the Supabase client
const initSupabase = () => {
    window.supabase = supabase.createClient(supabaseUrl, supabaseKey);
    console.log('Supabase initialized');
};

// Run initialization when the script loads
initSupabase();