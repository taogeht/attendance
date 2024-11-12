// login.js
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const messageDiv = document.getElementById('message');

    // Check if there's already a valid session
    checkSession();

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim().toLowerCase(); // Convert to lowercase
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showMessage('Please enter both username and password', 'error');
            return;
        }

        try {
            // Step 1: Get teacher data and verify password
            const { data: teacherData, error: teacherError } = await window.supabase
                .from('teachers')
                .select('id, username, is_admin, name')
                .eq('username', username)
                .single();

            if (teacherError || !teacherData) {
                throw new Error('Invalid username or password');
            }

            // Step 2: Verify password using RPC function
            const { data: isValidPassword, error: verifyError } = await window.supabase
                .rpc('verify_teacher_password', {
                    input_username: username,
                    input_password: password
                });

            if (verifyError || !isValidPassword) {
                throw new Error('Invalid username or password');
            }

            // Step 3: Clear any existing sessions for this teacher
            await clearExistingSessions(teacherData.id);

            // Step 4: Create a new session
            const sessionToken = generateSessionToken();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

            const { data: sessionData, error: sessionError } = await window.supabase
                .from('active_sessions')
                .insert([{ 
                    teacher_id: teacherData.id,
                    session_token: sessionToken,
                    expires_at: expiresAt.toISOString()
                }])
                .select()
                .single();

            if (sessionError) throw sessionError;

            // Step 5: Store session information
            localStorage.setItem('sessionToken', sessionData.session_token);
            localStorage.setItem('teacherId', teacherData.id);
            localStorage.setItem('isAdmin', teacherData.is_admin);
            localStorage.setItem('teacherName', teacherData.name);

            // Step 6: Show success message
            showMessage('Login successful! Redirecting...', 'success');

            // Step 7: Redirect based on admin status with slight delay
            setTimeout(() => {
                if (teacherData.is_admin) {
                    window.location.href = 'adminAttendance.html';
                } else {
                    window.location.href = `classOverview.html?teacher=${teacherData.id}`;
                }
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            showMessage('Invalid username or password', 'error');
            // Clear password field on error
            document.getElementById('password').value = '';
        }
    });
});

async function checkSession() {
    const sessionToken = localStorage.getItem('sessionToken');
    const teacherId = localStorage.getItem('teacherId');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    if (sessionToken && teacherId) {
        try {
            // Verify session is still valid
            const { data: session, error } = await window.supabase
                .from('active_sessions')
                .select('expires_at')
                .eq('session_token', sessionToken)
                .eq('teacher_id', teacherId)
                .single();

            if (!error && session && new Date(session.expires_at) > new Date()) {
                // Verify admin status if needed
                if (isAdmin) {
                    const { data: teacher, error: teacherError } = await window.supabase
                        .from('teachers')
                        .select('is_admin')
                        .eq('id', teacherId)
                        .single();

                    if (teacherError || !teacher || !teacher.is_admin) {
                        clearSession();
                        return;
                    }
                }

                // Session is valid, redirect to appropriate page
                if (isAdmin) {
                    window.location.href = 'adminAttendance.html';
                } else {
                    window.location.href = `classOverview.html?teacher=${teacherId}`;
                }
            } else {
                // Session is invalid or expired, clear storage
                clearSession();
            }
        } catch (error) {
            console.error('Session check error:', error);
            clearSession();
        }
    }
}

async function clearExistingSessions(teacherId) {
    try {
        await window.supabase
            .from('active_sessions')
            .delete()
            .eq('teacher_id', teacherId);
    } catch (error) {
        console.error('Error clearing existing sessions:', error);
        // Continue with login process even if this fails
    }
}

function generateSessionToken() {
    // Generate a cryptographically secure random session token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
    }
}

function clearSession() {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('teacherId');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('teacherName');
}

// Helper function to check auth status (can be used in other pages)
async function checkAuth(requireAdmin = false) {
    const sessionToken = localStorage.getItem('sessionToken');
    const teacherId = localStorage.getItem('teacherId');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    if (!sessionToken || !teacherId) {
        window.location.href = 'login.html';
        return false;
    }

    if (requireAdmin && !isAdmin) {
        window.location.href = `classOverview.html?teacher=${teacherId}`;
        return false;
    }

    try {
        // Verify session is still valid
        const { data: session, error } = await window.supabase
            .from('active_sessions')
            .select('expires_at')
            .eq('session_token', sessionToken)
            .eq('teacher_id', teacherId)
            .single();

        if (error || !session || new Date(session.expires_at) <= new Date()) {
            clearSession();
            window.location.href = 'login.html';
            return false;
        }

        // Additional verification for admin status
        if (requireAdmin) {
            const { data: teacher, error: teacherError } = await window.supabase
                .from('teachers')
                .select('is_admin')
                .eq('id', teacherId)
                .single();

            if (teacherError || !teacher || !teacher.is_admin) {
                clearSession();
                window.location.href = 'login.html';
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        clearSession();
        window.location.href = 'login.html';
        return false;
    }
}

// Logout functionality
async function logout() {
    const sessionToken = localStorage.getItem('sessionToken');
    if (sessionToken) {
        try {
            // Remove session from database
            await window.supabase
                .from('active_sessions')
                .delete()
                .eq('session_token', sessionToken);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    // Clear all local storage
    clearSession();
    
    // Redirect to login page
    window.location.href = 'login.html';
}