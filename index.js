(function() {
    // Check for admin status and redirect if necessary
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        const teacherId = localStorage.getItem('teacherId');
        if (teacherId) {
            window.location.href = `classOverview.html?teacher=${teacherId}`;
        } else {
            window.location.href = 'login.html';
        }
        return; // Add explicit return here
    }

    // Ensure supabase is initialized before proceeding
    function initApp() {
        if (typeof window.supabase === 'undefined') {
            console.log('Waiting for Supabase to initialize...');
            setTimeout(initApp, 100); // Wait and try again
            return;
        }

        // Once Supabase is ready, load teachers
        loadTeachers().catch(error => {
            console.error('Error in loadTeachers:', error);
        });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();


document.addEventListener('DOMContentLoaded', () => {
    checkAuth(true);  // true means this page requires admin access
});

async function checkAuth(requireAdmin = false) {
    console.log('Starting auth check...');
    
    const sessionToken = localStorage.getItem('sessionToken');
    const teacherId = localStorage.getItem('teacherId');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    if (!sessionToken || !teacherId) {
        console.log('No session token or teacher ID found');
        window.location.href = 'login.html';
        return false;
    }

    if (requireAdmin && !isAdmin) {
        console.log('Admin access required but user is not admin');
        window.location.href = `classOverview.html?teacher=${teacherId}`;
        return false;
    }

    try {
        // Check if supabase is initialized
        if (!window.supabase) {
            throw new Error('Supabase client is not initialized');
        }

        const { data: session, error } = await window.supabase
            .from('active_sessions')
            .select('expires_at')
            .eq('session_token', sessionToken)
            .eq('teacher_id', teacherId)
            .single();

        if (error) {
            throw error;
        }

        if (!session || new Date(session.expires_at) <= new Date()) {
            throw new Error('Session expired');
        }

        // Additional admin verification if required
        if (requireAdmin) {
            const { data: teacher, error: teacherError } = await window.supabase
                .from('teachers')
                .select('is_admin')
                .eq('id', teacherId)
                .single();

            if (teacherError || !teacher || !teacher.is_admin) {
                throw new Error('Admin verification failed');
            }
        }

        console.log('Auth check completed successfully');
        return true;

    } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('teacherId');
        localStorage.removeItem('isAdmin');
        window.location.href = 'login.html';
        return false;
    }
}
// Call this when the page loads

async function loadTeachers() {
    const teacherButtonsContainer = document.getElementById('teacherButtons');
    
    if (!teacherButtonsContainer) {
        console.error('Teacher buttons container not found');
        return;
    }

    try {
        console.log('Starting teacher data fetch...');
        
        // Check if supabase is properly initialized
        if (!window.supabase) {
            throw new Error('Supabase client is not initialized');
        }

        const { data: teachers, error } = await window.supabase
            .from('teachers')
            .select('id, name')
            .order('name');

        console.log('Teacher data fetched:', { teachers, error });

        if (error) {
            throw error;
        }

        if (!teachers || teachers.length === 0) {
            teacherButtonsContainer.innerHTML = '<p>No teachers found in the database.</p>';
            return;
        }

        // Clear existing content
        teacherButtonsContainer.innerHTML = '';

        // Create and append teacher buttons
        teachers.forEach(teacher => {
            const button = document.createElement('a');
            button.href = `classOverview.html?teacher=${teacher.id}`;
            button.className = 'teacher-btn';
            button.textContent = teacher.name;
            teacherButtonsContainer.appendChild(button);
        });

        console.log(`Successfully loaded ${teachers.length} teachers`);

    } catch (error) {
        console.error('Error loading teachers:', error);
        teacherButtonsContainer.innerHTML = `
            <p class="error-message">
                An error occurred while loading teachers. 
                Please try refreshing the page.
            </p>`;
    }
}

function waitForSupabase() {
    return new Promise((resolve, reject) => {
        const maxAttempts = 50; // 5 seconds maximum wait time
        let attempts = 0;
        
        function checkSupabase() {
            attempts++;
            if (typeof window.supabase !== 'undefined') {
                resolve();
            } else if (attempts >= maxAttempts) {
                reject(new Error('Supabase failed to initialize'));
            } else {
                setTimeout(checkSupabase, 100);
            }
        }
        
        checkSupabase();
    });
}


// Call loadTeachers when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', loadTeachers);