(function() {
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        const teacherId = localStorage.getItem('teacherId');
        if (teacherId) {
            window.location.href = `classOverview.html?teacher=${teacherId}`;
        } else {
            window.location.href = 'login.html';
        }
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    checkAuth(true);  // true means this page requires admin access
});

async function checkAuth() {
    const sessionToken = localStorage.getItem('sessionToken');
    const teacherId = localStorage.getItem('teacherId');

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
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('teacherId');
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = 'login.html';
    }
}

// Call this when the page loads

async function loadTeachers() {
    const teacherButtonsContainer = document.getElementById('teacherButtons');

    try {
        const { data: teachers, error } = await window.supabase
            .from('teachers')
            .select('id, name')
            .order('name');

        if (error) {
            console.error('Error fetching teachers:', error);
            teacherButtonsContainer.innerHTML = '<p>Error loading teachers. Please try again later.</p>';
            return;
        }

        if (teachers.length === 0) {
            teacherButtonsContainer.innerHTML = '<p>No teachers found in the database.</p>';
            return;
        }

        teachers.forEach(teacher => {
            const button = document.createElement('a');
            button.href = `classOverview.html?teacher=${teacher.id}`;
            button.className = 'teacher-btn';
            button.textContent = teacher.name;
            teacherButtonsContainer.appendChild(button);
        });

        console.log(`Loaded ${teachers.length} teachers.`);
    } catch (error) {
        console.error('Unexpected error:', error);
        teacherButtonsContainer.innerHTML = '<p>An unexpected error occurred. Please try again later.</p>';
    }
}

// Call loadTeachers when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', loadTeachers);