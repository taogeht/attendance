// scheduleTeacherManager.js

async function initializeTeacherManager() {
    if (!window.supabase) {
        console.error('Supabase client is not initialized');
        showError('System initialization error');
        return;
    }

    try {
        // Check authentication first
        const isAuthenticated = await checkAuth(true); // Require admin access
        if (!isAuthenticated) return;

        await loadTeachers();
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing teacher manager:', error);
        showError('Failed to initialize teacher manager');
    }
}


async function loadTeachers() {
    showLoading();
    try {
        const { data: teachers, error } = await window.supabase
            .from('schedule_teachers')
            .select('*')
            .order('name');

        if (error) throw error;

        renderTeacherList(teachers);
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('Error loading teachers:', error);
        showError('Failed to load teachers');
    }
}

// Utility functions for loading state
function showLoading() {
    const teacherList = document.getElementById('teacherList');
    if (teacherList) {
        teacherList.innerHTML = '<div class="loading">Loading teachers...</div>';
    }
}

function hideLoading() {
    const loadingElement = document.querySelector('.loading');
    if (loadingElement) {
        loadingElement.remove();
    }
}

// Utility functions for messages
function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}-message`;
        messageDiv.style.display = 'block';

        // Hide message after 3 seconds
        setTimeout(() => {
            messageDiv.style.display = 'none';
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 3000);
    }
}

function showError(message) {
    showMessage(message, 'error');
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function renderTeacherList(teachers) {
    const teacherList = document.getElementById('teacherList');
    if (!teacherList) return;

    if (teachers.length === 0) {
        teacherList.innerHTML = '<div class="no-teachers">No teachers found. Add a teacher to get started.</div>';
        return;
    }

    const html = teachers.map(teacher => `
        <div class="teacher-item" data-id="${teacher.id}">
            <div class="teacher-info">
                <span class="teacher-name">${teacher.name}</span>
                <div class="teacher-preferences">
                    <label class="checkbox-label">
                        <input type="checkbox" class="teaches-morning" 
                               ${teacher.teaches_morning ? 'checked' : ''}
                               data-id="${teacher.id}">
                        Morning
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="teaches-afternoon"
                               ${teacher.teaches_afternoon ? 'checked' : ''}
                               data-id="${teacher.id}">
                        Afternoon
                    </label>
                    <select class="max-classes" data-id="${teacher.id}">
                        ${[1,2,3,4,5,6].map(num => `
                            <option value="${num}" ${teacher.max_classes_per_day === num ? 'selected' : ''}>
                                ${num} class${num > 1 ? 'es' : ''} max
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
            <button class="delete-teacher" data-id="${teacher.id}" title="Delete teacher">×</button>
        </div>
    `).join('');

    teacherList.innerHTML = html;
}

function setupEventListeners() {
    // Add new teacher
    const addTeacherForm = document.getElementById('addTeacherForm');
    if (addTeacherForm) {
        addTeacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('teacherName');
            const name = nameInput.value.trim();
            
            if (name) {
                await addTeacher(name);
                nameInput.value = '';
            } else {
                showError('Please enter a teacher name');
            }
        });
    }

    // Handle teacher list events using delegation
    const teacherList = document.getElementById('teacherList');
    if (teacherList) {
        teacherList.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-teacher')) {
                const teacherId = e.target.dataset.id;
                await deleteTeacher(teacherId);
            }
        });

        teacherList.addEventListener('change', async (e) => {
            const teacherId = e.target.dataset.id;
            if (!teacherId) return;

            if (e.target.classList.contains('teaches-morning')) {
                await updateTeacherPreference(teacherId, 'teaches_morning', e.target.checked);
            }
            else if (e.target.classList.contains('teaches-afternoon')) {
                await updateTeacherPreference(teacherId, 'teaches_afternoon', e.target.checked);
            }
            else if (e.target.classList.contains('max-classes')) {
                await updateTeacherPreference(teacherId, 'max_classes_per_day', parseInt(e.target.value));
            }
        });
    }
}

async function addTeacher(name) {
    try {
        const { data, error } = await window.supabase
            .from('schedule_teachers')
            .insert([{ 
                name,
                teaches_morning: true,
                teaches_afternoon: true,
                max_classes_per_day: 3
            }]);

        if (error) throw error;

        await loadTeachers();
        showSuccess('Teacher added successfully');
    } catch (error) {
        console.error('Error adding teacher:', error);
        showError('Failed to add teacher');
    }
}

async function deleteTeacher(teacherId) {
    if (!confirm('Are you sure you want to delete this teacher?')) return;

    try {
        const { error } = await window.supabase
            .from('schedule_teachers')
            .delete()
            .eq('id', teacherId);

        if (error) throw error;

        await loadTeachers();
        showSuccess('Teacher deleted successfully');
    } catch (error) {
        console.error('Error deleting teacher:', error);
        showError('Failed to delete teacher');
    }
}

async function updateTeacherPreference(teacherId, field, value) {
    try {
        const { error } = await window.supabase
            .from('schedule_teachers')
            .update({ [field]: value })
            .eq('id', teacherId);

        if (error) throw error;

        showSuccess('Preference updated successfully');
    } catch (error) {
        console.error('Error updating preference:', error);
        showError('Failed to update preference');
        await loadTeachers(); // Reload to reset UI state
    }
}

// Initialize when DOM is loaded and Supabase is ready
function initialize() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Short delay to ensure Supabase is initialized
            setTimeout(initializeTeacherManager, 100);
        });
    } else {
        setTimeout(initializeTeacherManager, 100);
    }
}

initialize();