
    document.addEventListener('DOMContentLoaded', function() {
        const teacherClasses = {
            'Bryce': ['2A', '2B', '3B'],
            'Dirk': ['1A', '4B'],
            'James': ['1C', '3A', '5B', '6'],
            'Mike': ['1B', '4A', '5A']
        };
    
        const teacherName = document.getElementById('teacherName');
        const classButtons = document.getElementById('classButtons');
        const selectedClassElement = document.getElementById('selectedClass');
        const selectedDateElement = document.getElementById('selectedDate');
        const studentList = document.getElementById('studentList');
        const weekCalendar = document.getElementById('weekCalendar');
        const saveAttendanceButton = document.getElementById('saveAttendance');
        const prevWeekButton = document.getElementById('prevWeek');
        const nextWeekButton = document.getElementById('nextWeek');
        const selectAllButton = document.getElementById('selectAll');
        const downloadButton = document.getElementById('downloadAttendance');

        const urlParams = new URLSearchParams(window.location.search);
        const teacher = urlParams.get('teacher');
      

        let currentClass = '';
        let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || {};
        let selectedDate = new Date();
        let currentWeekStart = new Date(selectedDate);
        let allSelected = false;
    
     

        function updateSelectedDateDisplay() {
            selectedDateElement.textContent = `Attendance for ${selectedDate.toLocaleDateString()}`;
        }
        

        function displayStudents(className, date) {
            currentClass = className;
            selectedClassElement.textContent = `Students in Class ${className}`;
            studentList.innerHTML = '';
    
            const assignments = JSON.parse(localStorage.getItem('classAssignments')) || {};
            const studentsInClass = assignments[className] || [];
    
            const dateString = date.toISOString().split('T')[0];
    
            if (studentsInClass.length === 0) {
                studentList.innerHTML = '<li>No students assigned to this class yet.</li>';
                selectAllButton.style.display = 'none';
            } else {
                selectAllButton.style.display = 'block';
                studentsInClass.forEach(student => {
                    const li = document.createElement('li');
                    const key = `${currentClass}-${student}-${dateString}`;
                    const isAbsent = attendanceData[key] || false;
                    li.innerHTML = `
                        ${student}
                        <input type="checkbox" class="absence-checkbox" data-student="${student}" ${isAbsent ? 'checked' : ''}>
                    `;
                    studentList.appendChild(li);
                });
            }
        }
    
        function updateCalendar() {
            weekCalendar.innerHTML = '';
            const startOfWeek = new Date(currentWeekStart);
    
            for (let i = 0; i < 7; i++) {
                const date = new Date(startOfWeek);
                date.setDate(startOfWeek.getDate() + i);
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
                    displayStudents(currentClass, selectedDate);
                    updateCalendar();
                });
                weekCalendar.appendChild(dayElement);
            }
        }
    
        function initializeTeacherView() {
            if (teacher && teacherClasses[teacher]) {
                teacherName.textContent = `${teacher}'s Classes`;
                const classes = teacherClasses[teacher];
    
                classes.forEach(className => {
                    const button = document.createElement('button');
                    button.textContent = className;
                    button.classList.add('class-btn');
                    button.addEventListener('click', () => {
                        displayStudents(className, selectedDate);
                        updateSelectedDateDisplay();
                    });
                    classButtons.appendChild(button);
                });
    
                if (classes.length > 0) {
                    displayStudents(classes[0], selectedDate);
                }
            } else {
                teacherName.textContent = 'Invalid Teacher';
                classButtons.innerHTML = '<p>No classes available.</p>';
            }
        }
    
      
        function downloadMonthlyAttendance() {
            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
        
            // Get all students in the class
            const assignments = JSON.parse(localStorage.getItem('classAssignments')) || {};
            const studentsInClass = assignments[currentClass] || [];
        
            // Create an object to store attendance data and track dates with records
            let attendanceRecord = {};
            let datesWithAttendance = new Set();
            studentsInClass.forEach(student => {
                attendanceRecord[student] = {};
            });
        
            // Collect attendance data for the month and track dates with records
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const dateString = date.toISOString().split('T')[0];
        
                let attendanceTakenForDay = false;
                studentsInClass.forEach(student => {
                    const key = `${currentClass}-${student}-${dateString}`;
                    if (key in attendanceData) {
                        attendanceRecord[student][dateString] = attendanceData[key] ? '✓' : 'x';
                        attendanceTakenForDay = true;
                    }
                });
        
                if (attendanceTakenForDay) {
                    datesWithAttendance.add(dateString);
                }
            }
        
            // Convert Set to sorted Array for consistent date order
            const sortedDates = Array.from(datesWithAttendance).sort();
        
            // Generate CSV content
            let csvContent = "data:text/csv;charset=utf-8,Student";
        
            // Add date headers only for dates with attendance records
            sortedDates.forEach(dateString => {
                const date = new Date(dateString);
                csvContent += "," + date.toLocaleDateString('en-US', {month: 'numeric', day: 'numeric'});
            });
            csvContent += "\n";
        
            // Add student attendance data
            studentsInClass.forEach(student => {
                csvContent += student;
                sortedDates.forEach(dateString => {
                    csvContent += "," + (attendanceRecord[student][dateString] || '');
                });
                csvContent += "\n";
            });
        
            // Create and trigger download
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `${currentClass}_attendance_${year}-${month + 1}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

    selectAllButton.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.absence-checkbox');
        allSelected = !allSelected;  // Toggle the state
        checkboxes.forEach(checkbox => {
            checkbox.checked = allSelected;
        });
        selectAllButton.textContent = allSelected ? 'Deselect All' : 'Select All';
    });

    saveAttendanceButton.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.absence-checkbox');
        const dateString = selectedDate.toISOString().split('T')[0];
        checkboxes.forEach(checkbox => {
            const student = checkbox.dataset.student;
            const key = `${currentClass}-${student}-${dateString}`;
            attendanceData[key] = checkbox.checked;
        });

        localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
        alert('Attendance saved successfully!');
    });        

    prevWeekButton.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        updateCalendar();
    });

    nextWeekButton.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        updateCalendar();
    });
    
   
    downloadButton.addEventListener('click', downloadMonthlyAttendance);

    initializeTeacherView();
    updateSelectedDateDisplay();
    updateCalendar();

    });