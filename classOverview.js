// classOverview.js

let currentClass = null;
let selectedDate = new Date();
let currentWeekStart = getWeekStart(new Date());
let onDateChange = null;

async function initializeApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const teacherId = urlParams.get('teacher');

    if (!teacherId) {
        console.error('No teacher ID provided');
        document.body.innerHTML = '<p>Error: No teacher selected. Please go back and select a teacher.</p>';
        return;
    }

    await loadTeacherInfo(teacherId);
    initializeCalendar();
    updateSelectedDateDisplay();

    // Set up event handlers
    document.getElementById('selectAll').addEventListener('click', toggleSelectAll);
    document.getElementById('saveAttendance').addEventListener('click', saveAttendance);
    document.getElementById('downloadMonthlyAttendance').addEventListener('click', downloadMonthlyAttendance);

    // Set up date change handler
    onDateChange = async (date) => {
        selectedDate = date;
        updateSelectedDateDisplay();
        if (currentClass) {
            await loadStudents(currentClass.id);
        }
    };
}

function initializeCalendar() {
    const weekCalendar = document.getElementById('weekCalendar');
    const calendarNavigation = document.getElementById('calendarNavigation');
    
    // Initialize calendar controls
    calendarNavigation.innerHTML = `
        <button id="prevMonth" class="calendar-nav-btn">&lt;&lt; Prev Month</button>
        <button id="prevWeek" class="calendar-nav-btn">&lt; Prev Week</button>
        <button id="todayBtn" class="calendar-nav-btn today-btn">Today</button>
        <button id="nextWeek" class="calendar-nav-btn">Next Week &gt;</button>
        <button id="nextMonth" class="calendar-nav-btn">Next Month &gt;&gt;</button>
    `;

    // Add month/year display
    const monthYearDisplay = document.createElement('div');
    monthYearDisplay.id = 'monthYearDisplay';
    monthYearDisplay.className = 'month-year-display';
    weekCalendar.parentNode.insertBefore(monthYearDisplay, weekCalendar);

    // Add event listeners
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    document.getElementById('prevWeek').addEventListener('click', () => changeWeek(-1));
    document.getElementById('nextWeek').addEventListener('click', () => changeWeek(1));
    document.getElementById('todayBtn').addEventListener('click', goToToday);
    document.getElementById('linkButton').onclick = function (){
        window.open ("https://www.oxfordlearnersbookshelf.com/home/main.html","_blank")};
    // Initial render
    updateCalendarDisplay();
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
            // Sort classes by number then letter
            const sortedClasses = classes.sort((a, b) => {
                // Extract number and letter from class names
                const [, aNum, aLetter] = a.name.match(/(\d+)([A-Za-z])/) || [null, '0', 'A'];
                const [, bNum, bLetter] = b.name.match(/(\d+)([A-Za-z])/) || [null, '0', 'A'];
                
                // Compare numbers first
                const numCompare = parseInt(aNum) - parseInt(bNum);
                if (numCompare !== 0) return numCompare;
                
                // If numbers are the same, compare letters
                return aLetter.localeCompare(bLetter);
            });

            createClassButtons(sortedClasses);
            await selectClass(sortedClasses[0].id); // Select first class by default
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
    classButtonsContainer.innerHTML = '';
    
    classes.forEach(cls => {
        const button = document.createElement('button');
        button.textContent = cls.name;
        button.classList.add('class-btn');
        // Add a data attribute for potential styling or sorting changes
        button.dataset.classNumber = cls.name.match(/\d+/)[0];
        button.dataset.classLetter = cls.name.match(/[A-Za-z]/)[0];
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
                <input type="checkbox" class="attendance-checkbox" data-student="${student.students.id}">
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
        const checkboxes = document.querySelectorAll('.attendance-checkbox');

        checkboxes.forEach(checkbox => {
            const studentId = checkbox.dataset.student;
            checkbox.checked = attendanceMap.get(studentId) ?? true; // Default to present if no record
        });
    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}

function updateCalendarDisplay() {
    const weekCalendar = document.getElementById('weekCalendar');
    const monthYearDisplay = document.getElementById('monthYearDisplay');
    weekCalendar.innerHTML = '';

    // Update month/year display
    const monthYear = currentWeekStart.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
    });
    monthYearDisplay.textContent = monthYear;

    // Create weekday headers
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const headerRow = document.createElement('div');
    headerRow.className = 'calendar-header';
    weekdays.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-header-cell';
        dayHeader.textContent = day;
        headerRow.appendChild(dayHeader);
    });
    weekCalendar.appendChild(headerRow);

    // Create calendar days
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

        dayElement.innerHTML = `
            <span class="date-number">${date.getDate()}</span>
            <span class="date-text">${date.toLocaleDateString('en-US', { 
                weekday: 'short',
                month: 'short'
            })}</span>
        `;

        dayElement.addEventListener('click', () => selectDate(date));
        daysContainer.appendChild(dayElement);
    }
    weekCalendar.appendChild(daysContainer);
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

// Helper functions
function getWeekStart(date) {
    const newDate = new Date(date);
    const day = newDate.getDay();
    const diff = newDate.getDate() - day;
    newDate.setDate(diff);
    return newDate;
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

function updateSelectedDateDisplay() {
    document.getElementById('selectedDate').textContent = 
        `Attendance for ${selectedDate.toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        })}`;
}

function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.attendance-checkbox');
    const selectAllButton = document.getElementById('selectAll');
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);

    checkboxes.forEach(checkbox => {
        checkbox.checked = !allChecked;
    });

    selectAllButton.textContent = allChecked ? 'Select All' : 'Deselect All';
}

async function saveAttendance() {
    try {
        const checkboxes = document.querySelectorAll('.attendance-checkbox');
        const attendanceRecords = Array.from(checkboxes).map(checkbox => ({
            class_id: currentClass.id,
            student_id: checkbox.dataset.student,
            date: selectedDate.toISOString().split('T')[0],
            is_present: checkbox.checked
        }));

        // Delete existing records for this class and date
        const { error: deleteError } = await window.supabase
            .from('attendance_records')
            .delete()
            .eq('class_id', currentClass.id)
            .eq('date', selectedDate.toISOString().split('T')[0]);

        if (deleteError) throw deleteError;

        // Insert new records
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

async function downloadMonthlyAttendance() {
    try {
        const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

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

        // Generate CSV
        const uniqueDates = [...new Set(attendanceData.map(record => record.date))].sort();
        let csvContent = 'Student Name';
        uniqueDates.forEach(date => {
            csvContent += ',' + new Date(date).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit'
            });
        });
        csvContent += '\n';

        const attendanceMap = new Map(attendanceData.map(record => 
            [`${record.student_id}-${record.date}`, record.is_present]));

        studentsData.forEach(studentRecord => {
            const student = studentRecord.students;
            csvContent += student.name;
            
            uniqueDates.forEach(date => {
                const key = `${student.id}-${date}`;
                const isPresent = attendanceMap.get(key);
                csvContent += ',';
                if (isPresent === false) {
                    csvContent += 'A';
                } else if (isPresent === true) {
                    csvContent += 'P';
                } else {
                    csvContent += '-';
                }
            });
            csvContent += '\n';
        });

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const monthYear = selectedDate.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
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