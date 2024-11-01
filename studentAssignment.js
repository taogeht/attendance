// Global variables
let currentClassId = null;
let editModal = null;
let editNameInput = null;
let currentStudentId = null;

function initializeApp() {
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase is not initialized. Please check your Supabase script inclusion.');
        return;
    }

    // Get all required DOM elements
    const form = document.getElementById('assignmentForm');
    const result = document.getElementById('result');
    const classSelect = document.getElementById('classSelect');
    const importClassSelect = document.getElementById('importClassSelect');
    const studentCheckList = document.getElementById('studentCheckList');
    const removeStudentsButton = document.getElementById('removeStudents');
    const importButton = document.getElementById('importButton');
    editModal = document.getElementById('editNameModal');
    editNameInput = document.getElementById('editNameInput');
    const saveNameBtn = document.getElementById('saveNameBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editSelectedBtn = document.getElementById('editSelectedStudent');

    // Verify critical elements exist
    if (!studentCheckList || !classSelect) {
        console.error('Critical elements missing from the DOM');
        return;
    }

    // Create and add Select All button if it doesn't exist
    let selectAllButton = document.getElementById('selectAllStudents');
    if (!selectAllButton && studentCheckList.parentElement) {
        selectAllButton = document.createElement('button');
        selectAllButton.id = 'selectAllStudents';
        selectAllButton.className = 'select-all-btn';
        selectAllButton.textContent = 'Select All';
        studentCheckList.parentElement.insertBefore(selectAllButton, studentCheckList);
    }

    let allSelected = false;

    // Add event listeners
    if (selectAllButton) {
        selectAllButton.addEventListener('click', function(e) {
            e.preventDefault();
            const checkboxes = studentCheckList.querySelectorAll('input[type="checkbox"]');
            allSelected = !allSelected;
            
            checkboxes.forEach(checkbox => {
                checkbox.checked = allSelected;
            });
            
            this.textContent = allSelected ? 'Deselect All' : 'Select All';
        });
    }

    if (form) {
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
    }

    if (classSelect) {
        classSelect.addEventListener('change', function() {
            currentClassId = this.value;
            if (this.value) {
                displayStudentList(this.value);
            } else {
                if (studentCheckList) {
                    studentCheckList.innerHTML = '';
                }
                const selectedClassName = document.getElementById('selectedClassName');
                if (selectedClassName) {
                    selectedClassName.textContent = '';
                }
                if (removeStudentsButton) {
                    removeStudentsButton.style.display = 'none';
                }
                if (selectAllButton) {
                    selectAllButton.style.display = 'none';
                }
            }
        });
    }

    if (removeStudentsButton) {
        removeStudentsButton.addEventListener('click', async function() {
            const selectedStudents = Array.from(studentCheckList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            
            if (selectedStudents.length > 0) {
                const currentClass = classSelect.value;
                await removeStudentsFromClass(currentClass, selectedStudents);
            } else {
                result.innerHTML = '<p>No students selected for removal.</p>';
            }
        });
    }

    if (importButton) {
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
                    .map(name => name.trim())
                    .filter(name => name !== '' && name !== ',');
                
                let successCount = 0;
                let failCount = 0;

                for (const studentName of students) {
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

                fileInput.value = '';
            };

            reader.onerror = function() {
                result.innerHTML = '<p>Error reading the CSV file.</p>';
            };

            reader.readAsText(file);
        });
    }

    // Edit functionality
    if (editSelectedBtn) {
        editSelectedBtn.addEventListener('click', handleEditSelected);
    }

    if (saveNameBtn) {
        saveNameBtn.addEventListener('click', handleSaveName);
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditModal);
    }

    if (editModal) {
        window.addEventListener('click', (e) => {
            if (e.target === editModal) {
                closeEditModal();
            }
        });
    }

    // Initialize classes dropdown
    getClasses();
}

async function getClasses() {
    try {
        const { data, error } = await window.supabase
            .from('classes')
            .select('id, name');

        if (error) {
            console.error('Error fetching classes:', error);
            return;
        }

        // Sort classes alphanumerically
        const sortedClasses = data.sort((a, b) => {
            const [, aNum, aLetter] = a.name.match(/(\d+)([A-Za-z]*)/) || [null, '0', ''];
            const [, bNum, bLetter] = b.name.match(/(\d+)([A-Za-z]*)/) || [null, '0', ''];
            
            const numCompare = parseInt(aNum) - parseInt(bNum);
            if (numCompare !== 0) return numCompare;
            
            return aLetter.localeCompare(bLetter);
        });

        const populateSelect = (selectElement) => {
            if (selectElement) {
                selectElement.innerHTML = '<option value="">--Select a class--</option>';
                sortedClasses.forEach(cls => {
                    const option = document.createElement('option');
                    option.value = cls.id;
                    option.textContent = cls.name;
                    selectElement.appendChild(option);
                });
            }
        };

        populateSelect(document.getElementById('classSelect'));
        populateSelect(document.getElementById('importClassSelect'));
    } catch (error) {
        console.error('Error in getClasses:', error);
    }
}

async function assignStudentToClass(studentName, classId) {
    try {
        let { data: students, error } = await window.supabase
            .from('students')
            .select('id')
            .eq('name', studentName);

        if (error) {
            console.error('Error checking student:', error);
            return false;
        }

        let studentId;
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
    } catch (error) {
        console.error('Error in assignStudentToClass:', error);
        return false;
    }
}

async function displayStudentList(classId) {
    const selectedClassName = document.getElementById('selectedClassName');
    const studentCheckList = document.getElementById('studentCheckList');
    const removeStudentsButton = document.getElementById('removeStudents');
    const editSelectedButton = document.getElementById('editSelectedStudent');
    const selectAllButton = document.getElementById('selectAllStudents');

    if (!studentCheckList) {
        console.error('Student checklist element not found');
        return;
    }

    try {
        const { data: classData, error: classError } = await window.supabase
            .from('classes')
            .select('name')
            .eq('id', classId)
            .single();

        if (classError) {
            console.error('Error fetching class name:', classError);
            if (selectedClassName) {
                selectedClassName.textContent = `Students in Class ${classId}`;
            }
        } else if (selectedClassName) {
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
            studentCheckList.innerHTML = '<li>Error loading students. Please try again.</li>';
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

        const hasStudents = data.length > 0;
        const buttons = [removeStudentsButton, editSelectedButton, selectAllButton];
        
        buttons.forEach(button => {
            if (button) {
                button.style.display = hasStudents ? 'block' : 'none';
            }
        });
    } catch (error) {
        console.error('Error in displayStudentList:', error);
        studentCheckList.innerHTML = '<li>An unexpected error occurred. Please try again.</li>';
    }
}

async function removeStudentsFromClass(classId, studentIds) {
    const confirmRemoval = confirm(`Are you sure you want to remove ${studentIds.length} student(s) from the class?`);
    
    if (!confirmRemoval) {
        return;
    }

    try {
        const { error } = await window.supabase
            .from('class_students')
            .delete()
            .eq('class_id', classId)
            .in('student_id', studentIds);

        if (error) {
            console.error('Error removing students:', error);
            document.getElementById('result').innerHTML = '<p>Error removing students. Please try again.</p>';
            return;
        }

        document.getElementById('result').innerHTML = `<p>${studentIds.length} student(s) removed from the class.</p>`;
        await displayStudentList(classId);
    } catch (error) {
        console.error('Error in removeStudentsFromClass:', error);
        document.getElementById('result').innerHTML = '<p>An unexpected error occurred. Please try again.</p>';
    }
}

async function handleEditSelected() {
    const selectedCheckboxes = document.querySelectorAll('#studentCheckList input[type="checkbox"]:checked');
    
    if (selectedCheckboxes.length !== 1) {
        alert('Please select exactly one student to edit.');
        return;
    }

    currentStudentId = selectedCheckboxes[0].value;
    const studentName = selectedCheckboxes[0].nextElementSibling.textContent;
    
    editNameInput.value = studentName;
    editModal.style.display = 'block';
}

async function handleSaveName() {
    if (!currentStudentId || !editNameInput.value.trim()) {
        alert('Please enter a valid name.');
        return;
    }

    try {
        const { error } = await window.supabase
            .from('students')
            .update({ name: editNameInput.value.trim() })
            .eq('id', currentStudentId);

        if (error) throw error;

        closeEditModal();
        if (currentClassId) {
            await displayStudentList(currentClassId);
        }

        const result = document.getElementById('result');
        if (result) {
            result.innerHTML = '<p>Student name updated successfully.</p>';
            setTimeout(() => {
                result.innerHTML = '';
            }, 3000);
        }
    } catch (error) {
        console.error('Error updating student name:', error);
        alert('Error updating student name. Please try again.');
    }
}

function closeEditModal() {
    if (editModal) {
        editModal.style.display = 'none';
        if (editNameInput) {
            editNameInput.value = '';
        }
        currentStudentId = null;
    }
}

// Initialize the app when the DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}