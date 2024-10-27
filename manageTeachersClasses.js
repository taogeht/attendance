// manageTeachersClasses.js

// State management
let currentTeacher = null;
let teachers = [];
let classes = [];

// Initialize the application
async function initializeApp() {
    try {
        if (typeof window.supabase === 'undefined') {
            throw new Error('Supabase is not initialized');
        }

        setupEventListeners();
        await reloadAllData();
        await verifyNoOrphanedClasses(); // Add verification check
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
    }
}

// Set up event listeners for the page
function setupEventListeners() {
    // Existing event listeners for forms
    const addTeacherForm = document.getElementById('addTeacherForm');
    if (addTeacherForm) {
        addTeacherForm.addEventListener('submit', handleAddTeacher);
    }

    const addClassForm = document.getElementById('addClassForm');
    if (addClassForm) {
        addClassForm.addEventListener('submit', handleAddClass);
    }

    // Teacher selection change handler
    const teacherSelect = document.getElementById('teacherSelect');
    if (teacherSelect) {
        teacherSelect.addEventListener('change', async (e) => {
            const selectedTeacherId = e.target.value;
            if (selectedTeacherId) {
                await loadClasses(selectedTeacherId);
            } else {
                const classList = document.getElementById('classList');
                if (classList) {
                    classList.innerHTML = '<p>Please select a teacher to view their classes.</p>';
                }
            }
        });
    }

    // Update the delete button event listeners
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-teacher-btn')) {
            const teacherId = e.target.dataset.teacherId;
            await handleDeleteTeacher(teacherId);
        }
        
        // Updated class delete button handler
        if (e.target.classList.contains('delete-class-btn')) {
            const classId = e.target.dataset.classId;
            if (classId) {
                await handleDeleteClass(classId);
            } else {
                console.error('No class ID found on delete button');
            }
        }
    });
}

// Load all teachers from the database
async function loadTeachers() {
    try {
        const { data, error } = await window.supabase
            .from('teachers')
            .select('*')
            .order('name');

        if (error) throw error;

        teachers = data;
        displayTeachers(data);
    } catch (error) {
        console.error('Error loading teachers:', error);
        showError('Failed to load teachers');
    }
}

// Load all classes for a specific teacher
async function loadClasses(teacherId) {
    const classList = document.getElementById('classList');
    if (classList) {
        classList.innerHTML = '<p>Loading classes...</p>';
    }

    try {
        currentTeacher = teacherId;
        
        const { data: teacher } = await window.supabase
            .from('teachers')
            .select('name')
            .eq('id', teacherId)
            .single();

        const { data, error } = await window.supabase
            .from('classes')
            .select('*')
            .eq('teacher_id', teacherId)
            .order('name');

        if (error) throw error;

        classes = data;
        displayClasses(data, teacher?.name);
    } catch (error) {
        console.error('Error loading classes:', error);
        showError('Failed to load classes');
        if (classList) {
            classList.innerHTML = '<p>Error loading classes. Please try again.</p>';
        }
    }
}


// Handle adding a new teacher
async function handleAddTeacher(e) {
    e.preventDefault();
    
    const teacherName = document.getElementById('teacherName').value.trim();
    if (!teacherName) {
        showError('Please enter a teacher name');
        return;
    }

    try {
        const { data, error } = await window.supabase
            .from('teachers')
            .insert([{ name: teacherName }])
            .select();

        if (error) throw error;

        await loadTeachers();
        e.target.reset();
        showSuccess('Teacher added successfully');
    } catch (error) {
        console.error('Error adding teacher:', error);
        showError('Failed to add teacher');
    }
}

// Handle adding a new class
async function handleAddClass(e) {
    e.preventDefault();
    
    const classNameInput = document.getElementById('className');
    const teacherSelect = document.getElementById('teacherSelect');
    
    if (!classNameInput || !teacherSelect) {
        console.error('Required form elements not found');
        showError('Form elements not found. Please check the implementation.');
        return;
    }

    const className = classNameInput.value.trim();
    const teacherId = teacherSelect.value;
    
    if (!className || !teacherId) {
        showError('Please fill in all fields');
        return;
    }

    try {
        const { data, error } = await window.supabase
            .from('classes')
            .insert([{ 
                name: className,
                teacher_id: teacherId 
            }])
            .select();

        if (error) throw error;

        await loadClasses(teacherId);
        classNameInput.value = ''; // Reset just the class name input
        showSuccess('Class added successfully');
    } catch (error) {
        console.error('Error adding class:', error);
        showError('Failed to add class');
    }
}

// Handle deleting a teacher
async function handleDeleteTeacher(teacherId) {
    if (!confirm('Are you sure you want to delete this teacher? This will also delete all associated classes.')) {
        return;
    }

    try {
        // Start a transaction by using an async function
        const deleteTeacherAndClasses = async () => {
            // First, get all classes for this teacher
            const { data: classesToDelete, error: classesError } = await window.supabase
                .from('classes')
                .select('id')
                .eq('teacher_id', teacherId);

            if (classesError) throw classesError;

            // If there are classes, delete related records first
            if (classesToDelete && classesToDelete.length > 0) {
                const classIds = classesToDelete.map(c => c.id);

                // Delete attendance records
                const { error: attendanceError } = await window.supabase
                    .from('attendance_records')
                    .delete()
                    .in('class_id', classIds);

                if (attendanceError) throw attendanceError;

                // Delete student assignments
                const { error: studentAssignmentError } = await window.supabase
                    .from('class_students')
                    .delete()
                    .in('class_id', classIds);

                if (studentAssignmentError) throw studentAssignmentError;

                // Delete the classes
                const { error: classesDeleteError } = await window.supabase
                    .from('classes')
                    .delete()
                    .eq('teacher_id', teacherId);

                if (classesDeleteError) throw classesDeleteError;
            }

            // Finally delete the teacher
            const { error: teacherDeleteError } = await window.supabase
                .from('teachers')
                .delete()
                .eq('id', teacherId);

            if (teacherDeleteError) throw teacherDeleteError;
        };

        // Execute all deletions
        await deleteTeacherAndClasses();

        // Update UI
        const teacherSelect = document.getElementById('teacherSelect');
        if (teacherSelect && teacherSelect.value === teacherId) {
            const classList = document.getElementById('classList');
            if (classList) {
                classList.innerHTML = '<p>Please select a teacher to view their classes.</p>';
            }
            teacherSelect.value = ''; // Reset the teacher selection
        }

        await loadTeachers();
        showSuccess('Teacher and associated classes deleted successfully');
    } catch (error) {
        console.error('Error during deletion:', error);
        showError('Failed to delete teacher and associated data. Please try again.');
        
        // Reload data to ensure UI is in sync
        await loadTeachers();
        if (currentTeacher) {
            await loadClasses(currentTeacher);
        }
    }
}

// Handle deleting a class
async function handleDeleteClass(classId) {
    if (!confirm('Are you sure you want to delete this class?')) {
        return;
    }

    try {
        // First delete any attendance records for this class
        const { error: attendanceDeleteError } = await window.supabase
            .from('attendance_records')
            .delete()
            .eq('class_id', classId);

        if (attendanceDeleteError) throw attendanceDeleteError;

        // Then delete any student assignments for this class
        const { error: studentAssignmentDeleteError } = await window.supabase
            .from('class_students')
            .delete()
            .eq('class_id', classId);

        if (studentAssignmentDeleteError) throw studentAssignmentDeleteError;

        // Finally delete the class itself
        const { error: classDeleteError } = await window.supabase
            .from('classes')
            .delete()
            .eq('id', classId);

        if (classDeleteError) throw classDeleteError;

        // Reload the class list
        if (currentTeacher) {
            await loadClasses(currentTeacher);
        }
        showSuccess('Class deleted successfully');
    } catch (error) {
        console.error('Error deleting class:', error);
        showError('Failed to delete class. Error: ' + error.message);
        
        // Reload classes to ensure UI is in sync with database
        if (currentTeacher) {
            await loadClasses(currentTeacher);
        }
    }
}
// Display teachers in the UI
function displayTeachers(teachers) {
    const teacherList = document.getElementById('teacherList');
    const teacherSelect = document.getElementById('teacherSelect');
    
    if (teacherList) {
        teacherList.innerHTML = teachers.map(teacher => `
            <div class="list-item">
                <span>${teacher.name}</span>
                <button class="delete-btn delete-teacher-btn" data-teacher-id="${teacher.id}">Delete</button>
            </div>
        `).join('');
    }

    if (teacherSelect) {
        const currentSelection = teacherSelect.value; // Store current selection
        teacherSelect.innerHTML = `
            <option value="">Select a teacher</option>
            ${teachers.map(teacher => `
                <option value="${teacher.id}" ${teacher.id === currentSelection ? 'selected' : ''}>
                    ${teacher.name}
                </option>
            `).join('')}
        `;
        
        // If there was a selection, reload their classes
        if (currentSelection) {
            loadClasses(currentSelection);
        }
    }
}


// Display classes in the UI
function displayClasses(classes, teacherName) {
    const classList = document.getElementById('classList');
    if (classList) {
        let html = `<h3>Classes for ${teacherName || 'Selected Teacher'}</h3>`;
        
        if (classes.length === 0) {
            html += '<p>No classes found for this teacher.</p>';
        } else {
            html += '<div class="class-list">';
            html += classes.map(cls => `
                <div class="list-item">
                    <span>${cls.name}</span>
                    <button class="delete-btn delete-class-btn" data-class-id="${cls.id}">Delete</button>
                </div>
            `).join('');
            html += '</div>';
        }
        
        classList.innerHTML = html;
    }
}

async function verifyNoOrphanedClasses() {
    try {
        const { data: orphanedClasses, error } = await window.supabase
            .from('classes')
            .select('id, name, teacher_id')
            .is('teacher_id', null);

        if (error) {
            console.error('Error checking for orphaned classes:', error);
            return;
        }

        if (orphanedClasses && orphanedClasses.length > 0) {
            console.error('Found orphaned classes:', orphanedClasses);
            // Attempt to clean up orphaned classes
            const { error: cleanupError } = await window.supabase
                .from('classes')
                .delete()
                .is('teacher_id', null);

            if (cleanupError) {
                console.error('Error cleaning up orphaned classes:', cleanupError);
            }
        }
    } catch (error) {
        console.error('Error in verification:', error);
    }
}

function elementExists(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Element with id '${id}' not found`);
        return false;
    }
    return true;
}

// Reload all data
async function reloadAllData() {
    await loadTeachers();
    if (currentTeacher) {
        await loadClasses(currentTeacher);
    }
}

// Utility functions for showing success/error messages
function showSuccess(message) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.className = 'success-message';
        messageDiv.textContent = message;
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = '';
        }, 3000);
    }
}

function showError(message) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.className = 'error-message';
        messageDiv.textContent = message;
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = '';
        }, 3000);
    }
}

// Initialize the app when the DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}