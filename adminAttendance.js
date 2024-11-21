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

let selectedDate = new Date();
let currentWeekStart = getWeekStart(new Date());
let classes = [];

document.addEventListener('DOMContentLoaded', () => {
    checkAuth(true);  // Explicitly require admin access
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


async function initializeApp() {
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase is not initialized');
        return;
    }

    try {
        // Initialize calendar
        await initializeCalendar();
        updateSelectedDateDisplay();
        await loadAllClasses();
        
        // Set up date change handler
        window.onDateChange = async (date) => {
            selectedDate = date;
            updateSelectedDateDisplay();
            await loadAttendanceForAllClasses();
        };
    } catch (error) {
        console.error('Error initializing app:', error);
        console.log(error.stack); // Add this to get more error details
    }
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
            const { data: students, error: studentError } = await window.supabase
                .from('class_students')
                .select(`
                    student_id,
                    students (id, name)
                `)
                .eq('class_id', cls.id);

            if (studentError) throw studentError;

            // Use local date string instead of ISO string
            const dateStr = getLocalDateString(selectedDate);

            const { data: attendance, error: attendanceError } = await window.supabase
                .from('attendance_records')
                .select('student_id, is_present')
                .eq('class_id', cls.id)
                .eq('date', dateStr);

            if (attendanceError) throw attendanceError;

            updateClassAttendance(cls.id, students, attendance);
        } catch (error) {
            console.error(`Error loading data for class ${cls.name}:`, error);
        }
    }
}



async function displayClasses() {
    const classSelect = document.getElementById('classSelect');
    if (!classSelect) return;

    // Sort classes by name
    classes.sort((a, b) => a.name.localeCompare(b.name));

    // Clear existing options except the first one
    classSelect.innerHTML = '<option value="">Select a class...</option>';

    // Add classes to dropdown
    classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.id;
        option.textContent = `${cls.name} - ${cls.teachers.name}`;
        classSelect.appendChild(option);
    });

    // Add change event listener
    classSelect.addEventListener('change', async function() {
        const selectedClassId = this.value;
        if (selectedClassId) {
            await displaySelectedClassDetails(selectedClassId);
        } else {
            // Hide details when no class is selected
            document.getElementById('selectedClassDetails').innerHTML = '';
        }
    });
}

async function displaySelectedClassDetails(classId) {
    const selectedClass = classes.find(cls => cls.id === classId);
    const detailsContainer = document.getElementById('selectedClassDetails');
    
    if (!selectedClass || !detailsContainer) return;

    detailsContainer.innerHTML = `
        <div class="class-info">
            <h3>${selectedClass.name}</h3>
            <div class="teacher-name">${selectedClass.teachers.name}</div>
            <div class="attendance-summary" id="summary-${classId}">
                <span class="present">Present: 0</span>
                <span class="absent">Absent: 0</span>
                <span class="total">Total: 0</span>
            </div>
        </div>
        <div class="student-list-container">
            <ul id="studentList-${classId}" class="student-list">
                <li>Loading students...</li>
            </ul>
        </div>
        <div class="download-section">
            <button class="download-btn" onclick="downloadMonthlyAttendance('${classId}', '${selectedClass.name}')">
                Download Attendance
            </button>
        </div>
    `;

    // Load student data and attendance
    await loadStudentsForClass(classId);
}

async function loadStudentsForClass(classId) {
    const studentList = document.getElementById(`studentList-${classId}`);
    const summary = document.getElementById(`summary-${classId}`);
    
    if (!studentList || !summary) return;

    try {
        const { data: students, error: studentError } = await window.supabase
            .from('class_students')
            .select(`
                student_id,
                students (id, name)
            `)
            .eq('class_id', classId);

        if (studentError) throw studentError;

        const dateStr = getLocalDateString(selectedDate);

        const { data: attendance, error: attendanceError } = await window.supabase
            .from('attendance_records')
            .select('student_id, is_present')
            .eq('class_id', classId)
            .eq('date', dateStr);

        if (attendanceError) throw attendanceError;

        updateClassAttendance(classId, students, attendance);
    } catch (error) {
        console.error(`Error loading students for class ${classId}:`, error);
        studentList.innerHTML = '<li class="error">Error loading students</li>';
    }
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
    const calendarNavigation = document.getElementById('calendarNavigation');
    if (!calendarNavigation) {
        console.error('Calendar navigation element not found');
        return;
    }
    
    // Update navigation buttons
    calendarNavigation.innerHTML = `
        <button id="prevMonth" class="calendar-nav-btn">&lt; Previous Month</button>
        <button id="nextMonth" class="calendar-nav-btn">Next Month &gt;</button>
    `;

    // Add month/year display
    let monthYearDisplay = document.getElementById('monthYearDisplay');
    if (!monthYearDisplay) {
        monthYearDisplay = document.createElement('div');
        monthYearDisplay.id = 'monthYearDisplay';
        monthYearDisplay.className = 'month-year-display';
        const weekCalendar = document.getElementById('weekCalendar');
        if (weekCalendar) {
            weekCalendar.parentNode.insertBefore(monthYearDisplay, weekCalendar);
        }
    }

    // Add event listeners for navigation
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    }
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => changeMonth(1));
    }

    // Initial calendar render
    updateCalendarDisplay();
}



function updateCalendarDisplay() {
    const weekCalendar = document.getElementById('weekCalendar');
    if (!weekCalendar) return;

    weekCalendar.innerHTML = '';

    // Create header for days of week
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const headerRow = document.createElement('div');
    headerRow.className = 'calendar-header';

    daysOfWeek.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-header-cell';
        dayHeader.textContent = day;
        headerRow.appendChild(dayHeader);
    });
    weekCalendar.appendChild(headerRow);

    // Create grid for days
    const daysGrid = document.createElement('div');
    daysGrid.className = 'calendar-grid';

    // Get the first day of the month and total days
    const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();

    // Add empty cells for days before the first of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        daysGrid.appendChild(emptyDay);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        if (isToday(date)) {
            dayElement.classList.add('today');
        }
        if (isSameDate(date, selectedDate)) {
            dayElement.classList.add('selected');
        }

        const dateContent = document.createElement('div');
        dateContent.className = 'date-content';
        dateContent.innerHTML = `<span class="date-number">${day}</span>`;

        dayElement.appendChild(dateContent);
        dayElement.addEventListener('click', () => selectDate(date));
        daysGrid.appendChild(dayElement);
    }

    // Fill in remaining days
    const remainingDays = 42 - (firstDayOfWeek + daysInMonth);
    for (let i = 1; i <= remainingDays; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        daysGrid.appendChild(emptyDay);
    }

    weekCalendar.appendChild(daysGrid);
}

function updateSelectedDateDisplay() {
    const monthYearDisplay = document.getElementById('monthYearDisplay');
    if (monthYearDisplay) {
        // Ensure we're working with a Date object
        const date = new Date(selectedDate);
        monthYearDisplay.textContent = date.toLocaleDateString('en-US', { 
            month: 'long',
            year: 'numeric'
        });
    }
}
function changeMonth(direction) {
    // Ensure we're working with a Date object
    selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + direction, 1);
    updateCalendarDisplay();
    if (typeof onDateChange === 'function') {
        onDateChange(selectedDate);
    }
}

function getLocalDateString(date) {
    // Get year, month, and day in local timezone
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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

function formatDateForDB(date) {
    // Ensure we're working with a Date object
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

function selectDate(date) {
    selectedDate = date;
    updateCalendarDisplay();
    if (typeof onDateChange === 'function') {
        onDateChange(selectedDate);
    }
}

function isToday(date) {
    // Ensure we're working with Date objects
    const today = new Date();
    return isSameDate(new Date(date), today);
}

function isSameDate(date1, date2) {
    // Ensure we're working with Date objects
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
}

function isCurrentMonth(date) {
    const currentMonth = currentWeekStart.getMonth();
    return date.getMonth() === currentMonth;
}

function getWeekStart(date) {
    const newDate = new Date(date);
    // Get the day of the week (0-6, where 0 is Sunday)
    const day = newDate.getDay();
    // Subtract the current day to get to Sunday
    newDate.setDate(newDate.getDate() - day);
    return newDate;
}
async function downloadMonthlyAttendance(classId, className) {
    try {
        const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

        const startDate = getLocalDateString(firstDay);
        const endDate = getLocalDateString(lastDay);

        // Fetch students for this class
        const { data: studentsData, error: studentsError } = await window.supabase
            .from('class_students')
            .select(`
                students (id, name)
            `)
            .eq('class_id', classId);

        if (studentsError) throw studentsError;

        // Fetch attendance records for the month
        const { data: attendanceData, error: attendanceError } = await window.supabase
            .from('attendance_records')
            .select('*')
            .eq('class_id', classId)
            .gte('date', startDate)
            .lte('date', endDate);

        if (attendanceError) throw attendanceError;

        // Generate CSV header
        const uniqueDates = [...new Set(attendanceData.map(record => record.date))].sort();
        let csvContent = 'Student Name';
        
        // Create column for each date
        uniqueDates.forEach(date => {
            const formattedDate = new Date(date).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit'
            });
            csvContent += `,${formattedDate}`;
        });
        csvContent += '\n';

        const attendanceMap = new Map(attendanceData.map(record => 
            [`${record.student_id}-${record.date}`, record.is_present]));

        // Sort students by name
        const sortedStudents = studentsData
            .sort((a, b) => a.students.name.localeCompare(b.students.name));

        // Add each student's attendance record
        sortedStudents.forEach(student => {
            let studentRow = student.students.name;
            
            uniqueDates.forEach(date => {
                const key = `${student.students.id}-${date}`;
                const isPresent = attendanceMap.get(key);
                
                if (isPresent === false) {
                    studentRow += ',X';  // X for absent
                } else if (isPresent === true) {
                    studentRow += ',✓';  // Checkmark for present
                } else {
                    studentRow += ',-';  // Dash for no record
                }
            });
            
            csvContent += studentRow + '\n';
        });

        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const monthYear = selectedDate.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
        const cleanClassName = className.replace(/\s+/g, '_');
        
        link.href = window.URL.createObjectURL(blob);
        link.download = `${cleanClassName}_attendance_${monthYear}.csv`;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('Error downloading attendance:', error);
        alert('Error downloading attendance. Please try again.');
    }
}

async function downloadAllAttendance() {
    try {
        const zip = new JSZip();
        
        // Get the current month and year for the file name
        const monthYear = selectedDate.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });

        // Process each class
        for (const cls of classes) {
            try {
                const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
                const startDate = firstDay.toISOString().split('T')[0];
                const endDate = lastDay.toISOString().split('T')[0];

                // Fetch students for this class
                const { data: studentsData, error: studentsError } = await window.supabase
                    .from('class_students')
                    .select(`
                        students (id, name)
                    `)
                    .eq('class_id', cls.id);

                if (studentsError) throw studentsError;

                // Fetch attendance records for the month
                const { data: attendanceData, error: attendanceError } = await window.supabase
                    .from('attendance_records')
                    .select('*')
                    .eq('class_id', cls.id)
                    .gte('date', startDate)
                    .lte('date', endDate);

                if (attendanceError) throw attendanceError;

                // Generate CSV content
                const uniqueDates = [...new Set(attendanceData.map(record => record.date))].sort();
                let csvContent = 'Student Name';
                
                uniqueDates.forEach(date => {
                    const formattedDate = new Date(date).toLocaleDateString('en-US', {
                        month: '2-digit',
                        day: '2-digit'
                    });
                    csvContent += `,${formattedDate}`;
                });
                csvContent += '\n';

                const attendanceMap = new Map(attendanceData.map(record => 
                    [`${record.student_id}-${record.date}`, record.is_present]));

                // Sort students by name
                const sortedStudents = studentsData
                    .sort((a, b) => a.students.name.localeCompare(b.students.name));

                sortedStudents.forEach(student => {
                    let studentRow = student.students.name;
                    
                    uniqueDates.forEach(date => {
                        const key = `${student.students.id}-${date}`;
                        const isPresent = attendanceMap.get(key);
                        
                        if (isPresent === false) {
                            studentRow += ',X';  // X for absent
                        } else if (isPresent === true) {
                            studentRow += ',✓';  // Checkmark for present
                        } else {
                            studentRow += ',-';  // Dash for no record
                        }
                    });
                    
                    csvContent += studentRow + '\n';
                });

                // Add CSV file to ZIP
                const cleanClassName = cls.name.replace(/\s+/g, '_');
                zip.file(`${cleanClassName}_attendance_${monthYear}.csv`, csvContent);

            } catch (error) {
                console.error(`Error processing class ${cls.name}:`, error);
                // Continue with other classes even if one fails
                continue;
            }
        }

        // Generate and download the ZIP file
        const zipContent = await zip.generateAsync({type: 'blob'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipContent);
        link.download = `all_classes_attendance_${monthYear}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

    } catch (error) {
        console.error('Error generating ZIP file:', error);
        alert('Error downloading attendance files. Please try again.');
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}