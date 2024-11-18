// Add constants for days of week
const DAYS_OF_WEEK = [
    { id: 1, name: 'Monday' },
    { id: 2, name: 'Tuesday' },
    { id: 3, name: 'Wednesday' },
    { id: 4, name: 'Thursday' },
    { id: 5, name: 'Friday' }
];
let currentTimeSlots = [];
let currentScheduleData = [];


function initializeScheduleManager() {
    if (!window.supabase) {
        console.error('Supabase client is not initialized');
        showError('System initialization error');
        return;
    }

    try {
        const scheduleContainer = document.getElementById('scheduleContainer');
        if (!scheduleContainer) {
            console.error('Schedule container not found');
            return;
        }

        loadScheduleData();
        
        // Add event delegation for all button clicks
        scheduleContainer.addEventListener('click', async (e) => {
            // For add class button
            if (e.target.classList.contains('add-class-btn')) {
                const slotId = e.target.dataset.slotId;
                const dayId = e.target.dataset.dayId;
                if (slotId && dayId) {
                    await showClassAssignmentModal(parseInt(slotId), parseInt(dayId));
                }
            }
            
            // For remove class button
            if (e.target.classList.contains('remove-class-btn')) {
                const scheduleId = e.target.dataset.classScheduleId;
                if (scheduleId) {
                    
                        await removeClassFromSchedule(parseInt(scheduleId));
                    
                }
            }
        });

    } catch (error) {
        console.error('Error initializing schedule manager:', error);
        showError('Failed to initialize schedule manager');
    }
}

function sortClasses(classes) {
    const classOrder = {
        'Big': 1,
        'Middle': 2,
        'Small': 3,
        'Yoyo': 4
    };

    return classes.sort((a, b) => {
        // Get the class type (Big, Middle, Small, Yoyo)
        const typeA = Object.keys(classOrder).find(type => a.name.startsWith(type)) || '';
        const typeB = Object.keys(classOrder).find(type => b.name.startsWith(type)) || '';

        // Compare by type first
        if (classOrder[typeA] !== classOrder[typeB]) {
            return classOrder[typeA] - classOrder[typeB];
        }

        // If same type, compare by letter
        const letterA = a.name.slice(-1);
        const letterB = b.name.slice(-1);
        return letterA.localeCompare(letterB);
    });
}


async function loadScheduleData() {
    const scheduleContainer = document.getElementById('scheduleContainer');
    if (!scheduleContainer) return;

    try {
        showLoading();
        
        // Load time slots
        const { data: timeSlots, error: timeSlotsError } = await window.supabase
            .from('time_slots')
            .select('*')
            .order('start_time');

        if (timeSlotsError) throw timeSlotsError;

        // Load current schedule without is_recurring field
        const { data: scheduleData, error: scheduleError } = await window.supabase
            .from('class_schedules')
            .select(`
                id,
                day_of_week,
                time_slots (
                    slot_name,
                    start_time,
                    end_time
                ),
                schedule_classes (
                    id,
                    name,
                    teacher:schedule_teachers (
                        id,
                        name
                    )
                )
            `)
            .order('time_slot_id');

        if (scheduleError) throw scheduleError;

        // Transform the data without is_recurring
        const transformedScheduleData = scheduleData.map(item => ({
            slot_name: item.time_slots.slot_name,
            start_time: item.time_slots.start_time,
            end_time: item.time_slots.end_time,
            class_name: item.schedule_classes.name,
            teacher_name: item.schedule_classes.teacher?.name || 'No Teacher Assigned',
            schedule_id: item.id,
            class_id: item.schedule_classes.id,
            teacher_id: item.schedule_classes.teacher?.id,
            day_of_week: item.day_of_week
        }));

        currentTimeSlots = timeSlots;
        currentScheduleData = transformedScheduleData;

        renderSchedule(timeSlots, transformedScheduleData);
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('Error loading schedule data:', error);
        showError('Failed to load schedule data');
    }
}

async function removeClassFromSchedule(scheduleId) {
    try {
        // Get the schedule entry to check if it's recurring
        const { data: scheduleEntry, error: fetchError } = await window.supabase
            .from('class_schedules')
            .select('*')
            .eq('id', scheduleId)
            .single();

        if (fetchError) throw fetchError;

        if (scheduleEntry.is_recurring) {
            // For recurring classes, ask if they want to remove all occurrences
            if (confirm('This is a recurring class. Do you want to remove all occurrences?')) {
                // Remove all future occurrences of this recurring class
                const { error: deleteError } = await window.supabase
                    .from('class_schedules')
                    .delete()
                    .eq('class_id', scheduleEntry.class_id)
                    .eq('time_slot_id', scheduleEntry.time_slot_id)
                    .eq('day_of_week', scheduleEntry.day_of_week)
                    .gte('class_date', scheduleEntry.class_date);

                if (deleteError) throw deleteError;
            } else {
                // Remove only this specific occurrence
                const { error: deleteError } = await window.supabase
                    .from('class_schedules')
                    .delete()
                    .eq('id', scheduleId);

                if (deleteError) throw deleteError;
            }
        } else {
            // For non-recurring classes, just remove the single entry
            const { error: deleteError } = await window.supabase
                .from('class_schedules')
                .delete()
                .eq('id', scheduleId);

            if (deleteError) throw deleteError;
        }

        await loadScheduleData(); // Refresh the schedule display
        showSuccess('Class removed from schedule');
    } catch (error) {
        console.error('Error removing class:', error);
        showError('Failed to remove class');
    }
}


function renderSchedule(timeSlots, scheduleData) {
    const scheduleContainer = document.getElementById('scheduleContainer');
    
    // Create tabs for days of week
    const tabsHtml = `
        <div class="schedule-tabs">
            ${DAYS_OF_WEEK.map(day => `
                <button class="tab-button" data-day="${day.id}">${day.name}</button>
            `).join('')}
        </div>
    `;

    const morningSlots = timeSlots.filter(slot => slot.is_morning);
    const afternoonSlots = timeSlots.filter(slot => !slot.is_morning);

    const scheduleHtml = `
        ${tabsHtml}
        <div class="schedule-content">
            <div class="schedule-section">
                <h2>Morning Classes</h2>
                <div class="time-slots-grid">
                    ${renderTimeSlots(morningSlots, scheduleData, 1)} <!-- Default to Monday -->
                </div>
            </div>
            <div class="schedule-section">
                <h2>Afternoon Classes</h2>
                <div class="time-slots-grid">
                    ${renderTimeSlots(afternoonSlots, scheduleData, 1)} <!-- Default to Monday -->
                </div>
            </div>
        </div>
    `;

    scheduleContainer.innerHTML = scheduleHtml;

    // Add tab click handlers
    const tabButtons = scheduleContainer.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const dayId = parseInt(button.dataset.day);
            updateScheduleForDay(dayId, timeSlots, scheduleData);
            
            // Update active tab
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

    // Set first tab as active
    tabButtons[0]?.classList.add('active');
}

function updateScheduleForDay(dayId, timeSlots, scheduleData) {
    const morningSlots = timeSlots.filter(slot => slot.is_morning);
    const afternoonSlots = timeSlots.filter(slot => !slot.is_morning);
    
    const morningGrid = document.querySelector('.schedule-section:first-child .time-slots-grid');
    const afternoonGrid = document.querySelector('.schedule-section:last-child .time-slots-grid');
    
    if (morningGrid && afternoonGrid) {
        morningGrid.innerHTML = renderTimeSlots(morningSlots, scheduleData, dayId);
        afternoonGrid.innerHTML = renderTimeSlots(afternoonSlots, scheduleData, dayId);
    }
}


function renderTimeSlots(slots, scheduleData, dayId) {
    return slots.map(slot => {
        const slotClasses = scheduleData.filter(item => 
            item.slot_name === slot.slot_name && 
            item.day_of_week === dayId
        );
        const timeStr = formatTimeRange(slot.start_time, slot.end_time);
        
        return `
            <div class="time-slot">
                <div class="time-slot-header">
                    <h3>${slot.slot_name}</h3>
                    <p>${timeStr}</p>
                </div>
                <div class="time-slot-classes">
                    ${renderClasses(slotClasses)}
                </div>
                <button class="add-class-btn" data-slot-id="${slot.id}" data-day-id="${dayId}">
                    Add Class
                </button>
            </div>
        `;
    }).join('');
}

async function handleAddClass(slotId) {
    if (!slotId) {
        console.error('No slot ID provided');
        return;
    }
    await showClassAssignmentModal(slotId);
}


function renderClasses(classes) {
    if (!classes.length) {
        return '<p class="no-classes">No classes scheduled</p>';
    }

    return classes.map(cls => `
        <div class="class-item">
            <div class="class-info">
                <strong>${cls.class_name || 'Unnamed Class'}</strong>
                <span>${cls.teacher_name || 'No Teacher Assigned'}</span>
            </div>
            <button class="remove-class-btn" data-class-schedule-id="${cls.schedule_id}">
                Remove
            </button>
        </div>
    `).join('');
}

async function showCopyModal(scheduleEntry) {
    try {
        let modal = document.getElementById('copyModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'copyModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        // Get class and teacher info
        const { data: classInfo, error: classError } = await window.supabase
            .from('schedule_classes')
            .select(`
                name,
                teacher:schedule_teachers (
                    name
                )
            `)
            .eq('id', scheduleEntry.class_id)
            .single();

        if (classError) throw classError;

        // Get time slot info
        const { data: timeSlot, error: timeSlotError } = await window.supabase
            .from('time_slots')
            .select('*')
            .eq('id', scheduleEntry.time_slot_id)
            .single();

        if (timeSlotError) throw timeSlotError;

        const originalDay = DAYS_OF_WEEK.find(d => d.id === scheduleEntry.day_of_week)?.name;

        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-button" onclick="closeCopyModal()">×</span>
                <h3>Copy Schedule to Other Days</h3>
                <p>${classInfo.name} with ${classInfo.teacher.name}</p>
                <p>${timeSlot.slot_name} (${formatTimeRange(timeSlot.start_time, timeSlot.end_time)})</p>
                <p>Currently scheduled for: ${originalDay}</p>
                
                <div class="day-selection">
                    ${DAYS_OF_WEEK
                        .filter(day => day.id !== scheduleEntry.day_of_week)
                        .map(day => `
                            <label class="day-checkbox">
                                <input type="checkbox" value="${day.id}">
                                ${day.name}
                            </label>
                        `).join('')}
                </div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="copyRecurringCheck" 
                            ${scheduleEntry.is_recurring ? 'checked' : ''}>
                        Make copied schedules recurring
                    </label>
                </div>

                <div class="modal-buttons">
                    <button onclick="closeCopyModal()" class="btn-secondary">Cancel</button>
                    <button onclick="copyToSelectedDays(${JSON.stringify(scheduleEntry)})" class="btn-primary">
                        Copy Schedule
                    </button>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error showing copy modal:', error);
        showError('Failed to show copy options');
    }
}

async function copyToSelectedDays(originalEntry) {
    try {
        const selectedDays = Array.from(document.querySelectorAll('.day-checkbox input:checked'))
            .map(checkbox => parseInt(checkbox.value));

        if (selectedDays.length === 0) {
            showError('Please select at least one day');
            return;
        }

        const isRecurring = document.getElementById('copyRecurringCheck').checked;

        // Create schedule entries for each selected day
        const scheduleEntries = selectedDays.map(dayId => ({
            class_id: originalEntry.class_id,
            time_slot_id: originalEntry.time_slot_id,
            day_of_week: dayId,
            is_recurring: isRecurring
        }));

        // First check for existing schedules
        for (const entry of scheduleEntries) {
            const { data: existing, error: checkError } = await window.supabase
                .from('class_schedules')
                .select('id')
                .eq('class_id', entry.class_id)
                .eq('time_slot_id', entry.time_slot_id)
                .eq('day_of_week', entry.day_of_week);

            if (checkError) throw checkError;

            if (existing && existing.length > 0) {
                const dayName = DAYS_OF_WEEK.find(d => d.id === entry.day_of_week)?.name;
                throw new Error(`Schedule already exists for ${dayName}`);
            }
        }

        // Insert all new schedules
        const { error: insertError } = await window.supabase
            .from('class_schedules')
            .insert(scheduleEntries);

        if (insertError) throw insertError;

        closeCopyModal();
        showSuccess('Schedule copied successfully');
        await loadScheduleData();

    } catch (error) {
        console.error('Error copying schedule:', error);
        showError(error.message || 'Failed to copy schedule');
    }
}

function closeCopyModal() {
    const modal = document.getElementById('copyModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function formatTimeRange(start, end) {
    const formatTime = timeStr => {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12;
        return `${formattedHour}:${minutes} ${ampm}`;
    };

    return `${formatTime(start)} - ${formatTime(end)}`;
}

function setupEventListeners() {
    const scheduleContainer = document.getElementById('scheduleContainer');
    if (!scheduleContainer) return;

    scheduleContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('add-class-btn')) {
            const slotId = e.target.dataset.slotId;
            if (slotId) {
                await handleAddClass(parseInt(slotId));
            }
        }
    });
}

async function assignClassToTimeSlot(classId, slotId) {
    try {
        console.log('Assigning class', classId, 'to slot', slotId); // Debug log

        // First verify this class isn't already scheduled in this time slot
        const { data: existing, error: existingError } = await window.supabase
            .from('class_schedules')
            .select('id')
            .eq('class_id', classId)
            .eq('time_slot_id', slotId);

        if (existingError) throw existingError;

        if (existing && existing.length > 0) {
            throw new Error('This class is already scheduled for this time slot');
        }

        // Also check if the teacher already has a class in this time slot
        const { data: classData, error: classError } = await window.supabase
            .from('schedule_classes')
            .select('teacher_id')
            .eq('id', classId)
            .single();

        if (classError) throw classError;

        const { data: teacherConflict, error: conflictError } = await window.supabase
            .from('class_schedules')
            .select(`
                schedule_classes!inner (
                    teacher_id
                )
            `)
            .eq('time_slot_id', slotId)
            .eq('schedule_classes.teacher_id', classData.teacher_id);

        if (conflictError) throw conflictError;

        if (teacherConflict && teacherConflict.length > 0) {
            throw new Error('This teacher already has a class scheduled in this time slot');
        }

        // Insert the new schedule
        const { error: insertError } = await window.supabase
            .from('class_schedules')
            .insert([{
                class_id: classId,
                time_slot_id: slotId
            }]);

        if (insertError) throw insertError;

        showSuccess('Class assigned successfully');
        return true;
    } catch (error) {
        console.error('Error assigning class:', error);
        showError(error.message || 'Failed to assign class');
        return false;
    }
}




function showLoading() {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.className = 'message';
        messageDiv.textContent = 'Loading...';
        messageDiv.style.display = 'block';
    }
}

function hideLoading() {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.style.display = 'none';
    }
}


function showSuccess(message) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = 'message success-message';
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 3000);
    }
}

function showError(message) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = 'message error-message';
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 3000);
    }
}

async function showClassAssignmentModal(slotId, dayId) {
    try {
        let modal = document.getElementById('assignmentModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'assignmentModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        const { data: timeSlot, error: timeSlotError } = await window.supabase
            .from('time_slots')
            .select('*')
            .eq('id', slotId)
            .single();

        if (timeSlotError) throw timeSlotError;

        // Get all classes
        const { data: allClasses, error: classesError } = await window.supabase
            .from('schedule_classes')
            .select('*')
            .order('name');

        if (classesError) throw classesError;

        // Get all teachers
        const { data: allTeachers, error: teachersError } = await window.supabase
            .from('schedule_teachers')
            .select('*')
            .order('name');

        if (teachersError) throw teachersError;

        // Get busy teachers for this time slot and day
        const { data: existingSchedules, error: schedulesError } = await window.supabase
            .from('class_schedules')
            .select(`
                day_of_week,
                schedule_classes (
                    teacher_id
                )
            `)
            .eq('time_slot_id', slotId);

        if (schedulesError) throw schedulesError;

        // Create a map of busy teachers by day
        const busyTeachersByDay = {};
        existingSchedules.forEach(schedule => {
            if (!busyTeachersByDay[schedule.day_of_week]) {
                busyTeachersByDay[schedule.day_of_week] = new Set();
            }
            if (schedule.schedule_classes?.teacher_id) {
                busyTeachersByDay[schedule.day_of_week].add(schedule.schedule_classes.teacher_id);
            }
        });

        // Filter available teachers
        const availableTeachers = allTeachers.filter(teacher => {
            const hasTimePreference = timeSlot.is_morning ? 
                teacher.teaches_morning : 
                teacher.teaches_afternoon;
            return hasTimePreference;
        });

        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-button" onclick="closeModal()">×</span>
                <h3>Assign Class to ${timeSlot.slot_name}</h3>
                <p>${formatTimeRange(timeSlot.start_time, timeSlot.end_time)}</p>
                
                <div class="form-group">
                    <label for="classSelect">Select Class:</label>
                    <select id="classSelect" class="form-control">
                        <option value="">Choose a class...</option>
                        ${allClasses.map(cls => `
                            <option value="${cls.id}">${cls.name}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label for="teacherSelect">Assign Teacher:</label>
                    <select id="teacherSelect" class="form-control">
                        <option value="">Choose a teacher...</option>
                        ${availableTeachers.map(teacher => `
                            <option value="${teacher.id}">${teacher.name}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="block-label">Select Days:</label>
                    <div class="days-selection">
                        ${DAYS_OF_WEEK.map(day => {
                            const isAvailable = availableTeachers.some(teacher => 
                                !busyTeachersByDay[day.id]?.has(teacher.id)
                            );
                            return `
                                <label class="day-checkbox ${!isAvailable ? 'disabled' : ''}">
                                    <input type="checkbox" 
                                           value="${day.id}" 
                                           ${day.id === dayId ? 'checked' : ''}
                                           ${!isAvailable ? 'disabled' : ''}>
                                    ${day.name}
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="modal-buttons">
                    <button onclick="closeModal()" class="btn-secondary">Cancel</button>
                    <button onclick="handleMultiDayAssignment(${slotId})" class="btn-primary">Assign</button>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error showing modal:', error);
        showError('Failed to load class options');
    }
}

async function handleAssignment(slotId, dayId) {
    const classSelect = document.getElementById('classSelect');
    const teacherSelect = document.getElementById('teacherSelect');

    if (!classSelect.value || !teacherSelect.value) {
        showError('Please select both a class and a teacher');
        return;
    }

    try {
        await assignClassAndTeacher(
            parseInt(slotId),
            parseInt(dayId),
            parseInt(classSelect.value),
            parseInt(teacherSelect.value)
        );
    } catch (error) {
        console.error('Error in handleAssignment:', error);
        showError('Failed to assign class and teacher');
    }
}

async function handleMultiDayAssignment(slotId) {
    const classSelect = document.getElementById('classSelect');
    const teacherSelect = document.getElementById('teacherSelect');
    const selectedDays = Array.from(document.querySelectorAll('.day-checkbox input:checked'))
        .map(checkbox => parseInt(checkbox.value));

    if (!classSelect.value || !teacherSelect.value) {
        showError('Please select both a class and a teacher');
        return;
    }

    if (selectedDays.length === 0) {
        showError('Please select at least one day');
        return;
    }

    try {
        const classId = parseInt(classSelect.value);
        const teacherId = parseInt(teacherSelect.value);

        // Create schedule entries for all selected days
        const scheduleEntries = selectedDays.map(dayId => ({
            class_id: classId,
            time_slot_id: slotId,
            day_of_week: dayId
        }));

        // Update the class with the teacher
        const { error: updateError } = await window.supabase
            .from('schedule_classes')
            .update({ teacher_id: teacherId })
            .eq('id', classId);

        if (updateError) throw updateError;

        // Create all schedule entries
        const { error: scheduleError } = await window.supabase
            .from('class_schedules')
            .insert(scheduleEntries);

        if (scheduleError) throw scheduleError;

        closeModal();
        showSuccess(`Class assigned to ${selectedDays.length} day(s) successfully`);
        await loadScheduleData();

    } catch (error) {
        console.error('Error in handleMultiDayAssignment:', error);
        showError('Failed to assign class to selected days');
    }
}

async function assignClassAndTeacher(slotId, dayId, classId, teacherId) {
    try {
        // Check for existing schedule
        const { data: existingSchedule, error: checkError } = await window.supabase
            .from('class_schedules')
            .select('*')
            .eq('class_id', classId)
            .eq('time_slot_id', slotId)
            .eq('day_of_week', dayId);

        if (checkError) throw checkError;

        if (existingSchedule && existingSchedule.length > 0) {
            showError('This class is already scheduled for this time slot and day');
            return;
        }

        // Update the class with the teacher
        const { error: updateError } = await window.supabase
            .from('schedule_classes')
            .update({ teacher_id: teacherId })
            .eq('id', classId);

        if (updateError) throw updateError;

        // Create the schedule entry
        const scheduleEntry = {
            class_id: classId,
            time_slot_id: slotId,
            day_of_week: dayId
        };

        const { error: scheduleError } = await window.supabase
            .from('class_schedules')
            .insert([scheduleEntry]);

        if (scheduleError) throw scheduleError;

        closeModal();
        showSuccess('Class assigned successfully');
        await loadScheduleData();

    } catch (error) {
        console.error('Error in assignClassAndTeacher:', error);
        throw error;
    }
}


async function createRecurringSchedule(slotId, dayId, classId, teacherId) {
    try {
        // For a weekly template, we just need one entry marked as recurring
        const scheduleEntry = {
            class_id: classId,
            time_slot_id: slotId,
            day_of_week: dayId,
            is_recurring: true,
            // No need for specific dates in a weekly template
            class_date: null,
            semester_start_date: null,
            semester_end_date: null
        };

        // Check if this slot is already scheduled for this day
        const { data: existingSchedule, error: checkError } = await window.supabase
            .from('class_schedules')
            .select('*')
            .eq('class_id', classId)
            .eq('time_slot_id', slotId)
            .eq('day_of_week', dayId)
            .eq('is_recurring', true);

        if (checkError) throw checkError;

        if (existingSchedule && existingSchedule.length > 0) {
            showError('This class is already scheduled for this time slot and day');
            return;
        }

        // Create the schedule entry
        const { error: insertError } = await window.supabase
            .from('class_schedules')
            .insert([scheduleEntry]);

        if (insertError) {
            console.error('Insert error:', insertError);
            throw insertError;
        }

        console.log('Successfully created weekly schedule entry');

    } catch (error) {
        console.error('Error creating weekly schedule:', error);
        throw error;
    }
}

// Helper function to get semester start date
function getSemesterStartDate() {
    const today = new Date();
    // Set to beginning of current week
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    today.setDate(diff);
    return today.toISOString().split('T')[0];
}

// Helper function to get semester end date
function getSemesterEndDate() {
    const startDate = new Date(getSemesterStartDate());
    // Set to 16 weeks (typical semester length) from start date
    startDate.setDate(startDate.getDate() + (16 * 7));
    return startDate.toISOString().split('T')[0];
}

function closeModal() {
    const modal = document.getElementById('assignmentModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function assignClass(slotId) {
    const classSelect = document.getElementById('classSelect');
    if (!classSelect || !classSelect.value) {
        showError('Please select a class');
        return;
    }

    try {
        const classId = classSelect.value;
        console.log('Assigning class:', classId, 'to slot:', slotId);

        const { error } = await window.supabase
            .from('class_schedules')
            .insert([{
                class_id: classId,
                time_slot_id: slotId
            }]);

        if (error) throw error;

        closeModal();
        showSuccess('Class assigned successfully');
        await loadScheduleData(); // Refresh the schedule display
    } catch (error) {
        console.error('Error assigning class:', error);
        showError('Failed to assign class');
    }
}


// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeScheduleManager);
} else {
    initializeScheduleManager();
}