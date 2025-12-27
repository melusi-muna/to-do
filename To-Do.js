// To-Do.js - Complete with Dark/Light Mode
class TodoApp {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        this.settings = JSON.parse(localStorage.getItem('todoSettings')) || {
            enableNotifications: false,
            phoneNumber: '',
            reminderTime: 10
        };
        this.currentFilter = 'all';
        this.currentEditId = null;
        this.currentMonth = new Date();
        this.reminderTimeouts = new Map();
        this.sortBy = 'date';
        this.sortOrder = 'desc';
        this.currentTheme = localStorage.getItem('theme') || 'light';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.setTheme(this.currentTheme);
        this.render();
        this.loadSettings();
        this.startReminderChecker();
        this.requestNotificationPermission();
        this.renderCalendar();
        this.setupRecurrenceHandlers();
    }

    bindEvents() {
        // Task management
        document.getElementById('add-task-btn').addEventListener('click', () => this.addTaskFromInput());
        document.getElementById('task-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTaskFromInput();
        });

        // Settings
        document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setFilter(e.target.dataset.filter));
        });

        // Sorting
        document.getElementById('sort-by-date').addEventListener('click', () => this.toggleSort('date'));
        document.getElementById('sort-by-priority').addEventListener('click', () => this.toggleSort('priority'));

        // Bulk actions
        document.getElementById('delete-completed').addEventListener('click', () => this.deleteCompleted());
        document.getElementById('clear-all').addEventListener('click', () => this.clearAll());

        // Modal
        document.getElementById('close-edit-modal').addEventListener('click', () => this.closeEditModal());
        document.getElementById('cancel-edit').addEventListener('click', () => this.closeEditModal());
        document.getElementById('save-edit').addEventListener('click', () => this.saveEdit());
        
        // Calendar
        document.getElementById('prev-month').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('next-month').addEventListener('click', () => this.changeMonth(1));
    }

    // THEME MANAGEMENT
    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update theme toggle button
        const themeToggle = document.getElementById('theme-toggle');
        const themeIcon = themeToggle.querySelector('i');
        const themeText = themeToggle.querySelector('.theme-text');
        
        if (theme === 'dark') {
            themeIcon.className = 'fas fa-sun';
            themeText.textContent = 'Light Mode';
        } else {
            themeIcon.className = 'fas fa-moon';
            themeText.textContent = 'Dark Mode';
        }
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        this.showNotification(`${newTheme === 'dark' ? 'Dark' : 'Light'} mode activated`, 'info');
    }

    setupRecurrenceHandlers() {
        // Recurrence select handlers
        document.getElementById('recurrence-select').addEventListener('change', (e) => {
            this.toggleCustomRecurrence(e.target.value, 'custom-recurrence');
        });
        
        document.getElementById('edit-recurrence').addEventListener('change', (e) => {
            this.toggleCustomRecurrence(e.target.value, 'edit-custom-recurrence');
        });
    }

    toggleCustomRecurrence(value, elementId) {
        const customRecurrence = document.getElementById(elementId);
        if (value === 'custom') {
            customRecurrence.classList.add('show');
        } else {
            customRecurrence.classList.remove('show');
        }
    }

    // NOTIFICATION METHODS
    startReminderChecker() {
        setInterval(() => {
            this.checkDueTasks();
        }, 60000);
        this.checkDueTasks();
    }

    checkDueTasks() {
        if (!this.settings.enableNotifications) return;

        const now = new Date();
        const reminderMs = this.settings.reminderTime * 60 * 1000;

        this.tasks.forEach(task => {
            if (task.dueDate && !task.completed && !task.reminderSent) {
                const dueDateTime = new Date(task.dueDate);
                const timeUntilDue = dueDateTime - now;

                if (timeUntilDue > 0 && timeUntilDue <= reminderMs && !this.reminderTimeouts.has(task.id)) {
                    this.scheduleSingleReminder(task, timeUntilDue - (reminderMs - 60000));
                }
            }
        });
    }

    scheduleSingleReminder(task, delay) {
        const timeoutId = setTimeout(() => {
            this.sendReminder(task);
            task.reminderSent = true;
            this.reminderTimeouts.delete(task.id);
            this.saveTasks();
        }, delay);

        this.reminderTimeouts.set(task.id, timeoutId);
    }

    sendReminder(task) {
        const dueDateTime = new Date(task.dueDate);
        const timeString = dueDateTime.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        
        const message = `🔔 Task Reminder: "${task.text}" is due at ${timeString} (in ${this.settings.reminderTime} minutes)!`;

        // Browser Notification
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('Todo Reminder', {
                body: message,
                icon: '/favicon.ico',
                tag: `todo-reminder-${task.id}`
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }

        // SMS Notification
        if (this.settings.phoneNumber && this.isValidPhoneNumber(this.settings.phoneNumber)) {
            this.sendSMSNotification(message);
        }

        // Audio notification
        this.playNotificationSound();

        // Visual toast notification
        this.showNotification(message, 'reminder');

        console.log('Reminder sent:', message);
    }

    sendSMSNotification(message) {
        console.log(`📱 SMS would be sent to ${this.settings.phoneNumber}: ${message}`);
    }

    playNotificationSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Audio notification not supported');
        }
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    isValidPhoneNumber(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
        return phoneRegex.test(phone);
    }

    // SETTINGS MANAGEMENT
    loadSettings() {
        document.getElementById('enable-notifications').checked = this.settings.enableNotifications;
        document.getElementById('phone-number').value = this.settings.phoneNumber;
        document.getElementById('reminder-time').value = this.settings.reminderTime;
    }

    saveSettings() {
        this.settings = {
            enableNotifications: document.getElementById('enable-notifications').checked,
            phoneNumber: document.getElementById('phone-number').value,
            reminderTime: parseInt(document.getElementById('reminder-time').value)
        };

        localStorage.setItem('todoSettings', JSON.stringify(this.settings));

        this.reminderTimeouts.forEach(timeout => clearTimeout(timeout));
        this.reminderTimeouts.clear();
        this.tasks.forEach(task => task.reminderSent = false);
        this.checkDueTasks();

        this.showNotification('Notification settings saved!', 'success');
    }

    // TASK MANAGEMENT WITH RECURRENCE AND TIME
    addTaskFromInput() {
        const taskInput = document.getElementById('task-input');
        const text = taskInput.value.trim();
        
        if (text) {
            const priority = document.getElementById('priority-select').value;
            const dueDate = document.getElementById('due-date').value;
            const dueTime = document.getElementById('due-time').value;
            const category = document.getElementById('category-select').value;
            const recurrence = document.getElementById('recurrence-select').value;
            const recurrenceInterval = document.getElementById('recurrence-interval').value;
            const recurrenceUnit = document.getElementById('recurrence-unit').value;
            
            this.addTask(text, priority, dueDate, dueTime, category, recurrence, recurrenceInterval, recurrenceUnit);
            taskInput.value = '';
            document.getElementById('due-date').value = '';
            document.getElementById('due-time').value = '';
            document.getElementById('recurrence-select').value = 'none';
            document.getElementById('custom-recurrence').classList.remove('show');
        }
    }

    addTask(text, priority = 'medium', dueDate = '', dueTime = '', category = 'personal', recurrence = 'none', recurrenceInterval = 1, recurrenceUnit = 'days') {
        // Combine date and time for proper due datetime
        let dueDateTime = '';
        if (dueDate && dueTime) {
            dueDateTime = `${dueDate}T${dueTime}`;
        } else if (dueDate) {
            dueDateTime = `${dueDate}T23:59`;
        }

        const task = {
            id: Date.now(),
            text: text.trim(),
            completed: false,
            priority: priority,
            dueDate: dueDateTime,
            dueTime: dueTime,
            category: category,
            recurrence: recurrence,
            recurrenceInterval: recurrence === 'custom' ? parseInt(recurrenceInterval) : 1,
            recurrenceUnit: recurrence === 'custom' ? recurrenceUnit : 'days',
            createdAt: new Date().toISOString(),
            reminderSent: false,
            originalTaskId: null
        };

        this.tasks.push(task);
        this.saveTasks();
        this.render();

        if (dueDateTime && this.settings.enableNotifications) {
            this.scheduleTaskReminder(task);
        }

        this.showNotification('Task added successfully!', 'success');
    }

    scheduleTaskReminder(task) {
        if (!task.dueDate || task.completed) return;

        const dueDateTime = new Date(task.dueDate);
        const now = new Date();
        const reminderTime = this.settings.reminderTime * 60 * 1000;
        const timeUntilReminder = dueDateTime - now - reminderTime;

        if (timeUntilReminder > 0) {
            const timeoutId = setTimeout(() => {
                this.sendReminder(task);
                task.reminderSent = true;
                this.saveTasks();
            }, timeUntilReminder);

            this.reminderTimeouts.set(task.id, timeoutId);
        }
    }

    toggleTaskCompletion(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            
            if (task.completed) {
                if (this.reminderTimeouts.has(taskId)) {
                    clearTimeout(this.reminderTimeouts.get(taskId));
                    this.reminderTimeouts.delete(taskId);
                }
                
                // Handle recurring tasks
                if (task.recurrence && task.recurrence !== 'none' && !task.originalTaskId) {
                    setTimeout(() => this.handleRecurringTask(task), 1000);
                }
            }
            
            this.saveTasks();
            this.render();
        }
    }

    handleRecurringTask(originalTask) {
        if (!originalTask.recurrence || originalTask.recurrence === 'none') return;

        const newDueDate = this.calculateNextDueDate(originalTask);
        
        const newTask = {
            ...originalTask,
            id: Date.now() + Math.random(), // Ensure unique ID
            completed: false,
            dueDate: newDueDate,
            reminderSent: false,
            originalTaskId: originalTask.id // Track the original
        };

        this.tasks.push(newTask);
        this.saveTasks();
        this.render();
        
        if (newTask.dueDate && this.settings.enableNotifications) {
            this.scheduleTaskReminder(newTask);
        }

        this.showNotification(`Recurring task "${originalTask.text}" created for ${new Date(newDueDate).toLocaleDateString()}`, 'info');
    }

    calculateNextDueDate(task) {
        if (!task.dueDate) return '';

        const currentDue = new Date(task.dueDate);
        
        switch(task.recurrence) {
            case 'daily':
                currentDue.setDate(currentDue.getDate() + 1);
                break;
            case 'weekly':
                currentDue.setDate(currentDue.getDate() + 7);
                break;
            case 'monthly':
                currentDue.setMonth(currentDue.getMonth() + 1);
                break;
            case 'yearly':
                currentDue.setFullYear(currentDue.getFullYear() + 1);
                break;
            case 'custom':
                const interval = task.recurrenceInterval || 1;
                const unit = task.recurrenceUnit || 'days';
                
                if (unit === 'days') currentDue.setDate(currentDue.getDate() + interval);
                else if (unit === 'weeks') currentDue.setDate(currentDue.getDate() + (interval * 7));
                else if (unit === 'months') currentDue.setMonth(currentDue.getMonth() + interval);
                break;
        }
        
        return currentDue.toISOString();
    }

    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            this.currentEditId = taskId;
            document.getElementById('edit-task-input').value = task.text;
            document.getElementById('edit-priority').value = task.priority;
            
            // Extract date and time from dueDate
            if (task.dueDate) {
                const dueDateTime = new Date(task.dueDate);
                document.getElementById('edit-due-date').value = dueDateTime.toISOString().split('T')[0];
                document.getElementById('edit-due-time').value = dueDateTime.toTimeString().slice(0, 5);
            } else {
                document.getElementById('edit-due-date').value = '';
                document.getElementById('edit-due-time').value = '';
            }
            
            document.getElementById('edit-category').value = task.category;
            document.getElementById('edit-recurrence').value = task.recurrence;
            document.getElementById('edit-recurrence-interval').value = task.recurrenceInterval;
            document.getElementById('edit-recurrence-unit').value = task.recurrenceUnit;
            
            // Show/hide custom recurrence
            this.toggleCustomRecurrence(task.recurrence, 'edit-custom-recurrence');
            
            document.getElementById('edit-modal').classList.add('show');
        }
    }

    saveEdit() {
        if (this.currentEditId) {
            const task = this.tasks.find(t => t.id === this.currentEditId);
            if (task) {
                task.text = document.getElementById('edit-task-input').value.trim();
                task.priority = document.getElementById('edit-priority').value;
                
                // Combine date and time
                const dueDate = document.getElementById('edit-due-date').value;
                const dueTime = document.getElementById('edit-due-time').value;
                if (dueDate && dueTime) {
                    task.dueDate = `${dueDate}T${dueTime}`;
                } else if (dueDate) {
                    task.dueDate = `${dueDate}T23:59`;
                } else {
                    task.dueDate = '';
                }
                
                task.dueTime = dueTime;
                task.category = document.getElementById('edit-category').value;
                task.recurrence = document.getElementById('edit-recurrence').value;
                task.recurrenceInterval = document.getElementById('edit-recurrence-interval').value;
                task.recurrenceUnit = document.getElementById('edit-recurrence-unit').value;
                task.reminderSent = false;
                
                this.saveTasks();
                this.render();
                this.closeEditModal();
                this.showNotification('Task updated successfully!', 'success');
                
                if (task.dueDate && this.settings.enableNotifications) {
                    this.scheduleTaskReminder(task);
                }
            }
        }
    }

    deleteTask(taskId) {
        if (this.reminderTimeouts.has(taskId)) {
            clearTimeout(this.reminderTimeouts.get(taskId));
            this.reminderTimeouts.delete(taskId);
        }
        
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveTasks();
        this.render();
        this.showNotification('Task deleted!', 'error');
    }

    deleteCompleted() {
        const completedCount = this.tasks.filter(t => t.completed).length;
        this.tasks = this.tasks.filter(t => !t.completed);
        this.saveTasks();
        this.render();
        this.showNotification(`Deleted ${completedCount} completed tasks!`, 'success');
    }

    clearAll() {
        if (confirm('Are you sure you want to delete all tasks?')) {
            this.reminderTimeouts.forEach(timeout => clearTimeout(timeout));
            this.reminderTimeouts.clear();
            this.tasks = [];
            this.saveTasks();
            this.render();
            this.showNotification('All tasks cleared!', 'success');
        }
    }

    closeEditModal() {
        document.getElementById('edit-modal').classList.remove('show');
        this.currentEditId = null;
    }

    // FILTERING & SORTING
    setFilter(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        this.render();
    }

    toggleSort(type) {
        if (this.sortBy === type) {
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortBy = type;
            this.sortOrder = 'desc';
        }
        this.render();
    }

    getFilteredTasks() {
        let filtered = this.tasks;
        
        // Apply filter
        switch (this.currentFilter) {
            case 'active':
                filtered = filtered.filter(t => !t.completed);
                break;
            case 'completed':
                filtered = filtered.filter(t => t.completed);
                break;
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
            let result = 0;
            
            switch (this.sortBy) {
                case 'date':
                    const dateA = a.dueDate ? new Date(a.dueDate) : new Date(a.createdAt);
                    const dateB = b.dueDate ? new Date(b.dueDate) : new Date(b.createdAt);
                    result = dateB - dateA;
                    break;
                case 'priority':
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    result = priorityOrder[b.priority] - priorityOrder[a.priority];
                    break;
            }
            
            return this.sortOrder === 'asc' ? -result : result;
        });
        
        return filtered;
    }

    // RENDERING
    render() {
        this.renderTaskList();
        this.updateStats();
        this.renderCalendar();
    }

    renderTaskList() {
        const taskList = document.getElementById('task-list');
        const filteredTasks = this.getFilteredTasks();
        
        if (filteredTasks.length === 0) {
            taskList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h4>No tasks found</h4>
                    <p>${this.currentFilter === 'all' ? 'Add your first task to get started!' : 'No tasks match your current filter'}</p>
                </div>
            `;
            return;
        }
        
        taskList.innerHTML = filteredTasks.map(task => this.createTaskHTML(task)).join('');
        
        // Add event listeners to dynamically created elements
        filteredTasks.forEach(task => {
            const checkbox = document.querySelector(`#task-${task.id}`);
            const editBtn = document.querySelector(`.edit-task[data-id="${task.id}"]`);
            const deleteBtn = document.querySelector(`.delete-task[data-id="${task.id}"]`);
            
            if (checkbox) checkbox.addEventListener('change', () => this.toggleTaskCompletion(task.id));
            if (editBtn) editBtn.addEventListener('click', () => this.editTask(task.id));
            if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteTask(task.id));
        });
        
        // Update counters
        document.getElementById('visible-task-count').textContent = `${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`;
        document.getElementById('task-list-title').textContent = 
            this.currentFilter === 'all' ? 'All Tasks' : 
            this.currentFilter === 'active' ? 'Active Tasks' : 'Completed Tasks';
    }

    createTaskHTML(task) {
        let dueText = 'No due date';
        let isOverdue = false;
        
        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            const now = new Date();
            isOverdue = dueDate < now && !task.completed;
            
            // Format: "Jan 01, 2:30 PM"
            dueText = dueDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
        
        const recurrenceIcon = task.recurrence && task.recurrence !== 'none' ? 
            `<span class="task-recurrence" title="Repeats ${task.recurrence}">
                <i class="fas fa-repeat"></i> ${task.recurrence}
            </span>` : '';

        return `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-checkbox">
                    <input type="checkbox" id="task-${task.id}" ${task.completed ? 'checked' : ''}>
                    <label for="task-${task.id}"></label>
                </div>
                <div class="task-content">
                    <div class="task-text">${this.escapeHTML(task.text)}</div>
                    <div class="task-meta-info">
                        <span class="task-priority priority-${task.priority}">${task.priority}</span>
                        <span class="task-due ${isOverdue ? 'overdue' : ''}">
                            <i class="fas fa-clock"></i> ${dueText}
                        </span>
                        <span class="task-category category-${task.category}">${task.category}</span>
                        ${recurrenceIcon}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="edit-task" data-id="${task.id}" title="Edit task">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-task" data-id="${task.id}" title="Delete task">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const active = total - completed;
        const progress = total > 0 ? (completed / total) * 100 : 0;
        
        // Update progress bar
        document.getElementById('progress-fill').style.width = `${progress}%`;
        document.getElementById('completed-count').textContent = completed;
        document.getElementById('total-count').textContent = total;
        
        // Update stats
        document.getElementById('stats-total').textContent = total;
        document.getElementById('stats-active').textContent = active;
        document.getElementById('stats-completed').textContent = completed;
    }

    // CALENDAR
    renderCalendar() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        // Update month header
        document.getElementById('current-month').textContent = 
            this.currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        // Get first day of month and total days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();
        
        const calendarDays = document.getElementById('calendar-days');
        calendarDays.innerHTML = '';
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day';
            calendarDays.appendChild(emptyDay);
        }
        
        // Add days of the month
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            
            // Check if this day has tasks
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasTasks = this.tasks.some(task => 
                task.dueDate && task.dueDate.startsWith(dateStr)
            );
            
            if (hasTasks) {
                dayElement.classList.add('has-tasks');
            }
            
            // Highlight today
            if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayElement.classList.add('today');
            }
            
            calendarDays.appendChild(dayElement);
        }
    }

    changeMonth(direction) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + direction);
        this.renderCalendar();
    }

    // UTILITIES
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.custom-notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `custom-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;

        document.body.appendChild(notification);

        // Close button
        notification.querySelector('.notification-close').onclick = () => {
            notification.remove();
        };

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            info: 'info-circle',
            reminder: 'bell'
        };
        return icons[type] || 'info-circle';
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.todoApp = new TodoApp();
});