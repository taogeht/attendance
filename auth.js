// auth.js
async function checkAuth(requireAdmin = false) {
    const sessionToken = localStorage.getItem('sessionToken');
    const teacherId = localStorage.getItem('teacherId');
    const isAdmin = localStorage.getItem('isAdmin') === 'true'; // Convert string to boolean

    // First check if user is logged in at all
    if (!sessionToken || !teacherId) {
        window.location.href = 'login.html';
        return false;
    }

    // If page requires admin access and user is not admin, redirect to their class overview
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

        // Add an additional check to verify admin status from database
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