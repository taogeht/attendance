document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('assignmentForm');
    const result = document.getElementById('result');
    const classSelect = document.getElementById('classSelect');
    const studentCheckList = document.getElementById('studentCheckList');
    const selectedClassName = document.getElementById('selectedClassName');
    const removeStudentsButton = document.getElementById('removeStudents');
    const importClassSelect = document.getElementById('importClassSelect');
    const csvFileInput = document.getElementById('csvFileInput');
    const importButton = document.getElementById('importButton');

    importButton.addEventListener('click', importStudents);

    function importStudents() {
        const selectedClass = importClassSelect.value;
        const file = csvFileInput.files[0];

        if (!selectedClass) {
            alert('Please select a class for import.');
            return;
        }

        if (!file) {
            alert('Please select a CSV file to import.');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            const students = content.split(/\r\n|\n/).filter(name => name.trim() !== '');

            const assignments = JSON.parse(localStorage.getItem('classAssignments')) || {};
            if (!assignments[selectedClass]) {
                assignments[selectedClass] = [];
            }

            let newStudents = 0;
            students.forEach(student => {
                if (!assignments[selectedClass].includes(student)) {
                    assignments[selectedClass].push(student);
                    newStudents++;
                }
            });

            localStorage.setItem('classAssignments', JSON.stringify(assignments));

            result.innerHTML = `<p>${newStudents} new student(s) imported to ${selectedClass}.</p>`;
            displayStudentList(selectedClass);
            csvFileInput.value = ''; // Clear the file input
        };
        reader.readAsText(file);
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const studentName = document.getElementById('studentName').value;
        const selectedClass = classSelect.value;
        
        if (studentName && selectedClass) {
            // Store the assignment in localStorage
            const assignments = JSON.parse(localStorage.getItem('classAssignments')) || {};
            if (!assignments[selectedClass]) {
                assignments[selectedClass] = [];
            }
            assignments[selectedClass].push(studentName);
            localStorage.setItem('classAssignments', JSON.stringify(assignments));

            result.innerHTML = `<p>Student "${studentName}" has been assigned to the ${selectedClass} class.</p>`;
            form.reset();

            // Update the student list
            displayStudentList(selectedClass);
        } else {
            result.innerHTML = '<p>Please fill out all fields.</p>';
        }
    });

    classSelect.addEventListener('change', function() {
        displayStudentList(this.value);
    });

    function displayStudentList(className) {
        selectedClassName.textContent = className;
        const assignments = JSON.parse(localStorage.getItem('classAssignments')) || {};
        const studentsInClass = assignments[className] || [];

        studentCheckList.innerHTML = '';
        studentsInClass.forEach(student => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" id="${student}" name="student" value="${student}">
                <label for="${student}">${student}</label>
            `;
            studentCheckList.appendChild(li);
        });

        removeStudentsButton.style.display = studentsInClass.length > 0 ? 'block' : 'none';
    }

    removeStudentsButton.addEventListener('click', function() {
        const selectedStudents = Array.from(studentCheckList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        
        if (selectedStudents.length > 0) {
            const currentClass = classSelect.value;
            const assignments = JSON.parse(localStorage.getItem('classAssignments')) || {};
            
            assignments[currentClass] = assignments[currentClass].filter(student => !selectedStudents.includes(student));
            
            localStorage.setItem('classAssignments', JSON.stringify(assignments));
            
            displayStudentList(currentClass);
            
            result.innerHTML = `<p>${selectedStudents.length} student(s) removed from ${currentClass}.</p>`;
        } else {
            result.innerHTML = '<p>No students selected for removal.</p>';
        }
    });

    // Initialize student list if a class is pre-selected
    if (classSelect.value) {
        displayStudentList(classSelect.value);
    }
});