// classOverview.js

let currentClass = null;
let selectedDate = new Date();
let onDateChange = null;

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

// Initialize the app when the DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await initializeApp();
        initializeSidebarLinks();
    });
} else {
    (async () => {
        await initializeApp();
        initializeSidebarLinks();
    })();
}

async function initializeApp() {
    try {
        // Get the teacher ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const teacherId = urlParams.get('teacher');

        if (!teacherId) {
            console.error('No teacher ID provided');
            document.body.innerHTML = '<p>Error: No teacher selected. Please go back and select a teacher.</p>';
            return;
        }

        // Show/hide admin panel button based on admin status
        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        const adminPanelButton = document.getElementById('adminPanelButton');
        if (adminPanelButton) {
            adminPanelButton.hidden = !isAdmin;
        }

        // Initialize components only if elements exist
        const selectAllBtn = document.getElementById('selectAll');
        const saveAttendanceBtn = document.getElementById('saveAttendance');
        const downloadMonthlyBtn = document.getElementById('downloadMonthlyAttendance');

        // Add logout button initialization
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        // Initialize calendar if the element exists
        if (document.getElementById('weekCalendar')) {
            initializeCalendar();
            updateSelectedDateDisplay();
        }

        // Load teacher information
        await loadTeacherInfo(teacherId);

        // Set up date change handler
        onDateChange = async (date) => {
            selectedDate = new Date(date);
            updateSelectedDateDisplay();
            if (currentClass) {
                await loadAttendance(currentClass.id, selectedDate);
            }
        };
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

function initializeSidebarLinks() {
    const adminPanelButton = document.getElementById('adminPanelButton');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (adminPanelButton && isAdmin) {
        adminPanelButton.style.display = 'flex';  // Show the button
    }

    // Resource links
    const familyFriendsButton = document.getElementById('familyFriendsButton');
    if (familyFriendsButton) {
        familyFriendsButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Family and Friends button clicked'); // Debug log
            window.open('https://www.oxfordlearnersbookshelf.com/home/main.html', '_blank');
        });
    } else {
        console.log('Family and Friends button not found'); // Debug log
    }


    document.getElementById('phonicsButton')?.addEventListener('click', (e) => {
        e.preventDefault();
        // This will be updated by updatePhonicsUrl when a class is selected
        window.open("https://huasiamacmillan.com/phonics/", "_blank");
    });

    document.getElementById('readerButton')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.open("http://getepic.com/", "_blank");
    });

    document.getElementById('homeworkButton')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.open("https://huasiamacmillan.com/eeb/", "_blank");
    });

    // Logout handler
    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const sessionToken = localStorage.getItem('sessionToken');
            if (sessionToken) {
                await window.supabase
                    .from('active_sessions')
                    .delete()
                    .eq('session_token', sessionToken);
            }
            localStorage.clear();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = 'login.html';
        }
    });
}

function createClassButtons(classes) {
    const classButtonsContainer = document.getElementById('classButtons');
    if (!classButtonsContainer) return;
    
    classButtonsContainer.innerHTML = '';
    
    if (classes.length === 0) {
        classButtonsContainer.innerHTML = '<p>No classes assigned to this teacher.</p>';
        clearCalendar();
        return;
    }

    // Helper functions for sorting (keep existing sort logic)
    const getClassNumber = (className) => {
        const match = className.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    };

    const getClassLetter = (className) => {
        const match = className.match(/[A-Z]$/);
        return match ? match[0] : '';
    };
    
    // Sort classes
    const sortedClasses = [...classes].sort((a, b) => {
        const numA = getClassNumber(a.name);
        const numB = getClassNumber(b.name);
        
        if (numA !== numB) {
            return numA - numB;
        }
        
        const letterA = getClassLetter(a.name);
        const letterB = getClassLetter(b.name);
        return letterA.localeCompare(letterB);
    });
    
    // Create buttons
    sortedClasses.forEach(cls => {
        const button = document.createElement('button');
        button.textContent = cls.name;
        button.className = 'class-btn';
        button.dataset.classNumber = getClassNumber(cls.name);
        button.dataset.classLetter = getClassLetter(cls.name);
        button.addEventListener('click', () => selectClass(cls.id));
        classButtonsContainer.appendChild(button);
    });
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

    // Add event listeners for calendar navigation
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    document.getElementById('prevWeek').addEventListener('click', () => changeWeek(-1));
    document.getElementById('nextWeek').addEventListener('click', () => changeWeek(1));
    document.getElementById('todayBtn').addEventListener('click', goToToday);

    // Safely handle the linkButton if it exists

if (homeworkButton) {
   homeworkButton.addEventListener('click', () => {
        window.open("https://huasiamacmillan.com/eeb/", "_blank");
   });
}
    // Initial render of the calendar
    updateCalendarDisplay();
}

function addCalendarEventListener(elementId, eventType, handler) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener(eventType, handler);
    }
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
            await selectClass(classes[0].id); // Select first class by default
        } else {
            document.getElementById('classButtons').innerHTML = '<p>No classes assigned to this teacher.</p>';
        }
    } catch (error) {
        console.error('Error loading teacher info:', error);
        document.getElementById('classButtons').innerHTML = 
            '<p class="error-message">Error loading teacher information. Please try again later.</p>';
    }
}

function createClassButtons(classes) {
    const classButtonsContainer = document.getElementById('classButtons');
    classButtonsContainer.innerHTML = '';
    
    // Helper function to extract number from class name
    const getClassNumber = (className) => {
        const match = className.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    };

    // Helper function to extract letter from class name
    const getClassLetter = (className) => {
        const match = className.match(/[A-Z]$/);
        return match ? match[0] : '';
    };
    
    // Sort classes numerically first, then by letter
    const sortedClasses = [...classes].sort((a, b) => {
        // Get numeric parts
        const numA = getClassNumber(a.name);
        const numB = getClassNumber(b.name);
        
        // Compare numbers first
        if (numA !== numB) {
            return numA - numB;
        }
        
        // If numbers are equal, compare letters
        const letterA = getClassLetter(a.name);
        const letterB = getClassLetter(b.name);
        return letterA.localeCompare(letterB);
    });
    
    // Create buttons with sorted classes
    sortedClasses.forEach(cls => {
        const button = document.createElement('button');
        button.textContent = cls.name;
        button.classList.add('class-btn');
        
        // Add data attributes for potential styling
        button.dataset.classNumber = getClassNumber(cls.name);
        button.dataset.classLetter = getClassLetter(cls.name);
        
        button.addEventListener('click', () => selectClass(cls.id));
        classButtonsContainer.appendChild(button);
    });
}

async function selectClass(classId) {
    try {
        const { data, error } = await window.supabase
            .from('classes')
            .select('name')
            .eq('id', classId)
            .single();

        if (error) {
            console.error('Error fetching class name:', error);
            return;
        }

        // Update current class
        currentClass = { id: classId, name: data.name };
        
        // Update UI elements
        document.getElementById('selectedClass').textContent = `Students in ${currentClass.name}`;
        updatePhonicsUrl(currentClass.name);

        // Load students and update calendar
        await Promise.all([
            loadStudents(classId),
            updateCalendarDisplay() // Add calendar update here
        ]);

    } catch (error) {
        console.error('Error in selectClass:', error);
        document.getElementById('selectedClass').textContent = 'Error loading class';
    }
}

function updatePhonicsUrl(className) {
    const phonicsButton = document.getElementById('phonicsButton');
    if (!phonicsButton) return;

    // Extract grade number from class name
    const gradeMatch = className.match(/^(\d+)/);
    if(gradeMatch) {
        const grade = gradeMatch[1];
        // Update the click handler
        phonicsButton.onclick = () => {
            window.open(`https://huasiamacmillan.com/phonics/phonics${grade}/`, "_blank");
        };
    } else {
        phonicsButton.onclick = () => {
            window.open("https://huasiamacmillan.com/phonics/", "_blank");
        };
    }
    
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
        studentList.innerHTML = ''; // Clear everything first

        // Remove any existing attendance-actions if they exist elsewhere
        const existingActions = document.querySelector('.attendance-actions');
        if (existingActions) {
            existingActions.remove();
        }

        if (students.length === 0) {
            studentList.innerHTML = '<li>No students assigned to this class.</li>';
            return;
        }

        // Add action buttons before the accordion
        const actionButtons = document.createElement('div');
        actionButtons.className = 'student-actions';
        actionButtons.innerHTML = `
            <button id="selectAll" class="action-btn">Select All</button>
            <button id="saveAttendance" class="action-btn">Save Attendance</button>
            <button id="downloadMonthlyAttendance" class="action-btn">Download Monthly Attendance</button>
        `;
        studentList.appendChild(actionButtons);

        // Create accordion section for students
        const section = document.createElement('div');
        section.className = 'accordion-section';

        const header = document.createElement('div');
        header.className = 'accordion-header';
        header.innerHTML = `
            <div class="header-content">
                Students
                <span class="expand-icon">▼</span>
            </div>
        `;

        const content = document.createElement('div');
        content.className = 'accordion-content';
        
        // Add all students to the content section
        students.forEach(student => {
            const studentRow = document.createElement('div');
            studentRow.className = 'student-row';
            studentRow.innerHTML = `
                <span class="student-name">${student.students.name}</span>
                <input type="checkbox" 
                       class="attendance-checkbox" 
                       data-student="${student.students.id}">
            `;
            content.appendChild(studentRow);
        });

        section.appendChild(header);
        section.appendChild(content);
        studentList.appendChild(section);

        // Add click event for accordion
        header.addEventListener('click', () => {
            section.classList.toggle('active');
            const expandIcon = header.querySelector('.expand-icon');
            
            if (section.classList.contains('active')) {
                content.style.maxHeight = content.scrollHeight + "px";
                expandIcon.style.transform = 'rotate(180deg)';
            } else {
                content.style.maxHeight = null;
                expandIcon.style.transform = 'rotate(0deg)';
            }
        });

        // Add event listeners for buttons
        document.getElementById('selectAll').addEventListener('click', toggleSelectAll);
        document.getElementById('saveAttendance').addEventListener('click', saveAttendance);
        document.getElementById('downloadMonthlyAttendance').addEventListener('click', downloadMonthlyAttendance);

        // Load attendance for the selected date
        await loadAttendance(classId, selectedDate);

    } catch (error) {
        console.error('Error loading students:', error);
        document.getElementById('studentList').innerHTML = 
            '<li>Error loading students. Please try again later.</li>';
    }
}

function updateSelectAllButtonState() {
    const checkboxes = document.querySelectorAll('.attendance-checkbox');
    const selectAllButton = document.getElementById('selectAll');
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
    selectAllButton.textContent = allChecked ? 'Deselect All' : 'Select All';
}

async function loadAttendance(classId, date) {
    try {
        const dateString = formatDateToString(date);
        const { data: attendance, error } = await window.supabase
            .from('attendance_records')
            .select('student_id, is_present')
            .eq('class_id', classId)
            .eq('date', dateString);

        if (error) throw error;

        const attendanceMap = new Map(attendance.map(record => [record.student_id, record.is_present]));
        const checkboxes = document.querySelectorAll('.attendance-checkbox');

        checkboxes.forEach(checkbox => {
            const studentId = checkbox.dataset.student;
            checkbox.checked = attendanceMap.has(studentId) ? attendanceMap.get(studentId) : false;
        });

        updateSelectAllButtonState();
    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}

function isSameDate(date1, date2) {
    return formatDateToString(date1) === formatDateToString(date2);
}

// Function to get the first day of the month
function getFirstDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Function to get the number of days in a month
function getDaysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

// Function to get the day of week (0-6) for the first day of the month
function getFirstDayOfWeek(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
}

async function updateCalendarDisplay() {
    const weekCalendar = document.getElementById('weekCalendar');
    if (!weekCalendar) return;

    weekCalendar.innerHTML = '';

    // Create header row for days of the week
    const daysHeader = document.createElement('div');
    daysHeader.className = 'calendar-header';
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    daysOfWeek.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-header-cell';
        dayHeader.textContent = day;
        daysHeader.appendChild(dayHeader);
    });
    weekCalendar.appendChild(daysHeader);

    // Fetch attendance data for the month if we have a current class
    let attendanceMap = new Map();
    if (currentClass && currentClass.id) {
        attendanceMap = await getMonthlyAttendance(
            currentClass.id,
            selectedDate.getFullYear(),
            selectedDate.getMonth()
        );
    }

    // Create calendar grid
    const calendarGrid = document.createElement('div');
    calendarGrid.className = 'calendar-grid';

    const firstDay = getFirstDayOfMonth(selectedDate);
    const daysInMonth = getDaysInMonth(selectedDate);
    const startDay = getFirstDayOfWeek(selectedDate);

    // Add days from previous month
    const prevMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
    const daysInPrevMonth = getDaysInMonth(prevMonth);
    const prevMonthStartDay = daysInPrevMonth - startDay + 1;

    for (let i = 0; i < startDay; i++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day other-month';
        dayElement.textContent = prevMonthStartDay + i;
        calendarGrid.appendChild(dayElement);
    }

    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i);
        
        if (isToday(currentDate)) {
            dayElement.classList.add('today');
        }
        if (isSameDate(currentDate, selectedDate)) {
            dayElement.classList.add('selected');
        }

        // Create the date content container
        const dateContent = document.createElement('div');
        dateContent.className = 'date-content';

        // Add the date number
        const dateNumber = document.createElement('div');
        dateNumber.className = 'date-number';
        dateNumber.textContent = i;
        dateContent.appendChild(dateNumber);

        // Add attendance indicator if we have data for this date
        const dateStr = formatDateToString(currentDate);
        if (attendanceMap.has(dateStr)) {
            const attendanceIndicator = document.createElement('div');
            attendanceIndicator.className = 'attendance-indicator';
            attendanceIndicator.textContent = `P:${attendanceMap.get(dateStr)}`;
            dateContent.appendChild(attendanceIndicator);
        }

        dayElement.appendChild(dateContent);
        dayElement.addEventListener('click', () => selectDate(currentDate));
        calendarGrid.appendChild(dayElement);
    }

    // Add remaining days for next month
    const totalCells = 42; // 6 rows * 7 days
    const remainingCells = totalCells - (startDay + daysInMonth);
    for (let i = 1; i <= remainingCells; i++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day other-month';
        dayElement.textContent = i;
        calendarGrid.appendChild(dayElement);
    }

    weekCalendar.appendChild(calendarGrid);
}


async function saveAttendance() {
    try {
        const dateString = formatDateToString(selectedDate);
        const checkboxes = document.querySelectorAll('.attendance-checkbox');
        const attendanceRecords = Array.from(checkboxes).map(checkbox => ({
            class_id: currentClass.id,
            student_id: checkbox.dataset.student,
            date: dateString,
            is_present: checkbox.checked
        }));

        // Delete existing records for this class and date
        const { error: deleteError } = await window.supabase
            .from('attendance_records')
            .delete()
            .eq('class_id', currentClass.id)
            .eq('date', dateString);

        if (deleteError) throw deleteError;

        // Only insert records for checked students
        const recordsToInsert = attendanceRecords.filter(record => record.is_present);
        
        if (recordsToInsert.length > 0) {
            const { error: insertError } = await window.supabase
                .from('attendance_records')
                .insert(recordsToInsert);

            if (insertError) throw insertError;
        }

        alert('Attendance saved successfully!');
        
        // Update calendar display to show new attendance data
        await updateCalendarDisplay();
    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('Error saving attendance. Please try again.');
    }
}


function initializeCalendar() {
    const calendarNavigation = document.getElementById('calendarNavigation');
    if (!calendarNavigation) return;
    
    // Update navigation to show only prev/next month buttons
    calendarNavigation.innerHTML = `
        <button id="prevMonth" class="calendar-nav-btn">&lt; Previous Month</button>
        <button id="nextMonth" class="calendar-nav-btn">Next Month &gt;</button>
    `;

    // Add month/year display if it doesn't exist
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
    document.getElementById('prevMonth')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth')?.addEventListener('click', () => changeMonth(1));

    // Initial render
    updateCalendarDisplay();
}

function formatDateToString(date) {
    // Create a new date object and set it to midnight in the local timezone
    const localDate = new Date(date);
    localDate.setHours(0, 0, 0, 0);
    
    // Get year, month, and day
    const year = localDate.getFullYear();
    // Month is 0-based, so add 1
    const month = (localDate.getMonth() + 1).toString().padStart(2, '0');
    const day = localDate.getDate().toString().padStart(2, '0');
    
    // Return in YYYY-MM-DD format
    return `${year}-${month}-${day}`;
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

async function selectDate(date) {
    selectedDate = new Date(date);
    updateSelectedDateDisplay();
    await updateCalendarDisplay();
    
    // Update attendance for the new date if we have a current class
    if (currentClass && currentClass.id) {
        await loadAttendance(currentClass.id, selectedDate);
    }
}

function clearCalendar() {
    const weekCalendar = document.getElementById('weekCalendar');
    if (weekCalendar) {
        weekCalendar.innerHTML = '';
    }
    
    const monthYearDisplay = document.getElementById('monthYearDisplay');
    if (monthYearDisplay) {
        monthYearDisplay.textContent = '';
    }
}

async function changeMonth(direction) {
    selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + direction, 1);
    updateSelectedDateDisplay();
    await updateCalendarDisplay(); // Make sure this is awaited
    
    // Update attendance for the new date if we have a current class
    if (currentClass && currentClass.id) {
        await loadAttendance(currentClass.id, selectedDate);
    }
}

function updateSelectedDateDisplay() {
    const monthYearDisplay = document.getElementById('monthYearDisplay');
    if (monthYearDisplay) {
        monthYearDisplay.textContent = selectedDate.toLocaleDateString('en-US', { 
            month: 'long',
            year: 'numeric'
        });
    }
}


// Function to update the selected date display
function updateSelectedDateDisplay() {
    const monthYearDisplay = document.getElementById('monthYearDisplay');
    if (monthYearDisplay) {
        monthYearDisplay.textContent = selectedDate.toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }
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
        const dateString = formatDateToString(selectedDate);
        const checkboxes = document.querySelectorAll('.attendance-checkbox');
        const attendanceRecords = Array.from(checkboxes).map(checkbox => ({
            class_id: currentClass.id,
            student_id: checkbox.dataset.student,
            date: dateString,
            is_present: checkbox.checked
        }));

        // Delete existing records for this class and date
        const { error: deleteError } = await window.supabase
            .from('attendance_records')
            .delete()
            .eq('class_id', currentClass.id)
            .eq('date', dateString);

        if (deleteError) throw deleteError;

        // Only insert records for checked students
        const recordsToInsert = attendanceRecords.filter(record => record.is_present);
        
        if (recordsToInsert.length > 0) {
            const { error: insertError } = await window.supabase
                .from('attendance_records')
                .insert(recordsToInsert);

            if (insertError) throw insertError;
        }

        alert('Attendance saved successfully!');
        
        // Explicitly refresh the calendar with the current class and date
        await updateCalendarDisplay();
        
        // Also refresh the attendance checkboxes to ensure everything is in sync
        if (currentClass && currentClass.id) {
            await loadAttendance(currentClass.id, selectedDate);
        }
    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('Error saving attendance. Please try again.');
    }
}

async function getMonthlyAttendance(classId, year, month) {
    try {
        // Create start and end dates for the month
        const startDate = formatDateToString(new Date(year, month, 1));
        const endDate = formatDateToString(new Date(year, month + 1, 0));

        const { data: attendance, error } = await window.supabase
            .from('attendance_records')
            .select('date, is_present')
            .eq('class_id', classId)
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) throw error;

        // Create a map of date -> present count
        const attendanceMap = new Map();
        attendance.forEach(record => {
            const dateStr = record.date;
            if (!attendanceMap.has(dateStr)) {
                attendanceMap.set(dateStr, 0);
            }
            if (record.is_present) {
                attendanceMap.set(dateStr, attendanceMap.get(dateStr) + 1);
            }
        });

        return attendanceMap;
    } catch (error) {
        console.error('Error fetching monthly attendance:', error);
        return new Map();
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

        // Generate CSV header
        const uniqueDates = [...new Set(attendanceData.map(record => record.date))].sort();
        let csvContent = 'Student Name';
        
        // Create single column for each date
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

        // Sort students by name as stored in database
        const sortedStudents = studentsData
            .sort((a, b) => a.students.name.localeCompare(b.students.name));

        sortedStudents.forEach(student => {
            let studentRow = student.students.name;
            
            // Build attendance row for this student
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

async function handleLogout() {
    try {
        const sessionToken = localStorage.getItem('sessionToken');
        if (sessionToken) {
            await window.supabase
                .from('active_sessions')
                .delete()
                .eq('session_token', sessionToken);
        }
        clearSession();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = 'login.html';
    }
}


