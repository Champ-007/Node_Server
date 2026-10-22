
let tasksList = [];
let order = 'due';
let direction = 1;   // 1 = low to high, -1 = high to low

// What each sort compares, and which way it starts when first picked. null values always go last
const sortMethod = {
    due:       { value: task => task.dueDate,   startDirection: 1 },    // soonest first
    course:    { value: task => task.course,    startDirection: 1 },
    name:      { value: task => task.name,      startDirection: 1 },    // A–Z
    remaining: { value: remainingHours,         startDirection: -1 },   // most hours left first
    priority:  { value: priorityValue,          startDirection: -1 }    // most urgent first
};

function compareTasks(a, b)
{
    const aValue = sortMethod[order].value(a);
    const bValue = sortMethod[order].value(b);
    if (aValue == null || bValue == null) return (aValue == null) - (bValue == null);

    const result = typeof aValue === 'string'
        ? aValue.localeCompare(bValue)
        : (aValue > bValue) - (aValue < bValue);   // not subtraction, so Infinity - Infinity can't make NaN
    return result * direction;
}

// null for tasks with no estimate
function remainingHours(task)
{
    if (task.estimatedTotalHours == null) return null;
    return Math.max(task.estimatedTotalHours - task.loggedHours, 0);
}

function createElement(tag, className, text)
{
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
}

// Split 'YYYY-MM-DDTHH:MM' into numbers
function parseDueDate(dueDate)
{
    const [date, time = '00:00'] = dueDate.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return { year, month, day, hour, minute };
}

// 'YYYY-MM-DDTHH:MM' as a local time Date (month is 0-based)
function dueDateToDate(dueDate)
{
    const { year, month, day, hour, minute } = parseDueDate(dueDate);
    return new Date(year, month - 1, day, hour, minute);
}

// Time from now until 'YYYY-MM-DDTHH:MM', in its largest whole unit only: Xd, then Xh, then XXm
function formatCountdown(dueDate)
{
    const minutesLeft = Math.floor((dueDateToDate(dueDate) - Date.now()) / 60000);
    if (minutesLeft < 0) return 'overdue';

    if (minutesLeft >= 24 * 60) return `${Math.floor(minutesLeft / (24 * 60))}d`;
    if (minutesLeft >= 60)      return `${Math.floor(minutesLeft / 60)}h`;
    return `${String(minutesLeft).padStart(2, '0')}m`;
}

// mm/dd hh:mm AM/PM
function formatDueDate(dueDate)
{
    const { month, day, hour, minute } = parseDueDate(dueDate);
    const pad = n => String(n).padStart(2, '0');
    const suffix = hour < 12 ? 'AM' : 'PM';
    const hour12 = hour % 12 || 12;
    return `${pad(month)}/${pad(day)} ${pad(hour12)}:${pad(minute)} ${suffix}`;
}

// Header text for the due date column: Time Left (Xd)
function formatTimeLeftHeader(dueDate)
{
    return `Time Left (${formatCountdown(dueDate)})`;
}

// Priority: remaining hours of work / hours until due. Infinity when overdue, null without a due date or estimate
function priorityValue(task)
{
    if (!task.dueDate || task.estimatedTotalHours == null) return null;
    const hoursLeft = (dueDateToDate(task.dueDate) - Date.now()) / 3600000;
    if (hoursLeft <= 0) return Infinity;
    return remainingHours(task) / hoursLeft;
}

// Fill in every priority box and color it green (lowest priority) to red (highest)
function updatePriorities()
{
    // Range comes from all tasks, so colors don't shift while filtering. Overdue tasks are left out
    const values = tasksList.map(priorityValue).filter(p => p != null && p !== Infinity);
    const max = Math.max(...values);
    const min = Math.min(...values);

    for (const td of document.querySelectorAll('td[data-task-id]'))
    {
        const task = tasksList.find(t => String(t.id) === td.dataset.taskId);
        const priority = task ? priorityValue(task) : null;

        if (priority == null)
        {
            td.textContent = '';
            td.style.background = '';
            continue;
        }

        // 0 = lowest (green), 1 = highest or overdue (red)
        const t = priority === Infinity || max === min ? 1 : (priority - min) / (max - min);
        td.textContent = priority === Infinity ? 'urgent' : priority.toFixed(2);
        td.style.background = `hsl(${120 * (1 - t)}, 90%, 70%)`;
    }
}

// Refresh every card's countdown and priority in place (re-rendering would wipe an open new task form)
function updateCountdowns()
{
    for (const th of document.querySelectorAll('th[data-due-date]'))
        th.textContent = formatTimeLeftHeader(th.dataset.dueDate);
    updatePriorities();
}

function createTaskElement(task)
{
    const logged = task.loggedHours;
    const estimated = task.estimatedTotalHours;

    // Main Card (tabIndex lets keyboard/touch users "focus" it to see details)
    const li = createElement('li', 'task');
    li.tabIndex = 0;

    // Top: course and name on the left, "..." button on the right
    const title = createElement('div', 'task-title');
    title.append(
        createElement('span', 'course', task.course),
        createElement('h3', 'name', task.name)
    );
    const menuButton = createElement('button', 'accent-btn task-menu', '...');
    menuButton.type = 'button';
    menuButton.setAttribute('aria-label', 'Task options');

    // Dropdown under the "..." button
    const menuPanel = createElement('div', 'panel task-panel');
    const logHoursButton = createElement('button', null, 'Log hours');
    logHoursButton.type = 'button';
    const closeButton = createElement('button', 'accent-btn', 'Close');
    closeButton.type = 'button';
    menuPanel.append(createElement('h3', 'panel-title', 'Manage task'), logHoursButton, closeButton);
    attachPanel(menuButton, menuPanel);

    // Wrapper so the panel is placed against the button, not the whole title
    const menu = createElement('div', 'task-menu-wrap');
    menu.append(menuButton, menuPanel);

    const top = createElement('div', 'task-top');
    top.append(title, menu);

    // Details, hidden until hover: a table with labels on top, values underneath
    const columns = [
        ['Estimated', estimated ? `${estimated} h` : '—'],
        ['Logged',    `${logged} h`],
        ['Remaining', estimated ? `${Math.max(estimated - logged, 0)} h` : '—']
    ];
    const table = createElement('table', 'hours');
    const headRow = table.createTHead().insertRow();
    const valueRow = table.createTBody().insertRow();
    for (const [label, value] of columns)
    {
        headRow.append(createElement('th', null, label));
        valueRow.append(createElement('td', null, value));
    }

    // Time Left and Priority columns only when there's a due date
    if (task.dueDate)
    {
        const timeLeft = createElement('th', null, formatTimeLeftHeader(task.dueDate));
        timeLeft.dataset.dueDate = task.dueDate;   // lets updateCountdowns find it
        headRow.append(timeLeft);
        valueRow.append(createElement('td', null, formatDueDate(task.dueDate)));

        // Priority goes last
        const priority = createElement('td', 'priority');   // text and color set by updatePriorities
        priority.dataset.taskId = task.id;   // lets updateCountdowns refresh it
        headRow.append(createElement('th', null, 'Priority'));
        valueRow.append(priority);
    }

    // Two wrappers so the CSS can animate the height smoothly
    const details = createElement('div', 'details');
    const detailsInner = createElement('div');
    detailsInner.append(table);
    details.append(detailsInner);

    // Assemble
    li.append(top, details);

    return li;
}

// One labeled input for the new task form
function createField(labelText, inputAttributes)
{
    const label = createElement('label', 'field');
    const input = createElement('input');
    Object.assign(input, inputAttributes);
    label.append(createElement('span', null, labelText), input);
    return label;
}

// Unique values of one field across tasks, alphabetical
function uniqueValues(tasks, field)
{
    return [...new Set(tasks.map(task => task[field]))].sort((a, b) => a.localeCompare(b));
}

// Task names to suggest, narrowed to courses matching whatever is in the course box
function nameSuggestions(courseText)
{
    const course = courseText.trim().toLowerCase();
    return uniqueValues(tasksList.filter(task => task.course.toLowerCase().includes(course)), 'name');
}

// // Grey completion shown after the typed text, from the first term that starts with it. Tab accepts it
// function attachAutocomplete(input, getTerms)
// {
//     // The ghost sits exactly over the input: the typed part is invisible, only the rest shows
//     const wrapper = createElement('div', 'autocomplete');
//     const ghost = createElement('div', 'ghost');
//     ghost.setAttribute('aria-hidden', 'true');
//     const typedPart = createElement('span', 'ghost-typed');
//     const restPart = createElement('span', 'ghost-rest');
//     ghost.append(typedPart, restPart);
//     input.before(wrapper);
//     wrapper.append(input, ghost);
//     input.autocomplete = 'off';   // the browser's own dropdown would cover ours

//     let suggestion = null;

//     function showSuggestion(term)
//     {
//         suggestion = term;
//         typedPart.textContent = term ? input.value : '';
//         restPart.textContent = term ? term.slice(input.value.length) : '';
//     }

//     function update()
//     {
//         const text = input.value;
//         const cursorAtEnd = input.selectionStart === text.length;
//         const scrolled = input.scrollWidth > input.clientWidth;   // the ghost can't follow sideways scrolling
//         if (!text || !cursorAtEnd || scrolled) return showSuggestion(null);

//         const lower = text.toLowerCase();
//         showSuggestion(getTerms().find(term => term.length > text.length && term.toLowerCase().startsWith(lower)) ?? null);
//     }

//     input.addEventListener('input', update);
//     input.addEventListener('focus', update);
//     input.addEventListener('blur', () => showSuggestion(null));
//     input.addEventListener('keydown', function(event) {
//         if (event.key !== 'Tab' || event.shiftKey || !suggestion) return;
//         event.preventDefault();   // stay in the box instead of moving to the next one
//         input.value = suggestion;
//         input.dispatchEvent(new Event('input'));   // re-filters, and clears the ghost
//     });
// }

function createNewTask()
{
    const li = createElement('li', 'task editor');
    li.id = 'newTaskCard';

    const form = createElement('form');

    const courseField = createField('Course', { name: 'course', type: 'text', required: true, placeholder: 'CS 101' });
    const nameField = createField('Task name', { name: 'name', type: 'text', required: true, placeholder: 'Lab 3' });
    // const courseInput = courseField.querySelector('input');
    // attachAutocomplete(courseInput, () => uniqueValues(tasksList, 'course'));
    // attachAutocomplete(nameField.querySelector('input'), () => nameSuggestions(courseInput.value));

    // Input names match the database columns, so FormData can read them later
    form.append(
        createElement('h3', 'name', 'New task'),
        courseField,
        nameField,
        createField('Due date', { name: 'dueDate', type: 'date' }),
        createField('Due time (optional)', { name: 'dueTime', type: 'time' }),
        createField('Estimated hours', { name: 'estimatedTotalHours', type: 'number', min: 0, step: 0.5 })
    );

    // Discard to remove card, save to submit request
    const actions = createElement('div', 'editor-actions');
    const discardButton = createElement('button', null, 'Discard');
    discardButton.type = 'button';
    const saveButton = createElement('button', 'accent-btn', 'Save');
    saveButton.type = 'submit';
    actions.append(discardButton, saveButton);

    // Error message above the buttons, hidden by default
    const errorText = createElement('p', 'form-error');
    errorText.hidden = true;

    form.append(errorText, actions);

    discardButton.addEventListener('click', function() {
        li.remove();

        // Bring back "No tasks yet." if the list is empty again
        if (document.getElementById('taskList').children.length === 0)
            showStatus('No tasks yet.');
    });

    // Placeholder until saving is written: stop the page from reloading
    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        // Transform the form into data
        const data = Object.fromEntries(new FormData(form));

        // A time means nothing without a date
        if (data.dueTime && !data.dueDate)
        {
            errorText.textContent = 'Pick a due date please.';
            errorText.hidden = false;
            return;
        }

        // Clean and formalize data. No time given means the start of the day (12:00 AM)
        const task = {
            course: data.course.trim(),
            name: data.name.trim(),
            dueDate: data.dueDate ? `${data.dueDate}T${data.dueTime || '00:00'}` : null,
            estimatedTotalHours: data.estimatedTotalHours === '' ? null: Number(data.estimatedTotalHours)
        };

        // Prevent double-saving, clear any old error
        saveButton.disabled = true;
        errorText.hidden = true;

        try
        {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(task)
            });

            if (!response.ok)
            {
                // Add red error text to new task card using the body text in response
                console.log("Request Error");
                errorText.textContent = await response.text();
                errorText.hidden = false;
                saveButton.disabled = false;
                return;
            }

            // Saved: hard reload
            loadTasks();
        }
        catch(err)
        {
            // fetch only throws when the server can't be reached
            console.log(err);
            errorText.textContent = 'Could not reach the server.';
            errorText.hidden = false;
            saveButton.disabled = false;
        }
    });

    li.append(form);
    return li;
}

// Refocus new task card rather than making a new one
function refocusNewTask(card)
{
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card.querySelector('input').focus({ preventScroll: true });
}

function renderTasks()
{
    const tasksBody = document.getElementById('taskList');

    // Text from the filter panel, lowercased so matching ignores case
    const courseQuery = document.getElementById('filterCourse').value.trim().toLowerCase();
    const nameQuery = document.getElementById('filterName').value.trim().toLowerCase();

    // filter() makes a copy, so sorting doesn't reorder tasksList itself
    const orderedList = tasksList
        .filter(task => task.course.toLowerCase().includes(courseQuery) && task.name.toLowerCase().includes(nameQuery))
        .sort(compareTasks);

    tasksBody.replaceChildren();
    for (const task of orderedList)
    {
        tasksBody.append(createTaskElement(task));
    }
    updatePriorities();

    if (orderedList.length === 0)
    {
        showStatus(tasksList.length === 0 ? 'No tasks.' : 'No matching tasks.');
    }
    else
    {
        document.getElementById('status').hidden = true;
    }
}

async function loadTasks()
{
    const loader = document.getElementById('loader');
    const status = document.getElementById('status');
    const tasksBody = document.getElementById('taskList');
    tasksBody.replaceChildren();

    // Make loader visible, hide any old message
    loader.hidden = false;
    status.hidden = true;

    try
    {
        const response = await fetch('/api/tasks');
        const tasks = await response.json();

        tasksList = tasks;

        renderTasks();
    }
    catch (err)
    {
        console.error(err);
        showStatus('Could not load tasks.');
    }

    // Hide the loader
    loader.hidden = true;
}

// Show a message under the tasks header
function showStatus(text)
{
    const status = document.getElementById('status');
    status.textContent = text;
    status.hidden = false;
}

const themeButton = document.getElementById('darkMode');
themeButton.addEventListener('click', function() {
    document.body.classList.toggle('dark');
});

const newTaskButton = document.getElementById('addTaskButton');
newTaskButton.addEventListener('click', function() {
    const newTaskCard = document.getElementById('newTaskCard');
    if (newTaskCard == null)
    {
        // Card not opened yet, create it
        const card = createNewTask();
        document.getElementById('taskList').prepend(card);
        document.getElementById('status').hidden = true;   // hide "No tasks yet."
        card.querySelector('input').focus();
    }
    else
    {
        // Re-focus card form
        refocusNewTask(newTaskCard);
    }
});

// ---------- Panels ----------
// Only one panel is open at a time: { button, panel }, or null
let openPanel = null;

function closePanel()
{
    if (openPanel == null) return;
    openPanel.panel.classList.remove('open');
    openPanel.button.setAttribute('aria-expanded', false);
    openPanel = null;
}

// Make a button toggle a panel. Opening one closes any other
function attachPanel(button, panel)
{
    button.setAttribute('aria-expanded', false);
    button.addEventListener('click', function() {
        const wasOpen = openPanel?.panel === panel;
        closePanel();
        if (wasOpen) return;

        panel.classList.add('open');
        button.setAttribute('aria-expanded', true);
        openPanel = { button, panel };
    });
}

// Close when clicking anywhere outside the open panel (its button handles itself above)
document.addEventListener('click', function(event) {
    if (openPanel && !openPanel.panel.contains(event.target) && !openPanel.button.contains(event.target))
        closePanel();
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && openPanel)
    {
        const button = openPanel.button;
        closePanel();
        button.focus();
    }
});

// ---------- Filter panel ----------
const filterButton = document.getElementById('filterButton');
const filterPanel = document.getElementById('filterPanel');
attachPanel(filterButton, filterPanel);

// Typing in either box re-filters right away, and Tab completes from existing tasks
const filterCourse = document.getElementById('filterCourse');
const filterName = document.getElementById('filterName');
filterCourse.addEventListener('input', renderTasks);
filterName.addEventListener('input', renderTasks);
// attachAutocomplete(filterCourse, () => uniqueValues(tasksList, 'course'));
// attachAutocomplete(filterName, () => nameSuggestions(filterCourse.value));

// Sort buttons: data-sort matches a key in sortMethod. Pressing the active one again flips the direction
const sortButtons = filterPanel.querySelectorAll('[data-sort]');
for (const button of sortButtons)
{
    button.addEventListener('click', function() {
        if (order === button.dataset.sort)
        {
            direction = -direction;
        }
        else
        {
            order = button.dataset.sort;
            direction = sortMethod[order].startDirection;
        }
        for (const other of sortButtons)
        {
            other.classList.toggle('active', other === button);
            if (other === button) other.dataset.direction = direction === 1 ? 'up' : 'down';
            else delete other.dataset.direction;
        }
        renderTasks();
    });
}

loadTasks();
setInterval(updateCountdowns, 30 * 1000);
