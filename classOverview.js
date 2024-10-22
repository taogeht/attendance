// classOverview.js

let currentClass = null;
let selectedDate = new Date();
let currentWeekStart = new Date(selectedDate);

async function initializeApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const teacherId = urlParams.get('teacher');

    if (!teacherId) {
        console.error('No teacher ID provided');
        document.body.innerHTML = '<p>Error: No teacher selected. Please go back and select a teacher.</p>';
        return;
    }

    await loadTeacherInfo(teacherId);
    updateSelectedDateDisplay();
    updateCalendar();

    document.getElementById('selectAll').addEventListener('click', toggleSelectAll);
    document.getElementById('saveAttendance').addEventListener('click', saveAttendance);
    document.getElementById('prevWeek').addEventListener('click', () => changeWeek(-1));
    document.getElementById('nextWeek').addEventListener('click', () => changeWeek(1));
    document.getElementById('downloadMonthlyAttendance').addEventListener('click', downloadMonthlyAttendance);
}

async function loadTeacherInfo(teacherId) {
    try {
        // Fetch teacher information
        const { data: teacher, error: teacherError } = await window.supabase
            .from('teachers')
            .select('id, name')
            .eq('id', teacherId)
            .single();

        if (teacherError) throw teacherError;

        document.getElementById('teacherName').textContent = `${teacher.name}'s Classes`;

        // Fetch classes for this teacher
        const { data: classes, error: classesError } = await window.supabase
            .from('classes')
            .select('id, name')
            .eq('teacher_id', teacherId);

        if (classesError) throw classesError;

        if (classes && classes.length > 0) {
            createClassButtons(classes);
            await selectClass(classes[0].id); // Select the first class by default
        } else {
            document.getElementById('classButtons').innerHTML = '<p>No classes assigned to this teacher.</p>';
        }
    } catch (error) {
        console.error('Error loading teacher info:', error);
        document.getElementById('classButtons').innerHTML = '<p>Error loading teacher information. Please try again later.</p>';
    }
}

function createClassButtons(classes) {
    const classButtonsContainer = document.getElementById('classButtons');
    classButtonsContainer.innerHTML = ''; // Clear existing buttons
    
    classes.forEach(cls => {
        const button = document.createElement('button');
        button.textContent = cls.name;
        button.classList.add('class-btn');
        button.addEventListener('click', () => selectClass(cls.id));
        classButtonsContainer.appendChild(button);
    });
}

async function selectClass(classId) {
    currentClass = { id: classId };
    const { data, error } = await window.supabase
        .from('classes')
        .select('name')
        .eq('id', classId)
        .single();

    if (error) {
        console.error('Error fetching class name:', error);
        return;
    }

    currentClass.name = data.name;
    document.getElementById('selectedClass').textContent = `Students in ${currentClass.name}`;
    await loadStudents(classId);
    updateCalendar();
}

async function loadStudents(classId) {
    try {
        const { data: students, error } = await window.supabase
            .from('class_students')
            .select(`
                student_id,
                students (id, name)
            `)
            .eq('class_id', classId);

        if (error) throw error;

        const studentList = document.getElementById('studentList');
        studentList.innerHTML = '';

        if (students.length === 0) {
            studentList.innerHTML = '<li>No students assigned to this class.</li>';
            return;
        }

        students.forEach(student => {
            const li = document.createElement('li');
            li.innerHTML = `
                ${student.students.name}
                <input type="checkbox" class="absence-checkbox" data-student="${student.students.id}">
            `;
            studentList.appendChild(li);
        });

        await loadAttendance(classId, selectedDate);
    } catch (error) {
        console.error('Error loading students:', error);
        document.getElementById('studentList').innerHTML = '<li>Error loading students. Please try again later.</li>';
    }
}

async function loadAttendance(classId, date) {
    try {
        const { data: attendance, error } = await window.supabase
            .from('attendance_records')
            .select('student_id, is_present')
            .eq('class_id', classId)
            .eq('date', date.toISOString().split('T')[0]);

        if (error) throw error;

        const attendanceMap = new Map(attendance.map(record => [record.student_id, record.is_present]));
        const checkboxes = document.querySelectorAll('.absence-checkbox');

        checkboxes.forEach(checkbox => {
            const studentId = checkbox.dataset.student;
            checkbox.checked = attendanceMap.get(studentId) || false; // Checked if present, unchecked if absent or no record
        });
    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}

async function saveAttendance() {
    try {
        const checkboxes = document.querySelectorAll('.absence-checkbox');
        const attendanceRecords = Array.from(checkboxes).map(checkbox => ({
            class_id: currentClass.id,
            student_id: checkbox.dataset.student,
            date: selectedDate.toISOString().split('T')[0],
            is_present: checkbox.checked  // Changed: checked now means present
        }));

        // First, delete any existing records for this class and date
        const { error: deleteError } = await window.supabase
            .from('attendance_records')
            .delete()
            .eq('class_id', currentClass.id)
            .eq('date', selectedDate.toISOString().split('T')[0]);

        if (deleteError) throw deleteError;

        // Then insert the new records
        const { error: insertError } = await window.supabase
            .from('attendance_records')
            .insert(attendanceRecords);

        if (insertError) throw insertError;

        alert('Attendance saved successfully!');
    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('Error saving attendance. Please try again.');
    }
}

function updateSelectedDateDisplay() {
    document.getElementById('selectedDate').textContent = `Attendance for ${selectedDate.toLocaleDateString()}`;
}

function updateCalendar() {
    const weekCalendar = document.getElementById('weekCalendar');
    weekCalendar.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + i);
        const dayElement = document.createElement('div');
        dayElement.classList.add('calendar-day');
        if (date.toDateString() === new Date().toDateString()) {
            dayElement.classList.add('today');
        }
        if (date.toDateString() === selectedDate.toDateString()) {
            dayElement.classList.add('selected');
        }
        dayElement.textContent = date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
        dayElement.addEventListener('click', () => {
            selectedDate = new Date(date);
            updateSelectedDateDisplay();
            loadStudents(currentClass.id);
            updateCalendar();
        });
        weekCalendar.appendChild(dayElement);
    }
}

function changeWeek(direction) {
    currentWeekStart.setDate(currentWeekStart.getDate() + direction * 7);
    updateCalendar();
}

function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.absence-checkbox');
    const selectAllButton = document.getElementById('selectAll');
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);

    checkboxes.forEach(checkbox => {
        checkbox.checked = !allChecked;
    });

    selectAllButton.textContent = allChecked ? 'Select All' : 'Deselect All';
}

async function downloadMonthlyAttendance() {
    try {
        const currentDate = new Date(selectedDate);
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const startDate = firstDay.toISOString().split('T')[0];
        const endDate = lastDay.toISOString().split('T')[0];

        const { data: studentsData, error: studentsError } = await window.supabase
            .from('class_students')
            .select(`
                students (id, name)
            `)
            .eq('class_id', currentClass.id);

        if (studentsError) throw studentsError;

        const { data: attendanceData, error: attendanceError } = await window.supabase
            .from('attendance_records')
            .select('*')
            .eq('class_id', currentClass.id)
            .gte('date', startDate)
            .lte('date', endDate);

        if (attendanceError) throw attendanceError;

        const uniqueDates = [...new Set(attendanceData.map(record => record.date))].sort();

        // Create CSV header
        let csvContent = 'Student Name';
        uniqueDates.forEach(date => {
            csvContent += ',' + new Date(date).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit'
            });
        });
        csvContent += '\n';

        // Create attendance map for quick lookup
        const attendanceMap = new Map();
        attendanceData.forEach(record => {
            const key = `${record.student_id}-${record.date}`;
            attendanceMap.set(key, record.is_present);
        });

        // Add each student's attendance data
        studentsData.forEach(studentRecord => {
            const student = studentRecord.students;
            csvContent += student.name;
            
            uniqueDates.forEach(date => {
                const key = `${student.id}-${date}`;
                const isPresent = attendanceMap.get(key);
                csvContent += ',';
                if (isPresent === false || isPresent === undefined) { // Mark as X if absent or no record
                    csvContent += 'X';
                }
            });
            csvContent += '\n';
        });

        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const className = currentClass.name.replace(/\s+/g, '_');
        
        link.href = window.URL.createObjectURL(blob);
        link.download = `${className}_attendance_${monthYear}.csv`;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('Error downloading attendance:', error);
        alert('Error downloading attendance. Please try again.');
    }
}

// Initialize the app when the DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}