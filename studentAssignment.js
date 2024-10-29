function initializeApp() {
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase is not initialized. Please check your Supabase script inclusion.');
        return;
    }

    const form = document.getElementById('assignmentForm');
    const result = document.getElementById('result');
    const classSelect = document.getElementById('classSelect');
    const importClassSelect = document.getElementById('importClassSelect');
    const studentCheckList = document.getElementById('studentCheckList');
    const selectedClassName = document.getElementById('selectedClassName');
    const removeStudentsButton = document.getElementById('removeStudents');
    const importButton = document.getElementById('importButton');
    const selectAllButton = document.createElement('button');

    // Create and add the Select All button
    selectAllButton.id = 'selectAllStudents';
    selectAllButton.className = 'select-all-btn';
    selectAllButton.textContent = 'Select All';
    // Insert the button before the student list
    studentCheckList.parentElement.insertBefore(selectAllButton, studentCheckList);

    let allSelected = false;

    selectAllButton.addEventListener('click', function(e) {
        e.preventDefault();
        const checkboxes = studentCheckList.querySelectorAll('input[type="checkbox"]');
        allSelected = !allSelected;
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = allSelected;
        });
        
        this.textContent = allSelected ? 'Deselect All' : 'Select All';
    });

    async function getClasses() {
        const { data, error } = await window.supabase
            .from('classes')
            .select('id, name');
    
        if (error) {
            console.error('Error fetching classes:', error);
            return;
        }
    
        // Sort classes alphanumerically
        const sortedClasses = data.sort((a, b) => {
            // Extract number and letter from class names
            const [, aNum, aLetter] = a.name.match(/(\d+)([A-Za-z]*)/) || [null, '0', ''];
            const [, bNum, bLetter] = b.name.match(/(\d+)([A-Za-z]*)/) || [null, '0', ''];
            
            // Compare numbers first
            const numCompare = parseInt(aNum) - parseInt(bNum);
            if (numCompare !== 0) return numCompare;
            
            // If numbers are the same, compare letters
            return aLetter.localeCompare(bLetter);
        });
    
        const populateSelect = (selectElement) => {
            selectElement.innerHTML = '<option value="">--Select a class--</option>';
            sortedClasses.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.id;
                option.textContent = cls.name;
                selectElement.appendChild(option);
            });
        };
    
        // Populate both dropdowns with sorted classes
        populateSelect(document.getElementById('classSelect'));
        populateSelect(document.getElementById('importClassSelect'));
    }
    async function assignStudentToClass(studentName, classId) {
        let { data: students, error } = await window.supabase
            .from('students')
            .select('id')
            .eq('name', studentName);

        let studentId;
        if (error) {
            console.error('Error checking student:', error);
            return false;
        }

        if (students.length === 0) {
            const { data, error } = await window.supabase
                .from('students')
                .insert({ name: studentName })
                .select();

            if (error) {
                console.error('Error creating student:', error);
                return false;
            }
            studentId = data[0].id;
        } else {
            studentId = students[0].id;
        }

        const { data: existingAssignment, error: checkError } = await window.supabase
            .from('class_students')
            .select()
            .eq('class_id', classId)
            .eq('student_id', studentId);

        if (checkError) {
            console.error('Error checking existing assignment:', checkError);
            return false;
        }

        if (existingAssignment.length > 0) {
            return false; // Student already in class
        }

        const { error: assignError } = await window.supabase
            .from('class_students')
            .insert({ class_id: classId, student_id: studentId });

        if (assignError) {
            console.error('Error assigning student to class:', assignError);
            return false;
        }

        return true;
    }

    async function displayStudentList(classId) {
        const { data: classData, error: classError } = await window.supabase
            .from('classes')
            .select('name')
            .eq('id', classId)
            .single();

        if (classError) {
            console.error('Error fetching class name:', classError);
            selectedClassName.textContent = `Students in Class ${classId}`;
        } else {
            selectedClassName.textContent = `Students in ${classData.name}`;
        }

        const { data, error } = await window.supabase
            .from('class_students')
            .select(`
                student_id,
                students (id, name)
            `)
            .eq('class_id', classId);

        if (error) {
            console.error('Error fetching students:', error);
            return;
        }

        studentCheckList.innerHTML = '';
        data.forEach(item => {
            const student = item.students;
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" id="student-${student.id}" name="student" value="${student.id}">
                <label for="student-${student.id}">${student.name}</label>
            `;
            studentCheckList.appendChild(li);
        });

        // Reset select all button state when loading new class
        allSelected = false;
        selectAllButton.textContent = 'Select All';

        // Show/hide buttons based on whether there are students
        removeStudentsButton.style.display = data.length > 0 ? 'block' : 'none';
        selectAllButton.style.display = data.length > 0 ? 'block' : 'none';
    }

    async function removeStudentsFromClass(classId, studentIds) {
        const confirmRemoval = confirm(`Are you sure you want to remove ${studentIds.length} student(s) from the class?`);
        
        if (!confirmRemoval) {
            return;
        }

        const { error } = await window.supabase
            .from('class_students')
            .delete()
            .eq('class_id', classId)
            .in('student_id', studentIds);

        if (error) {
            console.error('Error removing students:', error);
            result.innerHTML = '<p>Error removing students. Please try again.</p>';
            return;
        }

        result.innerHTML = `<p>${studentIds.length} student(s) removed from the class.</p>`;
        displayStudentList(classId);
    }

    // Existing event listeners
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const studentName = document.getElementById('studentName').value;
        const selectedClass = classSelect.value;
        
        if (studentName && selectedClass) {
            await assignStudentToClass(studentName, selectedClass);
            form.reset();
            displayStudentList(selectedClass);
        } else {
            result.innerHTML = '<p>Please fill out all fields.</p>';
        }
    });

    classSelect.addEventListener('change', function() {
        if (this.value) {
            displayStudentList(this.value);
        } else {
            studentCheckList.innerHTML = '';
            selectedClassName.textContent = '';
            removeStudentsButton.style.display = 'none';
            selectAllButton.style.display = 'none';
        }
    });

    removeStudentsButton.addEventListener('click', async function() {
        const selectedStudents = Array.from(studentCheckList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        
        if (selectedStudents.length > 0) {
            const currentClass = classSelect.value;
            await removeStudentsFromClass(currentClass, selectedStudents);
        } else {
            result.innerHTML = '<p>No students selected for removal.</p>';
        }
    });

   importButton.addEventListener('click', async function() {
        const selectedClass = importClassSelect.value;
        const fileInput = document.getElementById('csvFileInput');
        
        if (!selectedClass) {
            result.innerHTML = '<p>Please select a class for import.</p>';
            return;
        }

        if (!fileInput.files[0]) {
            result.innerHTML = '<p>Please select a CSV file to import.</p>';
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async function(e) {
            const contents = e.target.result;
            const students = contents.split(/\r\n|\n/)
            .map(name=> name.trim())
            .filter(name => name !=='' && name !== ',');
            
            let successCount = 0;
            let failCount = 0;

            for (const studentName of students) {
                // Remove any trailing commas and trim whitespace
                const cleanName = studentName.replace(/,+$/, '').trim();
                if (cleanName) {
                    const success = await assignStudentToClass(cleanName, selectedClass);
                    if (success) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                }
            }

            result.innerHTML = `<p>Import complete. ${successCount} students added successfully. ${failCount} students failed (already in class or error occurred).</p>`;
            displayStudentList(selectedClass);

            fileInput.value='';
        };

        reader.onerror = function() {
            result.innerHTML = '<p>Error reading the CSV file.</p>';
        };

        reader.readAsText(file);
    });

    // Initialize
    getClasses();
}
// Check if the DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}