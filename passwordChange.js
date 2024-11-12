// Check if user is authenticated when the page loads
async function checkAuth() {
    const sessionToken = localStorage.getItem('sessionToken');
    const teacherId = localStorage.getItem('teacherId');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    if (!sessionToken || !teacherId) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const { data: session, error } = await window.supabase
            .from('active_sessions')
            .select('expires_at')
            .eq('session_token', sessionToken)
            .eq('teacher_id', teacherId)
            .single();

        if (error || !session || new Date(session.expires_at) <= new Date()) {
            clearSession();
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Auth check error:', error);
        clearSession();
        window.location.href = 'login.html';
    }
}

// Handle password change logic
async function changePassword(currentPassword, newPassword) {
    try {
        const teacherId = localStorage.getItem('teacherId');
        if (!teacherId) {
            throw new Error('Not authenticated');
        }

        // Get teacher username first
        const { data: teacher } = await window.supabase
            .from('teachers')
            .select('username')
            .eq('id', teacherId)
            .single();

        if (!teacher) {
            throw new Error('Teacher not found');
        }

        // Verify current password
        const { data: isValid, error: verifyError } = await window.supabase
            .rpc('verify_teacher_password', {
                input_username: teacher.username,
                input_password: currentPassword
            });

        if (verifyError || !isValid) {
            throw new Error('Current password is incorrect');
        }

        // Update password
        const { error: updateError } = await window.supabase
            .rpc('update_teacher_password', {
                teacher_id: teacherId,
                new_password: newPassword
            });

        if (updateError) {
            throw updateError;
        }

        return { success: true, message: 'Password updated successfully' };
    } catch (error) {
        console.error('Password change error:', error);
        return { success: false, message: error.message };
    }
}

// Handle logout functionality
async function handleLogout() {
    const sessionToken = localStorage.getItem('sessionToken');
    if (sessionToken) {
        try {
            await window.supabase
                .from('active_sessions')
                .delete()
                .eq('session_token', sessionToken);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    clearSession();
    window.location.href = 'login.html';
}

// Clear session data from localStorage
function clearSession() {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('teacherId');
    localStorage.removeItem('isAdmin');
}

// Show message to user
function showMessage(messageDiv, text, type) {
    if (messageDiv) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';

        if (type === 'success') {
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
        }
    }
}

// Initialize page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    checkAuth();

    // Get DOM elements
    const passwordForm = document.getElementById('passwordChangeForm');
    const messageDiv = document.getElementById('passwordChangeMessage');
    const logoutBtn = document.getElementById('logoutBtn');

    // Add logout button handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Add form submit handler
    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // Validate inputs
            if (!currentPassword || !newPassword || !confirmPassword) {
                showMessage(messageDiv, 'Please fill in all fields', 'error');
                return;
            }

            if (newPassword !== confirmPassword) {
                showMessage(messageDiv, 'New passwords do not match', 'error');
                return;
            }

            if (newPassword.length < 4) {
                showMessage(messageDiv, 'New password must be at least 4 characters', 'error');
                return;
            }

            // Attempt password change
            try {
                const result = await changePassword(currentPassword, newPassword);
                showMessage(messageDiv, result.message, result.success ? 'success' : 'error');

                if (result.success) {
                    passwordForm.reset();
                    
                    // Redirect after successful password change
                    setTimeout(() => {
                        const teacherId = localStorage.getItem('teacherId');
                        const isAdmin = localStorage.getItem('isAdmin') === 'true';
                        
                        if (isAdmin) {
                            window.location.href = 'adminAttendance.html';
                        } else {
                            window.location.href = `classOverview.html?teacher=${teacherId}`;
                        }
                    }, 2000);
                }
            } catch (error) {
                showMessage(messageDiv, 'Error changing password. Please try again.', 'error');
            }
        });
    }
});