// classOverview.js

let currentClass = null;
let selectedDate = new Date();
let currentWeekStart = getWeekStart(new Date());
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

// Call this when the page loads
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
document.addEventListener('DOMContentLoaded', function() {
    const passwordForm = document.getElementById('passwordChangeForm');
    const messageDiv = document.getElementById('passwordChangeMessage');

    if (passwordForm) {
        passwordForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // Basic validation
            if (!currentPassword || !newPassword || !confirmPassword) {
                showPasswordMessage('Please fill in all fields', 'error');
                return;
            }

            if (newPassword !== confirmPassword) {
                showPasswordMessage('New passwords do not match', 'error');
                return;
            }

            if (newPassword.length < 6) {
                showPasswordMessage('New password must be at least 6 characters', 'error');
                return;
            }

            const result = await changePassword(currentPassword, newPassword);
            showPasswordMessage(result.message, result.success ? 'success' : 'error');

            if (result.success) {
                passwordForm.reset();
            }
        });
    }

    function showPasswordMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = `message ${type}`;
            messageDiv.style.display = 'block';

            if (type === 'success') {
                setTimeout(() => {
                    messageDiv.style.display = 'none';
                }, 3000);
            }
        }
    }
});
async function initializeApp() {
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
        adminPanelButton.style.display = isAdmin ? 'inline-block' : 'none';
    }

    // Safely add event listeners only if elements exist
    const selectAllBtn = document.getElementById('selectAll');
    const saveAttendanceBtn = document.getElementById('saveAttendance');
    const downloadMonthlyBtn = document.getElementById('downloadMonthlyAttendance');
    const removeAttendanceBtn = document.getElementById('removeAttendance');

    // Add logout button initialization
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const sessionToken = localStorage.getItem('sessionToken');
            if (sessionToken) {
                try {
                    // Remove session from database
                    await window.supabase
                        .from('active_sessions')
                        .delete()
                        .eq('session_token', sessionToken);
                } catch (error) {
                    console.error('Logout error:', error);
                }
            }
            
            // Clear all local storage
            localStorage.clear();
            
            // Redirect to login page
            window.location.href = 'login.html';
        });
    }

    if (!teacherId) {
        console.error('No teacher ID provided');
        document.body.innerHTML = '<p>Error: No teacher selected. Please go back and select a teacher.</p>';
        return;
    }

    // Safely add event listeners only if elements exist
    const phonicsButton = document.getElementById('phonicsButton');
    const readerButton = document.getElementById('readerButton');
    const homeworkButton = document.getElementById('homeworkButton');

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', toggleSelectAll);
    }
    
    if (saveAttendanceBtn) {
        saveAttendanceBtn.addEventListener('click', saveAttendance);
    }
    
    if (downloadMonthlyBtn) {
        downloadMonthlyBtn.addEventListener('click', downloadMonthlyAttendance);
    }
    
    if (removeAttendanceBtn) {
        removeAttendanceBtn.addEventListener('click', removeAttendance);
    }

    if (readerButton) {
        readerButton.addEventListener('click', () => {
            window.open("http://getepic.com/", "_blank");
        });
    }
    
    await loadTeacherInfo(teacherId);
    
    // Only initialize calendar if weekCalendar element exists
    if (document.getElementById('weekCalendar')) {
        initializeCalendar();
        updateSelectedDateDisplay();
    }

    // Set up date change handler
    onDateChange = async (date) => {
        selectedDate = new Date(date);  // Create a new Date object to avoid reference issues
        updateSelectedDateDisplay();
        if (currentClass) {
            await loadAttendance(currentClass.id, selectedDate);  // Update attendance for the new date
        }
    };
    
}
function createClassButtons(classes) {
    const classButtonsContainer = document.getElementById('classButtons');
    classButtonsContainer.innerHTML = '';
    
    // Helper function to safely extract class number and letter
    const extractClassInfo = (className) => {
        const match = className.match(/(\d+)([A-Za-z])/);
        return {
            number: match ? match[1] : '0',
            letter: match ? match[2] : 'A'
        };
    };
    
    // Sort classes safely
    const sortedClasses = classes.sort((a, b) => {
        const aInfo = extractClassInfo(a.name);
        const bInfo = extractClassInfo(b.name);
        
        // Compare numbers first
        const numCompare = parseInt(aInfo.number) - parseInt(bInfo.number);
        if (numCompare !== 0) return numCompare;
        
        // If numbers are the same, compare letters
        return aInfo.letter.localeCompare(bInfo.letter);
    });

    sortedClasses.forEach(cls => {
        const button = document.createElement('button');
        button.textContent = cls.name;
        button.classList.add('class-btn');
        
        // Safely add data attributes
        const classInfo = extractClassInfo(cls.name);
        button.dataset.classNumber = classInfo.number;
        button.dataset.classLetter = classInfo.letter;
        
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
    
    updatePhonicsUrl(currentClass.name);

    await loadStudents(classId);
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
        studentList.innerHTML = '';

        if (students.length === 0) {
            studentList.innerHTML = '<li>No students assigned to this class.</li>';
            return;
        }

        // Create single accordion section
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

        // Add click event
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

        await loadAttendance(classId, selectedDate);

    } catch (error) {
        console.error('Error loading students:', error);
        document.getElementById('studentList').innerHTML = '<li>Error loading students. Please try again later.</li>';
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
        const dateString = date.toISOString().split('T')[0];
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

async function selectDate(date) {
    selectedDate = new Date(date);  // Create a new Date object to avoid reference issues
    updateCalendarDisplay();
    if (typeof onDateChange === 'function') {
        await onDateChange(selectedDate);
        // Update select all button state after date change
        updateSelectAllButtonState();
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
        const dateString = selectedDate.toISOString().split('T')[0];
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
    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('Error saving attendance. Please try again.');
    }
}
async function removeAttendance() {
    try {
        if (!currentClass || !currentClass.id) {
            alert('Please select a class first');
            return;
        }

        // Confirm with the user before deleting
        const confirmDelete = confirm(`Are you sure you want to remove all attendance records for ${selectedDate.toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        })}?`);

        if (!confirmDelete) {
            return;
        }

        // Delete attendance records for the selected date and class
        const { error } = await window.supabase
            .from('attendance_records')
            .delete()
            .eq('class_id', currentClass.id)
            .eq('date', selectedDate.toISOString().split('T')[0]);

        if (error) throw error;

        // Reset all checkboxes to unchecked state
        const checkboxes = document.querySelectorAll('.attendance-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false; // Reset to unchecked state
        });

        alert('Attendance records removed successfully!');
    } catch (error) {
        console.error('Error removing attendance:', error);
        alert('Error removing attendance records. Please try again.');
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




// Initialize the app when the DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}