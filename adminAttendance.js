let selectedDate = new Date();
let currentWeekStart = getWeekStart(new Date());
let classes = [];

async function initializeApp() {
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase is not initialized');
        return;
    }

    // Initialize calendar
    initializeCalendar();
    updateSelectedDateDisplay();
    await loadAllClasses();
    
    // Set up date change handler
    window.onDateChange = async (date) => {
        selectedDate = date;
        updateSelectedDateDisplay();
        await loadAttendanceForAllClasses();
    };
}

async function loadAllClasses() {
    try {
        // Fetch all classes with teacher information
        const { data, error } = await window.supabase
            .from('classes')
            .select(`
                id,
                name,
                teacher_id,
                teachers (
                    name
                )
            `)
            .order('name');

        if (error) throw error;

        classes = data;
        displayClasses();
        await loadAttendanceForAllClasses();
    } catch (error) {
        console.error('Error loading classes:', error);
    }
}

async function loadAttendanceForAllClasses() {
    for (const cls of classes) {
        try {
            // Load students for this class
            const { data: students, error: studentError } = await window.supabase
                .from('class_students')
                .select(`
                    student_id,
                    students (id, name)
                `)
                .eq('class_id', cls.id);

            if (studentError) throw studentError;

            // Load attendance for this class on selected date
            const { data: attendance, error: attendanceError } = await window.supabase
                .from('attendance_records')
                .select('student_id, is_present')
                .eq('class_id', cls.id)
                .eq('date', selectedDate.toISOString().split('T')[0]);

            if (attendanceError) throw attendanceError;

            // Update UI with attendance data
            updateClassAttendance(cls.id, students, attendance);
        } catch (error) {
            console.error(`Error loading data for class ${cls.name}:`, error);
        }
    }
}

function displayClasses() {
    const classesGrid = document.getElementById('classesGrid');
    classesGrid.innerHTML = '';

    classes.forEach(cls => {
        const classSection = document.createElement('div');
        classSection.className = 'class-section section';
        classSection.innerHTML = `
            <h3>${cls.name} - ${cls.teachers.name}</h3>
            <div class="attendance-summary" id="summary-${cls.id}">
                <span class="present">Present: 0</span>
                <span class="absent">Absent: 0</span>
                <span class="total">Total: 0</span>
            </div>
            <div class="student-list-container">
                <ul id="studentList-${cls.id}" class="student-list">
                    <li>Loading students...</li>
                </ul>
            </div>
        `;
        classesGrid.appendChild(classSection);
    });
}

function updateClassAttendance(classId, students, attendance) {
    const studentList = document.getElementById(`studentList-${classId}`);
    const summary = document.getElementById(`summary-${classId}`);
    
    if (!studentList || !summary) return;

    // Create attendance map
    const attendanceMap = new Map(attendance.map(record => [record.student_id, record.is_present]));
    
    // Update student list
    studentList.innerHTML = students.map(student => {
        const isPresent = attendanceMap.get(student.student_id) ?? null;
        const statusClass = isPresent === true ? 'present' : 
                          isPresent === false ? 'absent' : 'no-record';
        return `
            <li class="student-item ${statusClass}">
                <span>${student.students.name}</span>
                <span class="attendance-status">${
                    isPresent === true ? '✓' :
                    isPresent === false ? '✗' : '-'
                }</span>
            </li>
        `;
    }).join('');

    // Update summary
    const present = attendance.filter(a => a.is_present).length;
    const absent = attendance.filter(a => !a.is_present).length;
    const total = students.length;

    summary.innerHTML = `
        <span class="present">Present: ${present}</span>
        <span class="absent">Absent: ${absent}</span>
        <span class="total">Total: ${total}</span>
    `;
}
function initializeCalendar() {
    const weekCalendar = document.getElementById('weekCalendar');
    const calendarNavigation = document.getElementById('calendarNavigation');
    
    // Add event listeners for navigation buttons
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    document.getElementById('prevWeek').addEventListener('click', () => changeWeek(-1));
    document.getElementById('nextWeek').addEventListener('click', () => changeWeek(1));
    document.getElementById('todayBtn').addEventListener('click', goToToday);

    // Initial render
    updateCalendarDisplay();
}


function updateCalendarDisplay() {
    const weekCalendar = document.getElementById('weekCalendar');
    weekCalendar.innerHTML = '';

    // Create calendar days directly without the header row
    const daysContainer = document.createElement('div');
    daysContainer.className = 'calendar-days';
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + i);
        
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        if (isToday(date)) {
            dayElement.classList.add('today');
        }
        if (isSameDate(date, selectedDate)) {
            dayElement.classList.add('selected');
        }
        if (!isCurrentMonth(date)) {
            dayElement.classList.add('other-month');
        }

        // Include weekday abbreviation in the date text
        dayElement.innerHTML = `
            <span class="date-text">${date.toLocaleDateString('en-US', { 
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            })}</span>
        `;

        dayElement.addEventListener('click', () => selectDate(date));
        daysContainer.appendChild(dayElement);
    }
    weekCalendar.appendChild(daysContainer);
}


function updateSelectedDateDisplay() {
    const monthYearDisplay = document.getElementById('monthYearDisplay');
    monthYearDisplay.textContent = selectedDate.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}
function changeMonth(direction) {
    currentWeekStart.setMonth(currentWeekStart.getMonth() + direction);
    currentWeekStart = getWeekStart(currentWeekStart);
    updateCalendarDisplay();
    if (typeof onDateChange === 'function') {
        onDateChange(selectedDate);
    }
}

function changeWeek(direction) {
    currentWeekStart.setDate(currentWeekStart.getDate() + (direction * 7));
    updateCalendarDisplay();
    if (typeof onDateChange === 'function') {
        onDateChange(selectedDate);
    }
}

function goToToday() {
    const today = new Date();
    currentWeekStart = getWeekStart(today);
    selectedDate = today;
    updateCalendarDisplay();
    if (typeof onDateChange === 'function') {
        onDateChange(selectedDate);
    }
}

function selectDate(date) {
    selectedDate = date;
    updateCalendarDisplay();
    if (typeof onDateChange === 'function') {
        onDateChange(selectedDate);
    }
}

function isToday(date) {
    const today = new Date();
    return isSameDate(date, today);
}

function isSameDate(date1, date2) {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
}

function isCurrentMonth(date) {
    const currentMonth = currentWeekStart.getMonth();
    return date.getMonth() === currentMonth;
}

function getWeekStart(date) {
    const newDate = new Date(date);
    const day = newDate.getDay();
    const diff = newDate.getDate() - day;
    newDate.setDate(diff);
    return newDate;
}


// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}