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

    async function getClasses() {
        const { data, error } = await window.supabase
            .from('classes')
            .select('id, name');

        if (error) {
            console.error('Error fetching classes:', error);
            return;
        }

        const populateSelect = (selectElement) => {
            selectElement.innerHTML = '<option value="">--Select a class--</option>';
            data.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.id;
                option.textContent = cls.name;
                selectElement.appendChild(option);
            });
        };

        populateSelect(classSelect);
        populateSelect(importClassSelect);
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
                <input type="checkbox" id="${student.id}" name="student" value="${student.id}">
                <label for="${student.id}">${student.name}</label>
            `;
            studentCheckList.appendChild(li);
        });

        removeStudentsButton.style.display = data.length > 0 ? 'block' : 'none';
    }

    async function removeStudentsFromClass(classId, studentIds) {
        const { error } = await window.supabase
            .from('class_students')
            .delete()
            .eq('class_id', classId)
            .in('student_id', studentIds);

        if (error) {
            console.error('Error removing students:', error);
            return;
        }

        result.innerHTML = `<p>${studentIds.length} student(s) removed from the class.</p>`;
        displayStudentList(classId);
    }

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
            const students = contents.split(/\r\n|\n/).filter(name => name.trim() !== '');
            
            let successCount = 0;
            let failCount = 0;

            for (const studentName of students) {
                const success = await assignStudentToClass(studentName.trim(), selectedClass);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            result.innerHTML = `<p>Import complete. ${successCount} students added successfully. ${failCount} students failed (already in class or error occurred).</p>`;
            displayStudentList(selectedClass);
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