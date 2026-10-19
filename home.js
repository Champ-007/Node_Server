
let tasksList = [];
let order = 'due';

const sortMethod = {
    due:    (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'),
    course: (a, b) => a.course.localeCompare(b.course),
    name:   (a, b) => a.name.localeCompare(b.name),
    remaining: (a, b) => remainingHours(b) - remainingHours(a)   // most hours left first
};

// Tasks with no estimate count as -1 so they sort to the bottom
function remainingHours(task)
{
    if (task.estimatedTotalHours == null) return -1;
    return Math.max(task.estimatedTotalHours - task.loggedHours, 0);
}

function createElement(tag, className, text)
{
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
}

// Split the text mm/dd
function formatDueDate(dueDate)
{
    const [year, month, day] = dueDate.split('-');
    return `${month}/${day}`;
}

function createTaskElement(task)
{
    const logged = task.loggedHours;
    const estimated = task.estimatedTotalHours;

    // Main Card (tabIndex lets keyboard/touch users "focus" it to see details)
    const li = createElement('li', 'task');
    li.tabIndex = 0;

    // Title / top
    const top = createElement('div', 'task-top');
    top.append(
        createElement('span', 'course', task.course),
        createElement('span', 'due', task.dueDate ? `Due: ${formatDueDate(task.dueDate)}` : 'No due date')
    );

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

    // Two wrappers so the CSS can animate the height smoothly
    const details = createElement('div', 'details');
    const detailsInner = createElement('div');
    detailsInner.append(table);
    details.append(detailsInner);

    // Assemble
    li.append(
        top,
        createElement('h3', 'name', task.name),
        details
    );

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

function createNewTask()
{
    const li = createElement('li', 'task editor');
    li.id = 'newTaskCard';

    const form = createElement('form');

    // Input names match the database columns, so FormData can read them later
    form.append(
        createElement('h3', 'name', 'New task'),
        createField('Course', { name: 'course', type: 'text', required: true, placeholder: 'CS 101' }),
        createField('Task name', { name: 'name', type: 'text', required: true, placeholder: 'Lab 3' }),
        createField('Due date', { name: 'dueDate', type: 'date' }),
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

        // Clean and formalize data
        const task = {
            course: data.course.trim(),
            name: data.name.trim(),
            dueDate: data.dueDate || null,
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
        .sort(sortMethod[order]);

    tasksBody.replaceChildren();
    for (const task of orderedList)
    {
        tasksBody.append(createTaskElement(task));
    }

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

// ---------- Filter panel ----------
const filterButton = document.getElementById('filterButton');
const filterPanel = document.getElementById('filterPanel');

function setFilterPanel(open)
{
    filterPanel.classList.toggle('open', open);
    filterButton.setAttribute('aria-expanded', open);
}

filterButton.addEventListener('click', function() {
    setFilterPanel(!filterPanel.classList.contains('open'));
});

// Close when clicking anywhere outside the panel (the button handles itself above)
document.addEventListener('click', function(event) {
    if (!filterPanel.contains(event.target) && event.target !== filterButton)
        setFilterPanel(false);
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && filterPanel.classList.contains('open'))
    {
        setFilterPanel(false);
        filterButton.focus();
    }
});

// Typing in either box re-filters right away
document.getElementById('filterCourse').addEventListener('input', renderTasks);
document.getElementById('filterName').addEventListener('input', renderTasks);

// Sort buttons: data-sort matches a key in sortMethod
const sortButtons = filterPanel.querySelectorAll('[data-sort]');
for (const button of sortButtons)
{
    button.addEventListener('click', function() {
        order = button.dataset.sort;
        for (const other of sortButtons)
            other.classList.toggle('active', other === button);
        renderTasks();
    });
}

loadTasks();
