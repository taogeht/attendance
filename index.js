// index.js

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