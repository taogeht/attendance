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
// Add this to the top of each page's JavaScript files
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
    
    const downloadAllBtn = document.getElementById('downloadAllAttendance');
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', downloadAllAttendance);
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

    classes.forEach((cls, index) => {
        const classSection = document.createElement('div');
        classSection.className = 'accordion-section section';
        
        // Create header with summary info
        const headerHtml = `
            <div class="accordion-header">
                <div class="header-content">
                    <span class="class-title">${cls.name} - ${cls.teachers.name}</span>
                    <div class="attendance-summary" id="summary-${cls.id}">
                        <span class="present">Present: 0</span>
                        <span class="absent">Absent: 0</span>
                        <span class="total">Total: 0</span>
                    </div>
                    <span class="expand-icon">▼</span>
                </div>
            </div>`;

        // Create content container with download button
        const contentHtml = `
            <div class="accordion-content">
                <div class="student-list-container">
                    <ul id="studentList-${cls.id}" class="student-list">
                        <li>Loading students...</li>
                    </ul>
                </div>
                <div class="accordion-footer">
                    <button class="download-btn" onclick="downloadMonthlyAttendance('${cls.id}', '${cls.name}')">
                        Download Monthly Attendance
                    </button>
                </div>
            </div>`;

        classSection.innerHTML = headerHtml + contentHtml;
        classesGrid.appendChild(classSection);

        // Add click event to toggle accordion
        const header = classSection.querySelector('.accordion-header');
        const content = classSection.querySelector('.accordion-content');
        
        header.addEventListener('click', (e) => {
            // Don't toggle if clicking the download button
            if (e.target.classList.contains('download-btn')) {
                return;
            }
            
            const isActive = classSection.classList.contains('active');
            
            // Close all other sections
            document.querySelectorAll('.accordion-section').forEach(section => {
                section.classList.remove('active');
                section.querySelector('.accordion-content').style.maxHeight = null;
                section.querySelector('.expand-icon').style.transform = 'rotate(0deg)';
            });

            // Toggle current section
            if (!isActive) {
                classSection.classList.add('active');
                content.style.maxHeight = content.scrollHeight + "px";
                header.querySelector('.expand-icon').style.transform = 'rotate(180deg)';
            }
        });
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

async function downloadMonthlyAttendance(classId, className) {
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